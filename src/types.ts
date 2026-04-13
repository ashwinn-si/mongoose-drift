import { z } from 'zod';

// Define schemas to parse and validate snapshot JSON files robustly.

export const FieldDefinitionSchema = z.object({
  type: z.string(),
  required: z.boolean().optional(),
  default: z.unknown().optional(),
  ref: z.string().optional(),
  enum: z.array(z.unknown()).optional(),
  index: z.boolean().optional(),
  unique: z.boolean().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  trim: z.boolean().optional(),
  minlength: z.number().optional(),
  maxlength: z.number().optional(),
  select: z.boolean().optional(),
  immutable: z.boolean().optional(),
  sparse: z.boolean().optional(),
}).catchall(z.unknown());

export const IndexDefinitionSchema = z.object({
  fields: z.record(z.union([z.literal(1), z.literal(-1), z.literal('text')])),
  options: z.object({
    unique: z.boolean().optional(),
    sparse: z.boolean().optional(),
    name: z.string().optional(),
  }).optional(),
});

export const CollectionSchemaSchema = z.object({
  fields: z.record(FieldDefinitionSchema),
  indexes: z.array(IndexDefinitionSchema),
  options: z.record(z.unknown()).optional(),
});

export const SchemaSnapshotSchema = z.object({
  version: z.string(),
  createdAt: z.string(),
  modelsPath: z.string(),
  collections: z.record(CollectionSchemaSchema),
});

// Infer TS types from Zod schemas for internal type-safety

export type FieldDefinition = z.infer<typeof FieldDefinitionSchema>;
export type IndexDefinition = z.infer<typeof IndexDefinitionSchema>;
export type CollectionSchema = z.infer<typeof CollectionSchemaSchema>;
export type SchemaSnapshot = z.infer<typeof SchemaSnapshotSchema>;

// Diff Result Types (not validated against disk usually, so standard TS types are fine)

export type FieldChange = {
  type: 'added' | 'removed' | 'modified' | 'renamed';
  field: string;
  before?: FieldDefinition;
  after?: FieldDefinition;
  renamedFrom?: string;
};

export type CollectionChange = {
  type: 'added' | 'removed' | 'modified';
  changes?: FieldChange[];
};

export type DiffResult = {
  collections: Record<string, CollectionChange>;
};
