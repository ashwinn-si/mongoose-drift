# mongoose-drift

Schema versioning and diff tool for Mongoose / MongoDB.

Track changes to your Mongoose schemas over time. See exactly what fields were added, modified, removed, or potentially renamed between snapshots. Generates migration stubs for `migrate-mongo` and exports plain-text diffs out of the box.

[![npm version](https://img.shields.io/npm/v/mongoose-drift.svg)](https://www.npmjs.com/package/mongoose-drift)
[![license](https://img.shields.io/npm/l/mongoose-drift.svg)](https://github.com/ashwinn-si/mongoose-drift/blob/main/LICENSE)

## Features

- **Schema Extraction** — Parses `.js` and `.ts` Mongoose models automatically, including nested objects, arrays, refs, and enums.
- **Snapshot Versioning** — Save versioned snapshots of your schema and compare any two versions at any time.
- **Field-Level Diffing** — Detects added, removed, modified, and potentially renamed fields with before/after context.
- **Migration Stub Generation** — Scaffolds `migrate-mongo` compatible `.js` migration files from any diff.
- **Multi-Project Support** — Isolate multiple services or databases using the `-p, --project <name>` flag.
- **Zod Validation** — All snapshot files are validated on read with Zod schemas to catch corruption early.
- **Export Formats** — Output diffs as colored terminal output, JSON, or plain-text files.

## Installation

```bash
npm install -g mongoose-drift
```

Or as a dev dependency:

```bash
npm install -D mongoose-drift
```

## Quick Start

### 1. Initialize

Point mongoose-drift at your models directory:

```bash
npx mongoose-drift init --models ./src/models
```

This creates a `.mongoose-drift/default/config.json` in your project root.

### 2. Take a Snapshot

Baseline your current schema:

```bash
npx mongoose-drift snapshot --version 1.0.0
```

### 3. Make Changes

Edit your Mongoose models — add fields, remove fields, change types, update refs.

### 4. Diff Against HEAD

Compare your saved snapshot against the current live state of your models:

```bash
npx mongoose-drift diff 1.0.0 HEAD
```

Generate a migration stub alongside the diff:

```bash
npx mongoose-drift diff 1.0.0 HEAD --stub
```

## CLI Reference

| Command | Description |
|---------|-------------|
| `init --models <path>` | Initialize config with models directory |
| `snapshot --version <v>` | Save a versioned schema snapshot |
| `diff <from> <to>` | Compare two snapshots (use `HEAD` for current state) |
| `log` | List all saved snapshots |
| `show <version>` | Print the schema of a saved snapshot |

### Diff Options

| Flag | Description |
|------|-------------|
| `--stub` | Generate a `migrate-mongo` migration file |
| `--json` | Output diff as raw JSON |
| `--txt [path]` | Export diff as a plain-text file |
| `-p, --project <name>` | Target a specific project namespace (default: `default`) |

## Multi-Project Usage

For monorepos or multi-service architectures, isolate schemas per project:

```bash
npx mongoose-drift init --models ./apps/auth/models -p auth
npx mongoose-drift init --models ./apps/billing/models -p billing

npx mongoose-drift snapshot --version 1.0.0 -p billing
npx mongoose-drift diff 1.0.0 HEAD -p billing --stub
```

Snapshots and migrations are stored separately under each project namespace.

## Programmatic API

```typescript
import {
  extractSchemas,
  diffSnapshots,
  detectPotentialRenames,
} from 'mongoose-drift';

const before = { version: '1.0.0', createdAt: '...', modelsPath: './models', collections: { /* ... */ } };
const after  = { version: '2.0.0', createdAt: '...', modelsPath: './models', collections: { /* ... */ } };

const diff = diffSnapshots(before, after);
const renames = detectPotentialRenames(diff.collections['User']?.changes ?? []);
```

### Exported Functions

| Function | Description |
|----------|-------------|
| `extractSchemas(modelsPath)` | Extract schemas from a models directory |
| `diffSnapshots(before, after)` | Compute field-level diff between two snapshots |
| `detectPotentialRenames(changes)` | Find likely renames in a set of field changes |
| `saveSnapshot(options)` | Save a snapshot to disk |
| `loadSnapshot(version, project)` | Load a snapshot from disk |
| `listSnapshots(project)` | List all saved snapshot versions |
| `generateStub(diff, from, to, project)` | Generate a migration stub file |

### Exported Types

```typescript
import type {
  SchemaSnapshot,
  DiffResult,
  FieldChange,
  CollectionChange,
  FieldDefinition,
} from 'mongoose-drift';
```

## How It Works

1. **Extract** — Loads Mongoose model files via `require()`, walks `schema.paths` to normalize fields into a portable format.
2. **Snapshot** — Serializes the extracted schema to a versioned JSON file under `.mongoose-drift/<project>/`.
3. **Diff** — Compares two snapshots field-by-field, detecting additions, removals, modifications, and potential renames.
4. **Report** — Formats the diff as colored terminal output, JSON, or plain text.
5. **Stub** — Translates the diff into a `migrate-mongo` compatible migration file with `$set`, `$unset`, and `$rename` operations.

## Requirements

- Node.js >= 16
- Mongoose >= 6 (as a peer dependency in your project)

## License

MIT
