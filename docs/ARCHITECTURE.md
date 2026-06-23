# Architecture

mongoose-drift is a pipeline of independent modules. Each has a single responsibility and a clean interface; they compose through plain data types.

## Module Map

```
CLI (cli.ts)
  │
  ├─── extractor.ts     ──► CollectionSchema map
  │
  ├─── snapshot.ts      ──► SchemaSnapshot (JSON on disk)
  │       │
  │       └── extractor.ts  (calls extractSchemas for HEAD)
  │
  ├─── diff.ts          ──► DiffResult
  │
  ├─── reporter.ts      ──► terminal / plain-text output
  │
  ├─── stub-generator.ts ──► .js migration file
  │
  └─── ai-setup.ts      ──► agent instruction files (CLAUDE.md, .cursorrules, etc.)

postinstall.ts  (npm postinstall hook → calls ai-setup.ts)
```

## Data Flow

```
model files (.ts/.js)
        │
        ▼
   extractor.ts
   extractSchemas(modelsPath)
        │  Record<string, CollectionSchema>
        ▼
   snapshot.ts
   saveSnapshot()  ──────────────────────────────►  .mongoose-drift/<project>/<version>.json
   loadSnapshot()  ◄──────────────────────────────  .mongoose-drift/<project>/<version>.json
        │  SchemaSnapshot
        ▼
   diff.ts
   diffSnapshots(before, after)
        │  DiffResult
        ├──► reporter.ts       → colored terminal or plain-text string
        └──► stub-generator.ts → migrations/<project>/<from>-to-<to>.js

   ai-setup.ts
   setupAI(projectRoot)
        │
        ├──► CLAUDE.md
        ├──► .cursorrules
        ├──► .cursor/rules/mongoose-drift.mdc
        ├──► .github/copilot-instructions.md
        ├──► .windsurfrules
        └──► .augment/guidelines.md
```

## Key Types

```typescript
// Normalized representation of a single field
FieldDefinition = { type: string; required?: boolean; ref?: string; ... }

// Normalized index
IndexDefinition = { fields: Record<string, 1 | -1 | 'text'>; options?: { unique?, sparse?, name? } }

// Schema of one collection
CollectionSchema = { fields: Record<string, FieldDefinition>; indexes: IndexDefinition[]; options?: Record<string, unknown> }

// Versioned snapshot of all collections
SchemaSnapshot = { version: string; createdAt: string; modelsPath: string; collections: Record<string, CollectionSchema> }

// What changed between two snapshots
DiffResult = { collections: Record<string, CollectionChange> }

CollectionChange =
  | { type: 'added' | 'removed' }
  | { type: 'modified'; changes?: FieldChange[]; indexChanges?: IndexChange[] }

// A single field change
FieldChange = { type: 'added' | 'removed' | 'modified' | 'renamed'; field: string; before?: FieldDefinition; after?: FieldDefinition; renamedFrom?: string }

// A single index change
IndexChange = { type: 'added' | 'removed'; fields: Record<string, 1 | -1 | 'text'>; options?: IndexDefinition['options'] }
```

All types are defined and validated in `src/types.ts` using Zod. `SchemaSnapshotSchema` is the Zod counterpart of `SchemaSnapshot` and is used to validate files read from disk.

## Extractor

`extractSchemas(modelsPath)` uses `glob` to find all `.ts`/`.js` files, `require()`s each one, then inspects the export:

1. If the default export has `.schema.paths` → compiled Mongoose Model.
2. If the default export has `.paths` and `.path` is a function → raw Mongoose Schema.
3. Falls through to named exports and applies the same two checks.

Field normalization (`normalizeFieldFromPath`) maps `SchemaType.instance` to a portable type string. Arrays are unwrapped to `Array<ElementType>`. Only user-defined paths are captured; `_id` and `__v` are skipped.

`ts-node/register` is required at startup if available so `.ts` model files can be loaded without a prior compile step.

## Snapshot

Snapshots are JSON files under `.mongoose-drift/<project>/`. A `config.json` in the same directory stores the default `modelsPath` so it doesn't need to be repeated on every command.

The special version `HEAD` bypasses disk and calls `extractSchemas` live, letting you diff a saved snapshot against the current working state without saving first.

## Diff

`diffSnapshots` does two things per collection:

- **Field diff** (`diffCollection`): iterates the union of field names and classifies each as added / removed / modified. Modified means `JSON.stringify(before) !== JSON.stringify(after)`.
- **Index diff** (`diffIndexes`): serializes each index as JSON, compares sets. An index is either present or absent — no concept of "modified" (that appears as remove + add).

`detectPotentialRenames` is a post-processing step: it looks for a (removed, added) pair sharing the same type. The result is advisory — only the CLI surfaces it as a warning.

## Reporter

Two output paths:

- `printDiff` — writes to stdout with chalk colors. Used by the interactive CLI.
- `generateTextReport` — returns a plain string. Used for `--txt` file export and in tests.

Both paths render field changes and index changes.

## Stub Generator

`generateStub` translates a `DiffResult` into a `migrate-mongo` compatible JS file with `up(db)` and `down(db)` stubs. All operations are commented out by default — the developer must review and uncomment. Field changes generate `$set`, `$unset`, and `$rename` comments. Index changes generate `createIndex` and `dropIndex` comments.

## AI Setup

`setupAI(projectRoot)` is called by two entry points:

- **`postinstall.ts`** — runs automatically after `npm install` via the `postinstall` npm script. Uses `process.env.INIT_CWD` (set by npm) as the consumer's project root. Skips silently if `INIT_CWD` is unset or matches the package's own directory (i.e. development install).
- **`cli.ts` `setup-ai` command** — lets users re-run at any time, e.g. after saving new snapshots.

`setupAI` calls `buildContent(projectRoot)`, which:
1. Generates the markdown instruction block (commands table, schema inspection steps).
2. Calls `discoverSnapshots(projectRoot)` to list any existing `.mongoose-drift/` versions and appends them to the block.

Each target file is then handled by `writeAgentFile`:
- If the file does not exist, it is created with just the block.
- If the file exists and contains `<!-- mongoose-drift:start/end -->` markers, only the content between them is replaced.
- If the file exists without markers, the block is appended.

The `.cursor/rules/mongoose-drift.mdc` file is always replaced (not marker-merged) because it is mongoose-drift-specific and includes Cursor MDC frontmatter (`alwaysApply: true`).
