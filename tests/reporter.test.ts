import { generateTextReport } from '../src/reporter';
import { DiffResult } from '../src/types';

describe('generateTextReport', () => {
  it('returns "no changes" message for empty diff', () => {
    const result: DiffResult = { collections: {} };
    const report = generateTextReport(result, 'v1', 'v2');
    expect(report).toContain('No schema changes detected');
    expect(report).toContain('v1');
    expect(report).toContain('v2');
  });

  it('reports added collection', () => {
    const result: DiffResult = {
      collections: {
        Payment: { type: 'added' },
      },
    };
    const report = generateTextReport(result, 'v1', 'v2');
    expect(report).toContain('Collection: Payment');
    expect(report).toContain('New collection detected');
  });

  it('reports removed collection', () => {
    const result: DiffResult = {
      collections: {
        OldModel: { type: 'removed' },
      },
    };
    const report = generateTextReport(result, 'v1', 'v2');
    expect(report).toContain('Collection: OldModel');
    expect(report).toContain('Collection removed');
  });

  it('reports modified collection with field changes', () => {
    const result: DiffResult = {
      collections: {
        User: {
          type: 'modified',
          changes: [
            { type: 'added', field: 'phone', after: { type: 'String' } },
            { type: 'removed', field: 'fax', before: { type: 'String' } },
            { type: 'modified', field: 'email', before: { type: 'String' }, after: { type: 'String', required: true } },
          ],
        },
      },
    };
    const report = generateTextReport(result, 'v1', 'v2');
    expect(report).toContain('Collection: User');
    expect(report).toContain('FIELD ADDED');
    expect(report).toContain('FIELD REMOVED');
    expect(report).toContain('MODIFIED');
    expect(report).toContain('phone');
    expect(report).toContain('fax');
    expect(report).toContain('email');
  });

  it('reports renamed field', () => {
    const result: DiffResult = {
      collections: {
        User: {
          type: 'modified',
          changes: [
            { type: 'renamed', field: 'fullName', renamedFrom: 'firstName' },
          ],
        },
      },
    };
    const report = generateTextReport(result, 'v1', 'v2');
    expect(report).toContain('RENAMED');
    expect(report).toContain('firstName');
    expect(report).toContain('fullName');
  });

  it('includes summary counts', () => {
    const result: DiffResult = {
      collections: {
        New1: { type: 'added' },
        New2: { type: 'added' },
        Old: { type: 'removed' },
        Changed: { type: 'modified', changes: [{ type: 'added', field: 'x', after: { type: 'String' } }] },
      },
    };
    const report = generateTextReport(result, 'v1', 'v2');
    expect(report).toContain('Summary:');
    expect(report).toContain('2 added');
    expect(report).toContain('1 removed');
    expect(report).toContain('1 modified');
  });

  it('includes version labels in header', () => {
    const result: DiffResult = {
      collections: {
        X: { type: 'added' },
      },
    };
    const report = generateTextReport(result, 'alpha', 'beta');
    expect(report).toContain('alpha');
    expect(report).toContain('beta');
  });

  it('handles modified collection with empty changes array', () => {
    const result: DiffResult = {
      collections: {
        Empty: { type: 'modified', changes: [] },
      },
    };
    // The diffSnapshots function normally wouldn't emit this, but the reporter should handle it
    const report = generateTextReport(result, 'v1', 'v2');
    expect(report).toContain('Collection: Empty');
  });

  it('handles complex multi-collection report', () => {
    const result: DiffResult = {
      collections: {
        User: {
          type: 'modified',
          changes: [
            { type: 'added', field: 'avatar', after: { type: 'String' } },
            { type: 'modified', field: 'name', before: { type: 'String' }, after: { type: 'String', required: true } },
          ],
        },
        Rent: {
          type: 'modified',
          changes: [
            { type: 'removed', field: 'oldProp', before: { type: 'Number' } },
          ],
        },
        NewService: { type: 'added' },
        Legacy: { type: 'removed' },
      },
    };

    const report = generateTextReport(result, '1.0.0', '2.0.0');
    expect(report).toContain('1.0.0');
    expect(report).toContain('2.0.0');
    expect(report).toContain('Collection: User');
    expect(report).toContain('Collection: Rent');
    expect(report).toContain('Collection: NewService');
    expect(report).toContain('Collection: Legacy');
    expect(report).toContain('1 added');
    expect(report).toContain('1 removed');
    expect(report).toContain('2 modified');
  });
});
