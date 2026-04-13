import * as fs from 'fs';
import * as path from 'path';
import { saveSnapshot, loadSnapshot, listSnapshots, saveConfig } from '../src/snapshot';

describe('Snapshot Module', () => {
  const testProject = '__test-snapshot-project__';
  const driftDir = path.resolve(process.cwd(), '.mongoose-drift', testProject);
  const modelsPath = path.resolve(__dirname, 'models');

  beforeAll(() => {
    // Ensure clean state
    if (fs.existsSync(driftDir)) {
      fs.rmSync(driftDir, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    // Cleanup
    if (fs.existsSync(driftDir)) {
      fs.rmSync(driftDir, { recursive: true, force: true });
    }
  });

  // ─────────────────────────────────────────────────────
  // saveConfig
  // ─────────────────────────────────────────────────────
  describe('saveConfig', () => {
    it('saves config.json with modelsPath', () => {
      saveConfig(modelsPath, testProject);
      const configPath = path.join(driftDir, 'config.json');
      expect(fs.existsSync(configPath)).toBe(true);

      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(config.modelsPath).toBe(modelsPath);
    });

    it('creates the project directory if it does not exist', () => {
      const uniqueProject = '__test-config-fresh__';
      const uniqueDir = path.resolve(process.cwd(), '.mongoose-drift', uniqueProject);

      if (fs.existsSync(uniqueDir)) {
        fs.rmSync(uniqueDir, { recursive: true, force: true });
      }

      saveConfig('./some/path', uniqueProject);
      expect(fs.existsSync(uniqueDir)).toBe(true);

      // Cleanup
      fs.rmSync(uniqueDir, { recursive: true, force: true });
    });
  });

  // ─────────────────────────────────────────────────────
  // saveSnapshot
  // ─────────────────────────────────────────────────────
  describe('saveSnapshot', () => {
    it('saves a valid snapshot file', async () => {
      const snapshot = await saveSnapshot({
        version: 'test-v1',
        modelsPath: modelsPath,
        project: testProject,
      });

      const filePath = path.join(driftDir, 'test-v1.json');
      expect(fs.existsSync(filePath)).toBe(true);
      expect(snapshot.version).toBe('test-v1');
      expect(Object.keys(snapshot.collections).length).toBeGreaterThanOrEqual(1);
    });

    it('throws when snapshot version already exists', async () => {
      await expect(
        saveSnapshot({
          version: 'test-v1',
          modelsPath: modelsPath,
          project: testProject,
        })
      ).rejects.toThrow(/already exists/);
    });

    it('saves snapshot with extractable schema data', async () => {
      const snapshot = await saveSnapshot({
        version: 'test-v2',
        modelsPath: modelsPath,
        project: testProject,
      });

      expect(snapshot.createdAt).toBeDefined();
      expect(snapshot.collections).toBeDefined();

      // Should have extracted our test models
      const names = Object.keys(snapshot.collections);
      expect(names.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─────────────────────────────────────────────────────
  // loadSnapshot
  // ─────────────────────────────────────────────────────
  describe('loadSnapshot', () => {
    it('loads a previously saved snapshot', async () => {
      const snapshot = await loadSnapshot('test-v1', testProject);
      expect(snapshot.version).toBe('test-v1');
      expect(snapshot.collections).toBeDefined();
    });

    it('throws for non-existent snapshot', async () => {
      await expect(
        loadSnapshot('nonexistent-version', testProject)
      ).rejects.toThrow(/Snapshot not found/);
    });

    it('loads HEAD snapshot from live models', async () => {
      const snapshot = await loadSnapshot('HEAD', testProject, modelsPath);
      expect(snapshot.version).toBe('HEAD');
      expect(Object.keys(snapshot.collections).length).toBeGreaterThanOrEqual(1);
    });

    it('throws when loading corrupted snapshot', async () => {
      // Write a malformed snapshot
      const corruptPath = path.join(driftDir, 'corrupt.json');
      fs.writeFileSync(corruptPath, JSON.stringify({ garbage: true }));

      await expect(loadSnapshot('corrupt', testProject)).rejects.toThrow(
        /corrupted/
      );

      // Cleanup
      fs.unlinkSync(corruptPath);
    });
  });

  // ─────────────────────────────────────────────────────
  // listSnapshots
  // ─────────────────────────────────────────────────────
  describe('listSnapshots', () => {
    it('lists previously saved snapshots', () => {
      const snapshots = listSnapshots(testProject);
      expect(snapshots).toContain('test-v1');
      expect(snapshots).toContain('test-v2');
    });

    it('excludes config.json from the list', () => {
      const snapshots = listSnapshots(testProject);
      expect(snapshots).not.toContain('config');
    });

    it('returns empty array for nonexistent project', () => {
      const snapshots = listSnapshots('nonexistent-project-xyz');
      expect(snapshots).toEqual([]);
    });

    it('returns snapshots in sorted order', () => {
      const snapshots = listSnapshots(testProject);
      const sorted = [...snapshots].sort();
      expect(snapshots).toEqual(sorted);
    });
  });
});
