import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';
import { CollectionSchema, FieldDefinition } from './types';

// Conditionally require ts-node to handle TS model files at runtime if they exist
try {
  require('ts-node/register');
} catch (e) {
  // Ignore, ts-node not available
}

/**
 * Normalize a Mongoose SchemaType into a plain FieldDefinition object.
 */
function normalizeFieldFromPath(st: any): FieldDefinition {
  const options = st.options || {};
  
  // Prefer instance for the type name (e.g. 'ObjectId' instead of 'SchemaObjectId')
  let typeName = st.instance || 'Mixed';
  
  // Arrays handling
  if (typeName === 'Array') {
      let elType = 'Mixed';
      if (st.caster && st.caster.instance) {
          elType = st.caster.instance;
      } else if (st.embeddedSchemaType && st.embeddedSchemaType.instance) {
          elType = st.embeddedSchemaType.instance;
      } else if (st.schemaOptions && st.schemaOptions.type && Array.isArray(st.schemaOptions.type) && st.schemaOptions.type.length > 0) {
          const inner = st.schemaOptions.type[0];
          if (inner && inner.name) elType = inner.name;
          else if (typeof inner === 'string') elType = inner;
          else if (typeof inner === 'object' && inner.type && inner.type.name) elType = inner.type.name;
      } else if (Array.isArray(options.type) && options.type.length > 0) {
          const inner = options.type[0];
          if (inner && inner.name) elType = inner.name;
          else if (typeof inner === 'string') elType = inner;
          else if (typeof inner === 'object' && inner.type && inner.type.name) elType = inner.type.name;
      }
      typeName = `Array<${elType}>`;
  }

  const result: FieldDefinition = { type: typeName };

  if (options.required !== undefined) result.required = Boolean(options.required);
  if (options.default !== undefined) result.default = options.default;
  if (options.ref !== undefined) result.ref = String(options.ref);
  if (options.enum !== undefined) result.enum = options.enum as unknown[];
  if (options.index !== undefined) result.index = Boolean(options.index);
  if (options.unique !== undefined) result.unique = Boolean(options.unique);
  
  // Validation and other options
  if (options.min !== undefined) result.min = Number(options.min);
  if (options.max !== undefined) result.max = Number(options.max);
  if (options.trim !== undefined) result.trim = Boolean(options.trim);
  if (options.minlength !== undefined) result.minlength = Number(options.minlength);
  if (options.maxlength !== undefined) result.maxlength = Number(options.maxlength);
  if (options.select !== undefined) result.select = Boolean(options.select);
  if (options.immutable !== undefined) result.immutable = Boolean(options.immutable);
  if (options.sparse !== undefined) result.sparse = Boolean(options.sparse);

  return result;
}

/**
 * Extract fields and indexes from a Mongoose Schema object.
 */
function extractFromSchema(schema: any): CollectionSchema {
  const fields: Record<string, FieldDefinition> = {};
  const indexes: CollectionSchema['indexes'] = [];

  if (schema.paths) {
    for (const [pathName, schemaType] of Object.entries(schema.paths)) {
      if (pathName === '__v' || pathName === '_id') continue;
      const st = schemaType as any;
      fields[pathName] = normalizeFieldFromPath(st);
    }
  }

  if (schema._indexes) {
    for (const [indexFields, indexOptions] of schema._indexes) {
      indexes.push({ fields: indexFields, options: indexOptions });
    }
  }

  const result: CollectionSchema = { fields, indexes };
  
  if (schema.options) {
    const cleanOptions: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(schema.options)) {
      if (typeof v !== 'function') {
        cleanOptions[k] = v;
      }
    }
    result.options = cleanOptions;
  }

  return result;
}

/**
 * Load all model files from a directory and extract their schemas.
 */
export async function extractSchemas(
  modelsPath: string
): Promise<Record<string, CollectionSchema>> {
  const absolutePath = path.resolve(process.cwd(), modelsPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Models directory not found: ${absolutePath}`);
  }

  // Find all .ts and .js model files
  const files = await glob(`${absolutePath.replace(/\\/g, '/')}/**/*.{ts,js}`, {
    ignore: ['**/*.test.*', '**/*.spec.*', '**/index.*']
  });

  const collections: Record<string, CollectionSchema> = {};

  for (const file of files) {
    try {
      // Bust cache to ensure we read fresh definition
      delete require.cache[require.resolve(file)];
      const module = require(file);
      const exported = module.default ?? module;

      // Case 1: Default export is a compiled Model (model.schema.paths)
      if (exported?.schema?.paths) {
        const modelName = exported.modelName ?? path.basename(file, path.extname(file));
        collections[modelName] = extractFromSchema(exported.schema);
        continue;
      }

      // Case 2: Default export is a raw Schema (schema.paths)
      if (exported?.paths && typeof exported.path === 'function') {
        const modelName = path.basename(file, path.extname(file));
        collections[modelName] = extractFromSchema(exported);
        continue;
      }

      // Case 3: Named exports — check each for Model or raw Schema
      for (const [key, value] of Object.entries(exported)) {
        const v = value as any;
        if (v?.schema?.paths) {
          // Named export is a compiled Model
          collections[v.modelName ?? key] = extractFromSchema(v.schema);
        } else if (v?.paths && typeof v.path === 'function') {
          // Named export is a raw Schema
          const name = key.replace(/Schema$/i, '') || path.basename(file, path.extname(file));
          collections[name] = extractFromSchema(v);
        }
      }
    } catch (err) {
      console.warn(`⚠  Could not load model file: ${file}`);
      console.warn(`   Reason: ${(err as Error).message}`);
    }
  }

  return collections;
}
