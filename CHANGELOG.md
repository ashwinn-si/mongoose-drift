# Changelog

All notable changes to mongoose-drift are documented here.

## [1.2.0] - 2026-06-23

### Added
- AI agent awareness: `postinstall` script auto-generates instruction files for Claude Code (`CLAUDE.md`), Cursor (`.cursor/rules/mongoose-drift.mdc`, `.cursorrules`), GitHub Copilot (`.github/copilot-instructions.md`), Windsurf (`.windsurfrules`), and Augment (`.augment/guidelines.md`).
- Existing instruction files are updated in-place using HTML comment markers — no content is overwritten.
- `setup-ai` CLI command lets users refresh agent files after adding snapshots: `npx mongoose-drift setup-ai`.
- Known snapshots are listed in the injected content when `.mongoose-drift/` already has versions.

## [1.1.0] - 2026-06-23

### Added
- Index-level diffing: `diffSnapshots` now compares indexes between snapshots and reports added/removed indexes per collection.
- `IndexChange` and `IndexDefinition` exported from the public API.
- Migration stubs include commented `createIndex` / `dropIndex` operations for index changes.

### Fixed
- `cli.ts`: replaced dynamic nested `import('fs')` / `import('path')` calls with static top-level imports.

## [1.0.1] - 2024

### Fixed
- Bug fixes (see git history).

## [1.0.0] - 2024

### Added
- Schema extraction from `.ts` and `.js` Mongoose model files via `require()`.
- Versioned JSON snapshots saved under `.mongoose-drift/<project>/`.
- Field-level diffing: detects added, removed, modified, and potentially renamed fields.
- Potential rename detection heuristic (`detectPotentialRenames`).
- Migration stub generation compatible with `migrate-mongo`.
- Multi-project support via `-p, --project <name>`.
- Zod validation on all snapshot files at read time.
- Output formats: colored terminal, `--json`, `--txt`.
- CLI commands: `init`, `snapshot`, `diff`, `log`, `show`.
- Programmatic API: `extractSchemas`, `diffSnapshots`, `saveSnapshot`, `loadSnapshot`, `listSnapshots`, `generateStub`.
