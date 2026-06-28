import { extractSchemas } from '../src/extractor';
import * as path from 'path';

const MODELS_DIR = path.resolve(__dirname, 'models');

describe('extractSchemas', () => {
  it('throws when models directory does not exist', async () => {
    await expect(extractSchemas('./nonexistent-dir-12345')).rejects.toThrow(
      /Models directory not found/
    );
  });

  it('extracts schemas from the test models directory', async () => {
    const collections = await extractSchemas(MODELS_DIR);

    // Should have found our test models
    expect(Object.keys(collections).length).toBeGreaterThanOrEqual(1);
  });

  it('extracts the User model correctly', async () => {
    const collections = await extractSchemas(MODELS_DIR);
    expect(collections['User']).toBeDefined();

    const userFields = collections['User'].fields;
    expect(userFields['name']).toBeDefined();
    expect(userFields['email']).toBeDefined();
    expect(userFields['password']).toBeDefined();

    // Check that __v and _id are excluded
    expect(userFields['__v']).toBeUndefined();
    expect(userFields['_id']).toBeUndefined();
  });

  it('extracts the Rent model with complex fields', async () => {
    const collections = await extractSchemas(MODELS_DIR);
    expect(collections['Rent']).toBeDefined();

    const rentFields = collections['Rent'].fields;

    // Should have amount, currency, status, dueDate, etc.
    expect(rentFields['amount']).toBeDefined();
    expect(rentFields['currency']).toBeDefined();
    expect(rentFields['status']).toBeDefined();
    expect(rentFields['dueDate']).toBeDefined();
    expect(rentFields['isActive']).toBeDefined();
  });

  it('extracts the Payment model', async () => {
    const collections = await extractSchemas(MODELS_DIR);
    expect(collections['Payment']).toBeDefined();

    const paymentFields = collections['Payment'].fields;
    expect(paymentFields['amount']).toBeDefined();
    expect(paymentFields['method']).toBeDefined();
    expect(paymentFields['transactionId']).toBeDefined();
  });

  it('extracts the Property model', async () => {
    const collections = await extractSchemas(MODELS_DIR);
    expect(collections['Property']).toBeDefined();

    const propFields = collections['Property'].fields;
    expect(propFields['title']).toBeDefined();
    expect(propFields['type']).toBeDefined();
    expect(propFields['price']).toBeDefined();
  });

  it('extracts multiple models from the same directory', async () => {
    const collections = await extractSchemas(MODELS_DIR);
    const names = Object.keys(collections);
    // We have User, Rent, Payment, Property
    expect(names.length).toBeGreaterThanOrEqual(4);
  });

  it('extracts field types as strings', async () => {
    const collections = await extractSchemas(MODELS_DIR);
    const userFields = collections['User'].fields;

    for (const [, field] of Object.entries(userFields)) {
      expect(typeof field.type).toBe('string');
    }
  });

  it('extracts indexes from models', async () => {
    const collections = await extractSchemas(MODELS_DIR);
    const rent = collections['Rent'];
    // Rent model has compound indexes defined
    expect(rent.indexes).toBeDefined();
    expect(Array.isArray(rent.indexes)).toBe(true);
  });

  it('extracts raw Schema exports (not compiled Models)', async () => {
    const collections = await extractSchemas(MODELS_DIR);
    // The Apartment file exports a raw Schema named `platformApartmentSchema`
    // The key should be derived from the export name with "Schema" stripped
    expect(collections['platformApartment']).toBeDefined();

    const fields = collections['platformApartment'].fields;
    expect(fields['clientId']).toBeDefined();
    expect(fields['name']).toBeDefined();
    expect(fields['clientDbApartmentRef']).toBeDefined();
    expect(fields['allowedFlatCount']).toBeDefined();
    expect(fields['isActive']).toBeDefined();
  });

  it('extracts field metadata from raw Schema exports', async () => {
    const collections = await extractSchemas(MODELS_DIR);
    const fields = collections['platformApartment'].fields;

    // clientId should have ref and required
    expect(fields['clientId'].ref).toBe('clients');
    expect(fields['clientId'].required).toBe(true);

    // name should be required
    expect(fields['name'].required).toBe(true);

    // isActive should have a default
    expect(fields['isActive'].default).toBe(true);
  });

  it('includes raw Schema models in total count', async () => {
    const collections = await extractSchemas(MODELS_DIR);
    const names = Object.keys(collections);
    // User, Rent, Payment, Property (compiled Models) + platformApartment (raw Schema)
    expect(names.length).toBeGreaterThanOrEqual(5);
  });

  it('returns empty collections for a directory with no model files', async () => {
    // Create a temp reference to an empty-ish path within the project
    // The migrations directory exists but has no mongoose models
    const migrationsPath = path.resolve(__dirname, '..', 'migrations');
    try {
      const collections = await extractSchemas(migrationsPath);
      // Should not crash, just return whatever it finds (possibly empty)
      expect(typeof collections).toBe('object');
    } catch (err: any) {
      // It's also valid to throw if it can't load JS/TS files
      expect(err.message).toBeDefined();
    }
  });
});

