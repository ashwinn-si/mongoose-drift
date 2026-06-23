import {
  SchemaSnapshot,
  DiffResult,
  CollectionChange,
  FieldChange,
  FieldDefinition,
  IndexDefinition,
  IndexChange,
} from './types';

function fieldsAreDifferent(a: FieldDefinition, b: FieldDefinition): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

function diffCollection(
  before: Record<string, FieldDefinition>,
  after: Record<string, FieldDefinition>
): FieldChange[] {
  const changes: FieldChange[] = [];

  const allFields = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const field of allFields) {
    const inBefore = field in before;
    const inAfter = field in after;

    if (!inBefore && inAfter) {
      changes.push({ type: 'added', field, after: after[field] });
    } else if (inBefore && !inAfter) {
      changes.push({ type: 'removed', field, before: before[field] });
    } else if (inBefore && inAfter) {
      if (fieldsAreDifferent(before[field], after[field])) {
        changes.push({
          type: 'modified',
          field,
          before: before[field],
          after: after[field],
        });
      }
    }
  }

  return changes;
}

function diffIndexes(
  before: IndexDefinition[],
  after: IndexDefinition[]
): IndexChange[] {
  const serialize = (idx: IndexDefinition) => JSON.stringify(idx);
  const beforeSet = new Set(before.map(serialize));
  const afterSet = new Set(after.map(serialize));

  const changes: IndexChange[] = [];

  for (const idx of before) {
    if (!afterSet.has(serialize(idx))) {
      changes.push({ type: 'removed', fields: idx.fields, options: idx.options });
    }
  }

  for (const idx of after) {
    if (!beforeSet.has(serialize(idx))) {
      changes.push({ type: 'added', fields: idx.fields, options: idx.options });
    }
  }

  return changes;
}

export function detectPotentialRenames(
  changes: FieldChange[]
): Array<[string, string]> {
  const removed = changes.filter(c => c.type === 'removed');
  const added = changes.filter(c => c.type === 'added');
  const pairs: Array<[string, string]> = [];

  for (const rem of removed) {
    for (const add of added) {
      if (rem.before?.type === add.after?.type) {
        pairs.push([rem.field, add.field]);
      }
    }
  }

  return pairs;
}

export function diffSnapshots(
  before: SchemaSnapshot,
  after: SchemaSnapshot
): DiffResult {
  const result: DiffResult = { collections: {} };

  const allCollections = new Set([
    ...Object.keys(before.collections),
    ...Object.keys(after.collections),
  ]);

  for (const collectionName of allCollections) {
    const inBefore = collectionName in before.collections;
    const inAfter = collectionName in after.collections;

    if (!inBefore && inAfter) {
      result.collections[collectionName] = { type: 'added' };
      continue;
    }

    if (inBefore && !inAfter) {
      result.collections[collectionName] = { type: 'removed' };
      continue;
    }

    const fieldChanges = diffCollection(
      before.collections[collectionName].fields,
      after.collections[collectionName].fields
    );

    const indexChanges = diffIndexes(
      before.collections[collectionName].indexes,
      after.collections[collectionName].indexes
    );

    if (fieldChanges.length > 0 || indexChanges.length > 0) {
      const change: CollectionChange = { type: 'modified' };
      if (fieldChanges.length > 0) change.changes = fieldChanges;
      if (indexChanges.length > 0) change.indexChanges = indexChanges;
      result.collections[collectionName] = change;
    }
  }

  return result;
}
