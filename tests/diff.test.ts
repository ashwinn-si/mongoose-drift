import { diffSnapshots, detectPotentialRenames } from '../src/diff';
import { SchemaSnapshot, FieldChange } from '../src/types';

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────
const makeSnapshot = (collections: SchemaSnapshot['collections']): SchemaSnapshot => ({
  version: 'test',
  createdAt: new Date().toISOString(),
  modelsPath: './models',
  collections,
});

// ─────────────────────────────────────────────────────
// diffSnapshots — core field operations
// ─────────────────────────────────────────────────────
describe('diffSnapshots', () => {
  it('detects added field', () => {
    const before = makeSnapshot({
      Rent: { fields: { amount: { type: 'Number' } }, indexes: [] },
    });
    const after = makeSnapshot({
      Rent: { fields: { amount: { type: 'Number' }, dueDate: { type: 'Date' } }, indexes: [] },
    });

    const result = diffSnapshots(before, after);
    const changes = result.collections['Rent'].changes!;

    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('added');
    expect(changes[0].field).toBe('dueDate');
  });

  it('detects removed field', () => {
    const before = makeSnapshot({
      Rent: { fields: { amount: { type: 'Number' }, previousDues: { type: 'Number' } }, indexes: [] },
    });
    const after = makeSnapshot({
      Rent: { fields: { amount: { type: 'Number' } }, indexes: [] },
    });

    const result = diffSnapshots(before, after);
    const changes = result.collections['Rent'].changes!;

    expect(changes[0].type).toBe('removed');
    expect(changes[0].field).toBe('previousDues');
  });

  it('detects modified field (type change)', () => {
    const before = makeSnapshot({
      Rent: { fields: { amount: { type: 'Number' } }, indexes: [] },
    });
    const after = makeSnapshot({
      Rent: { fields: { amount: { type: 'String' } }, indexes: [] },
    });

    const result = diffSnapshots(before, after);
    const changes = result.collections['Rent'].changes!;

    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('modified');
    expect(changes[0].field).toBe('amount');
    expect(changes[0].before).toEqual({ type: 'Number' });
    expect(changes[0].after).toEqual({ type: 'String' });
  });

  it('detects modified field (property change, not type)', () => {
    const before = makeSnapshot({
      User: { fields: { email: { type: 'String', required: false } }, indexes: [] },
    });
    const after = makeSnapshot({
      User: { fields: { email: { type: 'String', required: true, unique: true } }, indexes: [] },
    });

    const result = diffSnapshots(before, after);
    const changes = result.collections['User'].changes!;

    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('modified');
    expect(changes[0].after).toEqual({ type: 'String', required: true, unique: true });
  });

  it('detects new collection', () => {
    const before = makeSnapshot({});
    const after = makeSnapshot({
      Payment: { fields: { amount: { type: 'Number' } }, indexes: [] },
    });

    const result = diffSnapshots(before, after);
    expect(result.collections['Payment'].type).toBe('added');
  });

  it('detects removed collection', () => {
    const before = makeSnapshot({
      OldModel: { fields: { data: { type: 'String' } }, indexes: [] },
    });
    const after = makeSnapshot({});

    const result = diffSnapshots(before, after);
    expect(result.collections['OldModel'].type).toBe('removed');
  });

  it('returns empty result when no changes', () => {
    const snapshot = makeSnapshot({
      Rent: { fields: { amount: { type: 'Number' } }, indexes: [] },
    });

    const result = diffSnapshots(snapshot, snapshot);
    expect(Object.keys(result.collections)).toHaveLength(0);
  });

  // ─────────────────────────────────────────────────────
  // Complex multi-collection scenarios
  // ─────────────────────────────────────────────────────
  it('handles simultaneous add, remove, and modify across multiple collections', () => {
    const before = makeSnapshot({
      User: {
        fields: {
          name: { type: 'String' },
          email: { type: 'String' },
          oldField: { type: 'Number' },
        },
        indexes: [],
      },
      LegacyModel: {
        fields: { data: { type: 'String' } },
        indexes: [],
      },
    });

    const after = makeSnapshot({
      User: {
        fields: {
          name: { type: 'String' },
          email: { type: 'String', required: true },  // modified
          newField: { type: 'Date' },                  // added
          // oldField removed
        },
        indexes: [],
      },
      // LegacyModel removed
      NewService: {                                      // new collection
        fields: { endpoint: { type: 'String' } },
        indexes: [],
      },
    });

    const result = diffSnapshots(before, after);

    // User was modified
    expect(result.collections['User'].type).toBe('modified');
    const userChanges = result.collections['User'].changes!;
    expect(userChanges).toHaveLength(3);

    const types = userChanges.map(c => c.type).sort();
    expect(types).toEqual(['added', 'modified', 'removed']);

    // LegacyModel was removed
    expect(result.collections['LegacyModel'].type).toBe('removed');

    // NewService was added
    expect(result.collections['NewService'].type).toBe('added');
  });

  it('detects changes in field with ref property', () => {
    const before = makeSnapshot({
      Order: {
        fields: { customer: { type: 'ObjectId', ref: 'User' } },
        indexes: [],
      },
    });
    const after = makeSnapshot({
      Order: {
        fields: { customer: { type: 'ObjectId', ref: 'Customer' } },
        indexes: [],
      },
    });

    const result = diffSnapshots(before, after);
    const changes = result.collections['Order'].changes!;
    expect(changes[0].type).toBe('modified');
    expect(changes[0].before!.ref).toBe('User');
    expect(changes[0].after!.ref).toBe('Customer');
  });

  it('detects changes in enum values', () => {
    const before = makeSnapshot({
      Status: {
        fields: { value: { type: 'String', enum: ['active', 'inactive'] } },
        indexes: [],
      },
    });
    const after = makeSnapshot({
      Status: {
        fields: { value: { type: 'String', enum: ['active', 'inactive', 'suspended'] } },
        indexes: [],
      },
    });

    const result = diffSnapshots(before, after);
    expect(result.collections['Status'].changes![0].type).toBe('modified');
  });

  it('detects changes in default values', () => {
    const before = makeSnapshot({
      Config: {
        fields: { retries: { type: 'Number', default: 3 } },
        indexes: [],
      },
    });
    const after = makeSnapshot({
      Config: {
        fields: { retries: { type: 'Number', default: 5 } },
        indexes: [],
      },
    });

    const result = diffSnapshots(before, after);
    expect(result.collections['Config'].changes![0].type).toBe('modified');
    expect(result.collections['Config'].changes![0].before!.default).toBe(3);
    expect(result.collections['Config'].changes![0].after!.default).toBe(5);
  });

  it('handles a collection with many fields where only one changes', () => {
    const fields = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`field${i}`, { type: 'String' }])
    );

    const before = makeSnapshot({ Big: { fields, indexes: [] } });
    const afterFields = { ...fields, field10: { type: 'Number' } };
    const after = makeSnapshot({ Big: { fields: afterFields, indexes: [] } });

    const result = diffSnapshots(before, after);
    expect(result.collections['Big'].changes!).toHaveLength(1);
    expect(result.collections['Big'].changes![0].field).toBe('field10');
  });

  it('correctly reports before and after on added fields', () => {
    const before = makeSnapshot({
      X: { fields: {}, indexes: [] },
    });
    const after = makeSnapshot({
      X: { fields: { foo: { type: 'Boolean', default: false } }, indexes: [] },
    });

    const result = diffSnapshots(before, after);
    const change = result.collections['X'].changes![0];
    expect(change.type).toBe('added');
    expect(change.before).toBeUndefined();
    expect(change.after).toEqual({ type: 'Boolean', default: false });
  });

  it('correctly reports before and after on removed fields', () => {
    const before = makeSnapshot({
      X: { fields: { foo: { type: 'String', required: true } }, indexes: [] },
    });
    const after = makeSnapshot({
      X: { fields: {}, indexes: [] },
    });

    const result = diffSnapshots(before, after);
    const change = result.collections['X'].changes![0];
    expect(change.type).toBe('removed');
    expect(change.before).toEqual({ type: 'String', required: true });
    expect(change.after).toBeUndefined();
  });

  it('detects no changes when identical complex schemas', () => {
    const complexFields = {
      name: { type: 'String', required: true },
      email: { type: 'String', unique: true, index: true },
      ref: { type: 'ObjectId', ref: 'Other' },
      status: { type: 'String', enum: ['active', 'inactive'], default: 'active' },
      count: { type: 'Number', default: 0 },
    };

    const snapshot = makeSnapshot({
      Complex: { fields: complexFields, indexes: [] },
    });

    const result = diffSnapshots(snapshot, snapshot);
    expect(Object.keys(result.collections)).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────
// detectPotentialRenames
// ─────────────────────────────────────────────────────
describe('detectPotentialRenames', () => {
  it('detects a rename when removed and added have same type', () => {
    const changes: FieldChange[] = [
      { type: 'removed', field: 'firstName', before: { type: 'String' } },
      { type: 'added', field: 'fullName', after: { type: 'String' } },
    ];

    const renames = detectPotentialRenames(changes);
    expect(renames).toHaveLength(1);
    expect(renames[0]).toEqual(['firstName', 'fullName']);
  });

  it('returns empty when types differ', () => {
    const changes: FieldChange[] = [
      { type: 'removed', field: 'oldField', before: { type: 'String' } },
      { type: 'added', field: 'newField', after: { type: 'Number' } },
    ];

    expect(detectPotentialRenames(changes)).toHaveLength(0);
  });

  it('returns empty when no removed/added pairs', () => {
    const changes: FieldChange[] = [
      { type: 'modified', field: 'amount', before: { type: 'Number' }, after: { type: 'Number', required: true } },
    ];

    expect(detectPotentialRenames(changes)).toHaveLength(0);
  });

  it('returns empty for empty changes', () => {
    expect(detectPotentialRenames([])).toHaveLength(0);
  });

  it('detects multiple potential renames', () => {
    const changes: FieldChange[] = [
      { type: 'removed', field: 'oldA', before: { type: 'String' } },
      { type: 'removed', field: 'oldB', before: { type: 'Number' } },
      { type: 'added', field: 'newA', after: { type: 'String' } },
      { type: 'added', field: 'newB', after: { type: 'Number' } },
    ];

    const renames = detectPotentialRenames(changes);
    expect(renames).toHaveLength(2);
  });

  it('creates cartesian product when multiple removals match one add', () => {
    const changes: FieldChange[] = [
      { type: 'removed', field: 'a', before: { type: 'String' } },
      { type: 'removed', field: 'b', before: { type: 'String' } },
      { type: 'added', field: 'c', after: { type: 'String' } },
    ];

    const renames = detectPotentialRenames(changes);
    // Both a -> c and b -> c are potential renames
    expect(renames).toHaveLength(2);
    expect(renames).toContainEqual(['a', 'c']);
    expect(renames).toContainEqual(['b', 'c']);
  });

  it('ignores modified changes in detection', () => {
    const changes: FieldChange[] = [
      { type: 'modified', field: 'x', before: { type: 'String' }, after: { type: 'String', required: true } },
      { type: 'removed', field: 'y', before: { type: 'Date' } },
      { type: 'added', field: 'z', after: { type: 'Date' } },
    ];

    const renames = detectPotentialRenames(changes);
    expect(renames).toHaveLength(1);
    expect(renames[0]).toEqual(['y', 'z']);
  });
});
