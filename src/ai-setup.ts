import * as fs from 'fs';
import * as path from 'path';

const MARKER_START = '<!-- mongoose-drift:start -->';
const MARKER_END = '<!-- mongoose-drift:end -->';

function buildContent(projectRoot: string): string {
  const snapshotInfo = discoverSnapshots(projectRoot);

  return [
    '## mongoose-drift — Mongoose Schema Versioning',
    '',
    'This project uses [mongoose-drift](https://github.com/ashwinn-si/mongoose-drift) to version and diff Mongoose schemas.',
    'Snapshots live in `.mongoose-drift/` as JSON files — each records every collection\'s fields, types, indexes, and options.',
    '',
    '### Commands',
    '',
    '| Command | Purpose |',
    '|---------|---------|',
    '| `npx mongoose-drift log [-p <project>]` | List all saved schema snapshots |',
    '| `npx mongoose-drift show <version> [-p <project>]` | Print full schema for a snapshot as JSON |',
    '| `npx mongoose-drift diff <from> HEAD [-p <project>]` | Compare a snapshot to the current live schema |',
    '| `npx mongoose-drift diff <from> HEAD --json [-p <project>]` | Same diff as machine-readable JSON |',
    '| `npx mongoose-drift diff <from> HEAD --txt [-p <project>]` | Export diff as a text file (useful for writing migrations) |',
    '| `npx mongoose-drift snapshot --version <v> [-p <project>]` | Save current schema state |',
    '| `npx mongoose-drift diff <from> <to> --stub [-p <project>]` | Generate a `migrate-mongo` migration stub |',
    '| `npx mongoose-drift setup-ai` | Refresh these AI instruction files after adding snapshots |',
    '',
    '### Notes for AI agents',
    '',
    '- `HEAD` means "the live schema right now" — reads model files on disk, no snapshot needed.',
    '- `npx mongoose-drift show <version> --json` outputs a JSON object keyed by collection name.',
    '  Each collection has `fields` (record of fieldName → `{type, required?, default?, ref?, enum?, ...}`)',
    '  and `indexes` (array of `{fields: {fieldName: 1|-1|"text"}, options?}`).',
    '- Use `--json` flag when you need to parse diff output programmatically.',
    '- Use `--txt` to produce a plain-text migration guide you can read and act on.',
    '- Field types use Mongoose instance names: `String`, `Number`, `Boolean`, `Date`, `ObjectId`,',
    '  `Array<String>`, `Mixed`, etc.',
    '',
    '### How to inspect the schema',
    '',
    '1. Run `npx mongoose-drift log` to see available snapshots.',
    '2. Run `npx mongoose-drift show <latest-version>` to read field definitions.',
    '3. Run `npx mongoose-drift diff <latest-version> HEAD` to see uncommitted changes.',
    '',
    snapshotInfo,
  ]
    .filter(line => line !== null && line !== undefined)
    .join('\n')
    .trimEnd();
}

function discoverSnapshots(projectRoot: string): string {
  const driftDir = path.join(projectRoot, '.mongoose-drift');
  if (!fs.existsSync(driftDir)) return '';

  const projects = fs.readdirSync(driftDir).filter(f =>
    fs.statSync(path.join(driftDir, f)).isDirectory()
  );

  if (projects.length === 0) return '';

  const lines: string[] = ['### Known snapshots', ''];
  for (const project of projects) {
    try {
      const projectDir = path.join(driftDir, project);
      const snapshots = fs
        .readdirSync(projectDir)
        .filter(f => f.endsWith('.json') && f !== 'config.json')
        .map(f => f.replace('.json', ''))
        .sort();
      if (snapshots.length > 0) {
        const latest = snapshots[snapshots.length - 1];
        lines.push(`- **${project}**: ${snapshots.join(', ')} _(latest: \`${latest}\`)_`);
      }
    } catch {
      // skip unreadable project dirs
    }
  }

  return lines.length > 2 ? lines.join('\n') : '';
}

function upsertBlock(existing: string, block: string): string {
  const start = existing.indexOf(MARKER_START);
  const end = existing.indexOf(MARKER_END);

  if (start !== -1 && end !== -1 && end > start) {
    return (
      existing.slice(0, start) +
      block +
      existing.slice(end + MARKER_END.length)
    );
  }

  const sep = existing.length > 0 ? (existing.endsWith('\n\n') ? '' : existing.endsWith('\n') ? '\n' : '\n\n') : '';
  return existing + sep + block + '\n';
}

function writeAgentFile(filePath: string, content: string, replace = false): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (replace) {
    fs.writeFileSync(filePath, content + '\n');
    return;
  }

  const block = `${MARKER_START}\n${content}\n${MARKER_END}`;
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf-8');
    fs.writeFileSync(filePath, upsertBlock(existing, block));
  } else {
    fs.writeFileSync(filePath, block + '\n');
  }
}

export function setupAI(projectRoot: string): void {
  const content = buildContent(projectRoot);

  const results: Array<{ file: string; status: 'created' | 'updated' | 'error'; error?: string }> = [];

  const targets: Array<{ rel: string; replace?: boolean; transform?: (c: string) => string }> = [
    { rel: 'CLAUDE.md' },
    { rel: '.cursorrules' },
    { rel: '.github/copilot-instructions.md' },
    { rel: '.windsurfrules' },
    { rel: '.augment/guidelines.md' },
    { rel: 'gemini.md' },
    {
      rel: '.cursor/rules/mongoose-drift.mdc',
      replace: true,
      transform: c => [
        '---',
        'description: mongoose-drift Mongoose schema versioning rules',
        'alwaysApply: true',
        '---',
        '',
        c,
      ].join('\n'),
    },
  ];

  for (const target of targets) {
    const filePath = path.join(projectRoot, target.rel);
    try {
      const existed = fs.existsSync(filePath);
      const finalContent = target.transform ? target.transform(content) : content;
      writeAgentFile(filePath, finalContent, target.replace);
      results.push({ file: target.rel, status: existed ? 'updated' : 'created' });
    } catch (err: any) {
      results.push({ file: target.rel, status: 'error', error: err.message });
    }
  }

  console.log('\nmongoose-drift: AI agent instruction files ready.');
  for (const r of results) {
    if (r.status === 'error') {
      console.warn(`  ⚠  ${r.file} — ${r.error}`);
    } else {
      console.log(`  ✔ ${r.file} (${r.status})`);
    }
  }
  console.log('  Run "npx mongoose-drift setup-ai" after adding snapshots to refresh.\n');
}
