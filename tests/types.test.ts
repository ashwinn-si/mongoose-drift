import {
  FieldDefinitionSchema,
  IndexDefinitionSchema,
  CollectionSchemaSchema,
  SchemaSnapshotSchema,
} from '../src/types';

// ─────────────────────────────────────────────────────
// FieldDefinitionSchema
// ─────────────────────────────────────────────────────
describe('FieldDefinitionSchema (Zod)', () => {
  it('validates a minimal field with only type', () => {
    const result = FieldDefinitionSchema.safeParse({ type: 'String' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ type: 'String' });
  });

  it('validates a fully populated field', () => {
    const input = {
      type: 'String',
      required: true,
      default: 'hello',
      ref: 'User',
      enum: ['a', 'b', 'c'],
      index: true,
      unique: false,
    };
    const result = FieldDefinitionSchema.safeParse(input);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(input);
  });

  it('allows extra unknown keys via catchall', () => {
    const input = { type: 'Number', customProp: 42, anotherProp: [1, 2] };
    const result = FieldDefinitionSchema.safeParse(input);
    expect(result.success).toBe(true);
    expect(result.data!.customProp).toBe(42);
  });

  it('rejects a field without the required "type" key', () => {
    const result = FieldDefinitionSchema.safeParse({ required: true });
    expect(result.success).toBe(false);
  });

  it('rejects a field with non-string type', () => {
    const result = FieldDefinitionSchema.safeParse({ type: 123 });
    expect(result.success).toBe(false);
  });

  it('validates enum with mixed types', () => {
    const input = { type: 'String', enum: ['active', 1, null, true] };
    const result = FieldDefinitionSchema.safeParse(input);
    expect(result.success).toBe(true);
    expect(result.data!.enum).toEqual(['active', 1, null, true]);
  });

  it('validates default with complex object', () => {
    const input = { type: 'Mixed', default: { nested: { deep: true }, list: [1, 2] } };
    const result = FieldDefinitionSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('treats optional booleans correctly', () => {
    const withRequired = FieldDefinitionSchema.safeParse({ type: 'String', required: true });
    const without = FieldDefinitionSchema.safeParse({ type: 'String' });
    expect(withRequired.data!.required).toBe(true);
    expect(without.data!.required).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────
// IndexDefinitionSchema
// ─────────────────────────────────────────────────────
describe('IndexDefinitionSchema (Zod)', () => {
  it('validates a basic ascending index', () => {
    const result = IndexDefinitionSchema.safeParse({ fields: { name: 1 } });
    expect(result.success).toBe(true);
  });

  it('validates a compound index with mixed directions', () => {
    const result = IndexDefinitionSchema.safeParse({
      fields: { tenant: 1, dueDate: -1 },
    });
    expect(result.success).toBe(true);
    expect(result.data!.fields).toEqual({ tenant: 1, dueDate: -1 });
  });

  it('validates text index', () => {
    const result = IndexDefinitionSchema.safeParse({
      fields: { description: 'text' },
    });
    expect(result.success).toBe(true);
  });

  it('validates index with options', () => {
    const result = IndexDefinitionSchema.safeParse({
      fields: { email: 1 },
      options: { unique: true, sparse: false, name: 'email_unique' },
    });
    expect(result.success).toBe(true);
    expect(result.data!.options!.unique).toBe(true);
    expect(result.data!.options!.name).toBe('email_unique');
  });

  it('rejects index with invalid field direction', () => {
    const result = IndexDefinitionSchema.safeParse({
      fields: { name: 2 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects index without fields', () => {
    const result = IndexDefinitionSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────
// CollectionSchemaSchema
// ─────────────────────────────────────────────────────
describe('CollectionSchemaSchema (Zod)', () => {
  it('validates a collection with fields and empty indexes', () => {
    const result = CollectionSchemaSchema.safeParse({
      fields: { name: { type: 'String' }, age: { type: 'Number' } },
      indexes: [],
    });
    expect(result.success).toBe(true);
    expect(Object.keys(result.data!.fields)).toHaveLength(2);
  });

  it('validates a collection with indexes', () => {
    const result = CollectionSchemaSchema.safeParse({
      fields: { email: { type: 'String', unique: true } },
      indexes: [{ fields: { email: 1 }, options: { unique: true } }],
    });
    expect(result.success).toBe(true);
    expect(result.data!.indexes).toHaveLength(1);
  });

  it('rejects collection missing fields', () => {
    const result = CollectionSchemaSchema.safeParse({ indexes: [] });
    expect(result.success).toBe(false);
  });

  it('rejects collection missing indexes', () => {
    const result = CollectionSchemaSchema.safeParse({
      fields: { name: { type: 'String' } },
    });
    expect(result.success).toBe(false);
  });

  it('validates collection with many complex fields', () => {
    const result = CollectionSchemaSchema.safeParse({
      fields: {
        name: { type: 'String', required: true },
        email: { type: 'String', unique: true, index: true },
        roles: { type: 'Array<String>' },
        ref: { type: 'ObjectId', ref: 'Other' },
        status: { type: 'String', enum: ['a', 'b'], default: 'a' },
      },
      indexes: [
        { fields: { name: 1, email: -1 } },
        { fields: { status: 1 }, options: { sparse: true } },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.data!.indexes).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────
// SchemaSnapshotSchema
// ─────────────────────────────────────────────────────
describe('SchemaSnapshotSchema (Zod)', () => {
  const validSnapshot = {
    version: '1.0.0',
    createdAt: '2025-01-01T00:00:00.000Z',
    modelsPath: './models',
    collections: {
      User: {
        fields: {
          name: { type: 'String', required: true },
          email: { type: 'String', unique: true },
        },
        indexes: [{ fields: { email: 1 }, options: { unique: true } }],
      },
    },
  };

  it('validates a complete snapshot', () => {
    const result = SchemaSnapshotSchema.safeParse(validSnapshot);
    expect(result.success).toBe(true);
    expect(result.data!.version).toBe('1.0.0');
  });

  it('validates a snapshot with empty collections', () => {
    const result = SchemaSnapshotSchema.safeParse({
      ...validSnapshot,
      collections: {},
    });
    expect(result.success).toBe(true);
  });

  it('validates a snapshot with multiple collections', () => {
    const result = SchemaSnapshotSchema.safeParse({
      ...validSnapshot,
      collections: {
        User: { fields: { name: { type: 'String' } }, indexes: [] },
        Rent: { fields: { amount: { type: 'Number' } }, indexes: [] },
        Payment: { fields: { total: { type: 'Number' } }, indexes: [] },
      },
    });
    expect(result.success).toBe(true);
    expect(Object.keys(result.data!.collections)).toHaveLength(3);
  });

  it('rejects snapshot without version', () => {
    const { version, ...noVersion } = validSnapshot;
    const result = SchemaSnapshotSchema.safeParse(noVersion);
    expect(result.success).toBe(false);
  });

  it('rejects snapshot without createdAt', () => {
    const { createdAt, ...noDate } = validSnapshot;
    const result = SchemaSnapshotSchema.safeParse(noDate);
    expect(result.success).toBe(false);
  });

  it('rejects snapshot without modelsPath', () => {
    const { modelsPath, ...noPath } = validSnapshot;
    const result = SchemaSnapshotSchema.safeParse(noPath);
    expect(result.success).toBe(false);
  });

  it('rejects snapshot with invalid collection schema', () => {
    const result = SchemaSnapshotSchema.safeParse({
      ...validSnapshot,
      collections: {
        User: { fields: { name: 'wrong' } }, // missing indexes, field not object
      },
    });
    expect(result.success).toBe(false);
  });
});
