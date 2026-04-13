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
 * Normalize a raw Mongoose SchemaType into a plain FieldDefinition object.
 */
function normalizeField(rawField: unknown): FieldDefinition {
  if (typeof rawField === 'function') {
    return { type: rawField.name || 'Mixed' };
  }

  if (typeof rawField === 'object' && rawField !== null) {
    const field = rawField as Record<string, unknown>;
    
    // Arrays handling (e.g. { type: [String] } or [String])
    if (Array.isArray(rawField)) {
        if (rawField.length > 0 && typeof rawField[0] === 'function') {
             return { type: `Array<${rawField[0].name}>` };
        }
        return { type: 'Array' };
    }

    if (Array.isArray(field.type)) {
       const elType = typeof field.type[0] === 'function' ? (field.type[0] as Function).name : String(field.type[0] ?? 'Mixed');
       const result: FieldDefinition = { type: `Array<${elType}>` };
       if (field.required !== undefined) result.required = Boolean(field.required);
       return result;
    }

    const typeValue = field.type;
    const result: FieldDefinition = {
      type: typeof typeValue === 'function'
        ? (typeValue as Function).name
        : String(typeValue ?? 'Mixed')
    };

    if (field.required !== undefined) result.required = Boolean(field.required);
    if (field.default !== undefined) result.default = field.default;
    if (field.ref !== undefined) result.ref = String(field.ref);
    if (field.enum !== undefined) result.enum = field.enum as unknown[];
    if (field.index !== undefined) result.index = Boolean(field.index);
    if (field.unique !== undefined) result.unique = Boolean(field.unique);

    return result;
  }

  return { type: 'Mixed' };
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
      fields[pathName] = normalizeField(st.options ?? st.instance);
    }
  }

  if (schema._indexes) {
    for (const [indexFields, indexOptions] of schema._indexes) {
      indexes.push({ fields: indexFields, options: indexOptions });
    }
  }

  return { fields, indexes };
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

      if (exported?.schema?.paths) {
        const modelName = exported.modelName ?? path.basename(file, path.extname(file));
        collections[modelName] = extractFromSchema(exported.schema);
        continue;
      }

      for (const [key, value] of Object.entries(exported)) {
        const v = value as any;
        if (v?.schema?.paths) {
          collections[v.modelName ?? key] = extractFromSchema(v.schema);
        }
      }
    } catch (err) {
      console.warn(`⚠  Could not load model file: ${file}`);
      console.warn(`   Reason: ${(err as Error).message}`);
    }
  }

  return collections;
}
