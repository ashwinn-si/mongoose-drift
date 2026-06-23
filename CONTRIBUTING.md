# Contributing to mongoose-drift

## Setup

```bash
git clone https://github.com/ashwinn-si/mongoose-drift.git
cd mongoose-drift
npm install
```

## Development

Run in dev mode (no build step):

```bash
npm run dev -- <command>
# e.g.
npm run dev -- init --models ./tests/models
npm run dev -- setup-ai
```

Build the dist output:

```bash
npm run build
```

## Tests

```bash
npm test
```

Tests live in `tests/`. Each source file has a corresponding test file. The integration test (`tests/integration.test.ts`) exercises the full pipeline end-to-end using the model fixtures in `tests/models/`.

When adding a feature:
- Add or update the unit test for the affected module.
- Add a scenario to `integration.test.ts` if the change crosses module boundaries.

## Project Structure

```
src/
  cli.ts            CLI entry point (commander)
  extractor.ts      Loads Mongoose model files, walks schema.paths
  snapshot.ts       Save/load versioned JSON snapshots to .mongoose-drift/
  diff.ts           Field- and index-level diffing between two snapshots
  reporter.ts       Formats diffs as terminal output or plain text
  stub-generator.ts Generates migrate-mongo compatible .js migration stubs
  types.ts          Zod schemas + inferred TypeScript types
  index.ts          Public programmatic API exports
  ai-setup.ts       Writes/updates AI agent instruction files (marker-based upsert)
  postinstall.ts    Entry point for the npm postinstall hook
tests/
  models/           Fixture Mongoose models used by the test suite
docs/
  ARCHITECTURE.md   Module diagram and data flow
```

## AI Agent Files

`src/ai-setup.ts` is responsible for writing instruction blocks into agent-specific files (`CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`, etc.). The logic uses HTML comment markers (`<!-- mongoose-drift:start/end -->`) so the block can be updated without overwriting surrounding content.

If you change the content that gets injected (e.g. new commands, new guidance), update `buildContent()` in `ai-setup.ts`. The `postinstall` hook and the `setup-ai` CLI command both call the same `setupAI()` function.

When testing postinstall behaviour locally, use `INIT_CWD` to point it at a temp directory:

```bash
npm run build
INIT_CWD=/tmp/my-test-project node dist/postinstall.js
```

## Code Style

- TypeScript strict mode is on.
- No comments unless the *why* is non-obvious.
- No added abstractions beyond what the change requires.
- Run `npm test` before opening a PR — the CI gate is `prepublishOnly`.

## Pull Requests

1. Fork and branch from `master`.
2. Keep PRs focused — one feature or fix per PR.
3. Update `CHANGELOG.md` under a new `[Unreleased]` section.
4. Tests must pass (`npm test`).

## Reporting Issues

Open an issue at https://github.com/ashwinn-si/mongoose-drift/issues with:
- Node.js version
- Mongoose version
- Minimal reproduction (model file + command that fails)
- Observed vs expected output