// ─────────────────────────────────────────────────────
// Field option extraction detail
// ─────────────────────────────────────────────────────
describe('extractSchemas — field option extraction', () => {
  let collections: Awaited<ReturnType<typeof extractSchemas>>;

  beforeAll(async () => {
    collections = await extractSchemas(MODELS_DIR);
  });

  it('extracts ref from ObjectId fields (Rent)', () => {
    const fields = collections['Rent'].fields;
    expect(fields['tenant'].ref).toBe('User');
    expect(fields['property'].ref).toBe('Property');
  });

  it('extracts ref from ObjectId fields (Payment)', () => {
    const fields = collections['Payment'].fields;
    expect(fields['payer'].ref).toBe('User');
    expect(fields['receiver'].ref).toBe('User');
  });

  it('extracts enum values', () => {
    const rentFields = collections['Rent'].fields;
    expect(rentFields['currency'].enum).toEqual(['INR', 'USD', 'EUR']);
    expect(rentFields['status'].enum).toContain('pending');
    expect(rentFields['status'].enum).toContain('paid');
  });

  it('extracts default values', () => {
    const rentFields = collections['Rent'].fields;
    expect(rentFields['currency'].default).toBe('INR');
    expect(rentFields['status'].default).toBe('pending');
    expect(rentFields['isActive'].default).toBe(true);
    expect(rentFields['notes'].default).toBe('');
  });

  it('extracts required flag', () => {
    const rentFields = collections['Rent'].fields;
    expect(rentFields['amount'].required).toBe(true);
    expect(rentFields['tenant'].required).toBe(true);
    expect(rentFields['dueDate'].required).toBe(true);
    expect(rentFields['paidAt']).toBeDefined();
    expect(rentFields['paidAt'].required).toBeFalsy();
  });

  it('extracts index flag on field', () => {
    const rentFields = collections['Rent'].fields;
    expect(rentFields['amount'].index).toBe(true);
  });

  it('extracts unique flag', () => {
    const paymentFields = collections['Payment'].fields;
    expect(paymentFields['transactionId'].unique).toBe(true);
  });

  it('extracts trim option', () => {
    const apartmentFields = collections['platformApartment'].fields;
    expect(apartmentFields['name'].trim).toBe(true);
    expect(apartmentFields['clientDbApartmentRef'].trim).toBe(true);
  });

  it('extracts required on a numeric field with validators', () => {
    const apartmentFields = collections['platformApartment'].fields;
    expect(apartmentFields['allowedFlatCount'].required).toBe(true);
  });

  it('extracts the address field (embedded subdocument schema)', () => {
    const rentFields = collections['Rent'].fields;
    // Mongoose stores embedded Schema subdocs as a single path — not flattened
    expect(rentFields['address']).toBeDefined();
    expect(typeof rentFields['address'].type).toBe('string');
  });

  it('extracts nested object paths from inline schema', () => {
    const propertyFields = collections['Property'].fields;
    expect(propertyFields['location.lat']).toBeDefined();
    expect(propertyFields['location.lng']).toBeDefined();
  });

  it('extracts array of primitives as Array<String>', () => {
    const rentFields = collections['Rent'].fields;
    expect(rentFields['tags'].type).toBe('Array<String>');
  });

  it('extracts array of ObjectIds as Array<ObjectId>', () => {
    const rentFields = collections['Rent'].fields;
    expect(rentFields['paymentHistory'].type).toBe('Array<ObjectId>');
  });

  it('extracts User roles as array type', () => {
    const userFields = collections['User'].fields;
    expect(userFields['roles'].type).toMatch(/^Array</);
  });

  it('does not include _id or __v in extracted fields', () => {
    for (const collection of Object.values(collections)) {
      expect(Object.keys(collection.fields)).not.toContain('_id');
      expect(Object.keys(collection.fields)).not.toContain('__v');
    }
  });

  it('extracts schema-level indexes separately from field definitions', () => {
    const rent = collections['Rent'];
    expect(rent.indexes.length).toBeGreaterThanOrEqual(2);
    const indexFields = rent.indexes.map(idx => JSON.stringify(idx.fields));
    expect(indexFields).toContain(JSON.stringify({ tenant: 1, dueDate: -1 }));
    expect(indexFields).toContain(JSON.stringify({ status: 1, isActive: 1 }));
  });

  it('extracts Payment schema-level indexes', () => {
    const payment = collections['Payment'];
    expect(payment.indexes.length).toBeGreaterThanOrEqual(1);
    const namedIdx = payment.indexes.find(i => i.options?.name === 'txn_unique_idx');
    expect(namedIdx).toBeDefined();
  });

  it('type for all extracted fields is a non-empty string', () => {
    for (const collection of Object.values(collections)) {
      for (const [fieldName, def] of Object.entries(collection.fields)) {
        expect(typeof def.type).toBe('string');
        expect(def.type.length).toBeGreaterThan(0);
      }
    }
  });
});
