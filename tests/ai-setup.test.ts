import * as fs from 'fs';
import * as path from 'path';
import { setupAI } from '../src/ai-setup';

const TEST_ROOT = path.resolve(process.cwd(), '__test-ai-setup__');

beforeEach(() => {
  if (fs.existsSync(TEST_ROOT)) fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  fs.mkdirSync(TEST_ROOT, { recursive: true });
});

afterEach(() => {
  if (fs.existsSync(TEST_ROOT)) fs.rmSync(TEST_ROOT, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────
// File creation
// ─────────────────────────────────────────────────────
describe('setupAI — file creation', () => {
  it('creates CLAUDE.md when it does not exist', () => {
    setupAI(TEST_ROOT);
    expect(fs.existsSync(path.join(TEST_ROOT, 'CLAUDE.md'))).toBe(true);
  });

  it('creates .cursorrules when it does not exist', () => {
    setupAI(TEST_ROOT);
    expect(fs.existsSync(path.join(TEST_ROOT, '.cursorrules'))).toBe(true);
  });

  it('creates .github/copilot-instructions.md', () => {
    setupAI(TEST_ROOT);
    expect(fs.existsSync(path.join(TEST_ROOT, '.github', 'copilot-instructions.md'))).toBe(true);
  });

  it('creates .windsurfrules', () => {
    setupAI(TEST_ROOT);
    expect(fs.existsSync(path.join(TEST_ROOT, '.windsurfrules'))).toBe(true);
  });

  it('creates gemini.md', () => {
    setupAI(TEST_ROOT);
    expect(fs.existsSync(path.join(TEST_ROOT, 'gemini.md'))).toBe(true);
  });

  it('creates .cursor/rules/mongoose-drift.mdc with MDC frontmatter', () => {
    setupAI(TEST_ROOT);
    const mdcPath = path.join(TEST_ROOT, '.cursor', 'rules', 'mongoose-drift.mdc');
    expect(fs.existsSync(mdcPath)).toBe(true);
    const content = fs.readFileSync(mdcPath, 'utf-8');
    expect(content).toContain('alwaysApply: true');
    expect(content).toContain('description:');
  });

  it('creates .augment/guidelines.md', () => {
    setupAI(TEST_ROOT);
    expect(fs.existsSync(path.join(TEST_ROOT, '.augment', 'guidelines.md'))).toBe(true);
  });

  it('creates intermediate directories for nested files', () => {
    setupAI(TEST_ROOT);
    expect(fs.existsSync(path.join(TEST_ROOT, '.github'))).toBe(true);
    expect(fs.existsSync(path.join(TEST_ROOT, '.cursor', 'rules'))).toBe(true);
    expect(fs.existsSync(path.join(TEST_ROOT, '.augment'))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────
// Content quality
// ─────────────────────────────────────────────────────
describe('setupAI — content', () => {
  it('includes the CLI commands table', () => {
    setupAI(TEST_ROOT);
    const content = fs.readFileSync(path.join(TEST_ROOT, 'CLAUDE.md'), 'utf-8');
    expect(content).toContain('mongoose-drift log');
    expect(content).toContain('mongoose-drift diff');
    expect(content).toContain('mongoose-drift show');
    expect(content).toContain('mongoose-drift snapshot');
  });

  it('explains HEAD in the content', () => {
    setupAI(TEST_ROOT);
    const content = fs.readFileSync(path.join(TEST_ROOT, 'CLAUDE.md'), 'utf-8');
    expect(content).toContain('HEAD');
  });

  it('mentions the --txt flag', () => {
    setupAI(TEST_ROOT);
    const content = fs.readFileSync(path.join(TEST_ROOT, 'CLAUDE.md'), 'utf-8');
    expect(content).toContain('--txt');
  });

  it('wraps injected block in mongoose-drift markers', () => {
    setupAI(TEST_ROOT);
    const content = fs.readFileSync(path.join(TEST_ROOT, 'CLAUDE.md'), 'utf-8');
    expect(content).toContain('<!-- mongoose-drift:start -->');
    expect(content).toContain('<!-- mongoose-drift:end -->');
  });

  it('mdc file contains the commands content (not just frontmatter)', () => {
    setupAI(TEST_ROOT);
    const mdcContent = fs.readFileSync(
      path.join(TEST_ROOT, '.cursor', 'rules', 'mongoose-drift.mdc'),
      'utf-8'
    );
    expect(mdcContent).toContain('mongoose-drift diff');
    expect(mdcContent).toContain('mongoose-drift log');
  });
});

// ─────────────────────────────────────────────────────
// Existing file handling — append and update
// ─────────────────────────────────────────────────────
describe('setupAI — existing file handling', () => {
  it('preserves existing content when appending to a file without markers', () => {
    const filePath = path.join(TEST_ROOT, 'CLAUDE.md');
    fs.writeFileSync(filePath, '# My existing instructions\n\nDo not touch this.\n');

    setupAI(TEST_ROOT);

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('My existing instructions');
    expect(content).toContain('Do not touch this.');
    expect(content).toContain('mongoose-drift');
  });

  it('does not duplicate the block on re-run', () => {
    setupAI(TEST_ROOT);
    setupAI(TEST_ROOT);

    const content = fs.readFileSync(path.join(TEST_ROOT, 'CLAUDE.md'), 'utf-8');
    const startCount = (content.match(/<!-- mongoose-drift:start -->/g) ?? []).length;
    expect(startCount).toBe(1);
  });

  it('replaces only the marker block on re-run, preserving surrounding content', () => {
    const filePath = path.join(TEST_ROOT, 'CLAUDE.md');
    fs.writeFileSync(
      filePath,
      '# Top section\n\n<!-- mongoose-drift:start -->\nold block content\n<!-- mongoose-drift:end -->\n\n## Bottom section\nkeep this too\n'
    );

    setupAI(TEST_ROOT);

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('Top section');
    expect(content).toContain('Bottom section');
    expect(content).toContain('keep this too');
    expect(content).not.toContain('old block content');
    expect(content).toContain('mongoose-drift log');
  });

  it('mdc file is always replaced (no marker logic) on re-run', () => {
    setupAI(TEST_ROOT);
    setupAI(TEST_ROOT);

    const mdcPath = path.join(TEST_ROOT, '.cursor', 'rules', 'mongoose-drift.mdc');
    const content = fs.readFileSync(mdcPath, 'utf-8');
    // alwaysApply should appear exactly once — no duplication from re-runs
    const alwaysApplyCount = (content.match(/alwaysApply: true/g) ?? []).length;
    expect(alwaysApplyCount).toBe(1);
  });
});

// ─────────────────────────────────────────────────────
// Snapshot discovery
// ─────────────────────────────────────────────────────
describe('setupAI — snapshot discovery', () => {
  it('includes known snapshot versions in content', () => {
    const driftDir = path.join(TEST_ROOT, '.mongoose-drift', 'myproject');
    fs.mkdirSync(driftDir, { recursive: true });
    fs.writeFileSync(path.join(driftDir, 'config.json'), JSON.stringify({ modelsPath: './models' }));
    fs.writeFileSync(path.join(driftDir, '1.0.0.json'), '{}');
    fs.writeFileSync(path.join(driftDir, '1.1.0.json'), '{}');

    setupAI(TEST_ROOT);

    const content = fs.readFileSync(path.join(TEST_ROOT, 'CLAUDE.md'), 'utf-8');
    expect(content).toContain('myproject');
    expect(content).toContain('1.0.0');
    expect(content).toContain('1.1.0');
  });

  it('does not list config.json as a snapshot version', () => {
    const driftDir = path.join(TEST_ROOT, '.mongoose-drift', 'default');
    fs.mkdirSync(driftDir, { recursive: true });
    fs.writeFileSync(path.join(driftDir, 'config.json'), JSON.stringify({ modelsPath: './models' }));
    fs.writeFileSync(path.join(driftDir, '1.0.0.json'), '{}');

    setupAI(TEST_ROOT);

    const content = fs.readFileSync(path.join(TEST_ROOT, 'CLAUDE.md'), 'utf-8');
    const configMatches = content.match(/\bconfig\b/g) ?? [];
    expect(configMatches).toHaveLength(0);
  });

  it('shows latest version label', () => {
    const driftDir = path.join(TEST_ROOT, '.mongoose-drift', 'app');
    fs.mkdirSync(driftDir, { recursive: true });
    fs.writeFileSync(path.join(driftDir, '1.0.0.json'), '{}');
    fs.writeFileSync(path.join(driftDir, '2.0.0.json'), '{}');
    fs.writeFileSync(path.join(driftDir, '3.0.0.json'), '{}');

    setupAI(TEST_ROOT);

    const content = fs.readFileSync(path.join(TEST_ROOT, 'CLAUDE.md'), 'utf-8');
    expect(content).toContain('latest');
    expect(content).toContain('3.0.0');
  });

  it('handles no .mongoose-drift directory gracefully', () => {
    expect(() => setupAI(TEST_ROOT)).not.toThrow();
    const content = fs.readFileSync(path.join(TEST_ROOT, 'CLAUDE.md'), 'utf-8');
    expect(content).toContain('mongoose-drift log');
  });

  it('handles multiple projects in .mongoose-drift', () => {
    for (const proj of ['auth', 'billing', 'inventory']) {
      const dir = path.join(TEST_ROOT, '.mongoose-drift', proj);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, '1.0.0.json'), '{}');
    }

    setupAI(TEST_ROOT);

    const content = fs.readFileSync(path.join(TEST_ROOT, 'CLAUDE.md'), 'utf-8');
    expect(content).toContain('auth');
    expect(content).toContain('billing');
    expect(content).toContain('inventory');
  });
});
