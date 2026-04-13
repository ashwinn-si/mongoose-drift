import * as fs from 'fs';
import * as path from 'path';
import { extractSchemas } from '../src/extractor';
import { diffSnapshots, detectPotentialRenames } from '../src/diff';
import { generateTextReport } from '../src/reporter';
import { generateStub } from '../src/stub-generator';
import { SchemaSnapshot, SchemaSnapshotSchema } from '../src/types';

const MODELS_DIR = path.resolve(__dirname, 'models');

/**
 * End-to-end integration tests simulating a complete workflow:
 *   extract → snapshot → diff → report → migration stub
 */
describe('Integration: Full Pipeline', () => {
  const testProject = '__test-integration__';
  const migrationsDir = path.resolve(process.cwd(), 'migrations', testProject);

  afterAll(() => {
    if (fs.existsSync(migrationsDir)) {
      fs.rmSync(migrationsDir, { recursive: true, force: true });
    }
  });

  it('extracts → creates valid snapshot → diffs → generates report + stub', async () => {
    // ── Step 1: Extract schemas from live models ──
    const collections = await extractSchemas(MODELS_DIR);
    expect(Object.keys(collections).length).toBeGreaterThanOrEqual(4);

    // ── Step 2: Build a snapshot from extracted schemas ──
    const snapshot: SchemaSnapshot = {
      version: 'integration-v1',
      createdAt: new Date().toISOString(),
      modelsPath: MODELS_DIR,
      collections,
    };

    // Validate with Zod
    const validated = SchemaSnapshotSchema.safeParse(snapshot);
    expect(validated.success).toBe(true);

    // ── Step 3: Simulate a "before" state (remove some fields, add others) ──
    const beforeCollections = { ...collections };

    // Simulate removing the Payment collection entirely
    delete beforeCollections['Payment'];

    // Simulate the User model having fewer fields
    if (beforeCollections['User']) {
      const userFields = { ...beforeCollections['User'].fields };
      delete userFields['age']; // "age" didn't exist before
      beforeCollections['User'] = {
        ...beforeCollections['User'],
        fields: userFields,
      };
    }

    const beforeSnapshot: SchemaSnapshot = {
      version: 'integration-v0',
      createdAt: new Date().toISOString(),
      modelsPath: MODELS_DIR,
      collections: beforeCollections,
    };

    // ── Step 4: Diff the two snapshots ──
    const diff = diffSnapshots(beforeSnapshot, snapshot);

    // Payment should be detected as added
    expect(diff.collections['Payment']).toBeDefined();
    expect(diff.collections['Payment'].type).toBe('added');

    // User should be modified (age field added)
    if (diff.collections['User']) {
      expect(diff.collections['User'].type).toBe('modified');
      const userChanges = diff.collections['User'].changes!;
      const addedFields = userChanges.filter(c => c.type === 'added');
      expect(addedFields.length).toBeGreaterThanOrEqual(1);
    }

    // ── Step 5: Generate text report ──
    const report = generateTextReport(diff, 'integration-v0', 'integration-v1');
    expect(report).toContain('integration-v0');
    expect(report).toContain('integration-v1');
    expect(report).toContain('Summary:');
    // At least 1 added (Payment), possibly modified
    expect(report.length).toBeGreaterThan(50);

    // ── Step 6: Generate migration stub ──
    const stubPath = generateStub(diff, 'integration-v0', 'integration-v1', testProject);
    expect(fs.existsSync(stubPath)).toBe(true);
    const stubContent = fs.readFileSync(stubPath, 'utf-8');
    expect(stubContent).toContain('module.exports');
    expect(stubContent).toContain('async up(db)');
    expect(stubContent).toContain('async down(db)');
  });

  it('rename detection works in the pipeline', () => {
    // Simulate a scenario where a field is "renamed"
    const before: SchemaSnapshot = {
      version: 'rename-v1',
      createdAt: new Date().toISOString(),
      modelsPath: MODELS_DIR,
      collections: {
        User: {
          fields: {
            firstName: { type: 'String', required: true },
            email: { type: 'String' },
          },
          indexes: [],
        },
      },
    };

    const after: SchemaSnapshot = {
      version: 'rename-v2',
      createdAt: new Date().toISOString(),
      modelsPath: MODELS_DIR,
      collections: {
        User: {
          fields: {
            fullName: { type: 'String', required: true },
            email: { type: 'String' },
          },
          indexes: [],
        },
      },
    };

    const diff = diffSnapshots(before, after);
    expect(diff.collections['User'].type).toBe('modified');

    const changes = diff.collections['User'].changes!;
    expect(changes).toHaveLength(2); // 1 removed, 1 added

    const renames = detectPotentialRenames(changes);
    expect(renames).toHaveLength(1);
    expect(renames[0]).toEqual(['firstName', 'fullName']);

    // Verify the report includes both changes
    const report = generateTextReport(diff, 'rename-v1', 'rename-v2');
    expect(report).toContain('firstName');
    expect(report).toContain('fullName');
  });

  it('handles diff of identical extracted schemas', async () => {
    const collections = await extractSchemas(MODELS_DIR);

    const snapshot: SchemaSnapshot = {
      version: 'same',
      createdAt: new Date().toISOString(),
      modelsPath: MODELS_DIR,
      collections,
    };

    const diff = diffSnapshots(snapshot, snapshot);
    expect(Object.keys(diff.collections)).toHaveLength(0);

    const report = generateTextReport(diff, 'same', 'same');
    expect(report).toContain('No schema changes detected');
  });

  it('handles evolution scenario: collection added → fields modified → collection removed', () => {
    // Phase 1: Empty → collection added
    const empty: SchemaSnapshot = {
      version: 'evo-0',
      createdAt: new Date().toISOString(),
      modelsPath: MODELS_DIR,
      collections: {},
    };

    const phase1: SchemaSnapshot = {
      version: 'evo-1',
      createdAt: new Date().toISOString(),
      modelsPath: MODELS_DIR,
      collections: {
        Feature: {
          fields: { name: { type: 'String' }, enabled: { type: 'Boolean' } },
          indexes: [],
        },
      },
    };

    const diff1 = diffSnapshots(empty, phase1);
    expect(diff1.collections['Feature'].type).toBe('added');

    // Phase 2: Fields modified
    const phase2: SchemaSnapshot = {
      version: 'evo-2',
      createdAt: new Date().toISOString(),
      modelsPath: MODELS_DIR,
      collections: {
        Feature: {
          fields: {
            name: { type: 'String', required: true },  // modified
            enabled: { type: 'Boolean' },
            priority: { type: 'Number', default: 0 },   // added
          },
          indexes: [],
        },
      },
    };

    const diff2 = diffSnapshots(phase1, phase2);
    expect(diff2.collections['Feature'].type).toBe('modified');
    expect(diff2.collections['Feature'].changes!.length).toBe(2);

    // Phase 3: Collection removed
    const phase3: SchemaSnapshot = {
      version: 'evo-3',
      createdAt: new Date().toISOString(),
      modelsPath: MODELS_DIR,
      collections: {},
    };

    const diff3 = diffSnapshots(phase2, phase3);
    expect(diff3.collections['Feature'].type).toBe('removed');
  });

  it('stress test: diff with many collections and many fields', () => {
    const buildSnapshot = (prefix: string, count: number, fieldCount: number): SchemaSnapshot => {
      const collections: SchemaSnapshot['collections'] = {};
      for (let i = 0; i < count; i++) {
        const fields: Record<string, { type: string }> = {};
        for (let j = 0; j < fieldCount; j++) {
          fields[`${prefix}_field_${j}`] = { type: j % 2 === 0 ? 'String' : 'Number' };
        }
        collections[`${prefix}_Collection_${i}`] = { fields, indexes: [] };
      }
      return {
        version: `${prefix}-stress`,
        createdAt: new Date().toISOString(),
        modelsPath: MODELS_DIR,
        collections,
      };
    };

    const before = buildSnapshot('before', 50, 20);
    const after = buildSnapshot('after', 50, 20);

    // All 50 "before" collections should be removed, all 50 "after" should be added
    const diff = diffSnapshots(before, after);
    const entries = Object.entries(diff.collections);
    expect(entries.length).toBe(100);

    const removedCount = entries.filter(([, c]) => c.type === 'removed').length;
    const addedCount = entries.filter(([, c]) => c.type === 'added').length;
    expect(removedCount).toBe(50);
    expect(addedCount).toBe(50);
  });
});
