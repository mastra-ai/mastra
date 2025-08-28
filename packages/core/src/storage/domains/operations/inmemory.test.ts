import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TABLE_MESSAGES, TABLE_WORKFLOW_SNAPSHOT, TABLE_EVALS } from '../../constants';
import { StoreOperationsInMemory } from './inmemory';

describe('StoreOperationsInMemory.batchInsert', () => {
  let store: StoreOperationsInMemory;

  beforeEach(() => {
    store = new StoreOperationsInMemory();
  });

  afterEach(() => {
    // Clear all tables to ensure test isolation
    Object.values(store.data).forEach(table => {
      table.clear();
    });
    vi.restoreAllMocks();
  });

  it('should preserve existing ids when records already have them', async () => {
    // Arrange: Create multiple test records with predefined IDs
    const records = [
      {
        id: 'existing-id-1',
        content: 'First message content',
        timestamp: 1234567890,
      },
      {
        id: 'existing-id-2',
        content: 'Second message content',
        timestamp: 1234567891,
      },
      {
        id: 'existing-id-3',
        content: 'Third message content',
        timestamp: 1234567892,
      },
    ];

    // Act: Insert records with predefined IDs
    await store.batchInsert({
      tableName: TABLE_MESSAGES,
      records,
    });

    // Assert: Verify records are stored with original IDs and content
    const messagesTable = store.data[TABLE_MESSAGES];

    // Verify total number of records
    expect(messagesTable.size).toBe(3);

    // Verify each record maintains its ID and content
    records.forEach(originalRecord => {
      const storedRecord = messagesTable.get(originalRecord.id);
      expect(storedRecord).toEqual(originalRecord);
    });

    // Additional verification that IDs weren't modified
    const storedIds = Array.from(messagesTable.keys());
    expect(storedIds).toEqual(['existing-id-1', 'existing-id-2', 'existing-id-3']);
  });

  it('should use run_id as id for workflow snapshots and evals tables when id is missing', async () => {
    // Arrange: Create records without ids but with run_ids
    const snapshotRecord = {
      run_id: 'run-123',
      data: 'snapshot data',
    };
    const evalRecord = {
      run_id: 'run-456',
      score: 0.95,
    };

    // Act: Insert records into respective tables
    await store.batchInsert({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      records: [snapshotRecord],
    });
    await store.batchInsert({
      tableName: TABLE_EVALS,
      records: [evalRecord],
    });

    // Assert: Verify records are stored with run_id as id
    const snapshotTable = store.data[TABLE_WORKFLOW_SNAPSHOT];
    const evalsTable = store.data[TABLE_EVALS];

    expect(snapshotTable.get('run-123')).toEqual({
      ...snapshotRecord,
      id: 'run-123',
    });
    expect(evalsTable.get('run-456')).toEqual({
      ...evalRecord,
      id: 'run-456',
    });
  });

  it('should generate unique auto-ids for records without ids', async () => {
    // Arrange: Mock Date.now and Math.random for predictable but unique IDs
    vi.spyOn(Date, 'now').mockReturnValueOnce(1234567890).mockReturnValueOnce(1234567891);
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.123456789).mockReturnValueOnce(0.987654321);

    const records = [{ content: 'message 1' }, { content: 'message 2' }];

    // Act: Insert records without ids
    await store.batchInsert({
      tableName: TABLE_MESSAGES,
      records,
    });

    // Assert: Verify auto-generated ids and stored records
    const messagesTable = store.data[TABLE_MESSAGES];
    const storedRecords = Array.from(messagesTable.values());

    // Verify we have exactly two records
    expect(storedRecords).toHaveLength(2);

    // Verify each record has a unique auto-generated id
    const ids = storedRecords.map(r => r.id);
    expect(new Set(ids).size).toBe(2);

    // Verify id format and record content
    storedRecords.forEach((record, index) => {
      expect(record.id).toMatch(/^auto-\d+-0\.\d+$/);
      expect(record.content).toBe(`message ${index + 1}`);
    });
  });

  it('should auto-generate ids for workflow snapshots and evals when neither id nor run_id exists', async () => {
    // Arrange: Mock Date.now and Math.random for predictable IDs
    vi.spyOn(Date, 'now').mockReturnValue(1234567890); // Return same timestamp for both calls
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.123).mockReturnValueOnce(0.456);

    const snapshotRecords = [{ data: 'snapshot data 1' }, { data: 'snapshot data 2' }];
    const evalRecords = [{ score: 0.95 }, { score: 0.85 }];

    // Act: Insert records without ids or run_ids
    await store.batchInsert({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      records: snapshotRecords,
    });
    await store.batchInsert({
      tableName: TABLE_EVALS,
      records: evalRecords,
    });

    // Assert: Verify auto-generated ids and stored records
    const snapshotTable = store.data[TABLE_WORKFLOW_SNAPSHOT];
    const evalsTable = store.data[TABLE_EVALS];

    // Verify record counts
    expect(snapshotTable.size).toBe(2);
    expect(evalsTable.size).toBe(2);

    // Get all stored records
    const storedSnapshotRecords = Array.from(snapshotTable.values());
    const storedEvalRecords = Array.from(evalsTable.values());

    // Verify ID format and uniqueness for snapshots
    const snapshotIds = storedSnapshotRecords.map(r => r.id);
    expect(snapshotIds[0]).toBe('auto-1234567890-0.123');
    expect(snapshotIds[1]).toBe('auto-1234567890-0.456');
    expect(new Set(snapshotIds).size).toBe(2);

    // Verify record content matches
    expect(storedSnapshotRecords[0].data).toBe('snapshot data 1');
    expect(storedSnapshotRecords[1].data).toBe('snapshot data 2');
    expect(storedEvalRecords[0].score).toBe(0.95);
    expect(storedEvalRecords[1].score).toBe(0.85);
  });

  it('should handle empty records array without errors', async () => {
    // Arrange: Insert initial data to verify state preservation
    const initialRecord = { id: 'test-1', content: 'initial data' };
    await store.batchInsert({
      tableName: TABLE_MESSAGES,
      records: [initialRecord],
    });

    const initialTableSize = store.data[TABLE_MESSAGES].size;
    const initialRecord2 = store.data[TABLE_MESSAGES].get('test-1');

    // Act: Insert empty records array
    await store.batchInsert({
      tableName: TABLE_MESSAGES,
      records: [],
    });

    // Assert: Verify table state remains unchanged
    expect(store.data[TABLE_MESSAGES].size).toBe(initialTableSize);
    expect(store.data[TABLE_MESSAGES].get('test-1')).toEqual(initialRecord2);
  });
});
