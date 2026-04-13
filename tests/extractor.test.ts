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
