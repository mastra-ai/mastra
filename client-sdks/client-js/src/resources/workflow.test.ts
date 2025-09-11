import { TextDecoder } from 'util';
import { describe, it, expect } from 'vitest';
import { Workflow } from './workflow';

const RECORD_SEPARATOR = '\x1E';

describe('Workflow.createRecordStream', () => {
  // Helper to read entire stream contents as string
  async function readStreamToString(stream) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(decoder.decode(value, { stream: true }));
    }

    // Final decode to handle any remaining bytes
    chunks.push(decoder.decode());
    return chunks.join('');
  }

  it('should handle synchronous iterables correctly', async () => {
    // Arrange: Create sample objects and calculate expected output
    const records = [
      { id: 1, name: 'first' },
      { id: 2, name: 'second' },
    ];
    const expected = records.map(record => JSON.stringify(record)).join(RECORD_SEPARATOR) + RECORD_SEPARATOR;

    // Act: Create and read stream
    const stream = Workflow.createRecordStream(records);
    const output = await readStreamToString(stream);

    // Assert: Verify exact output match
    expect(output).toBe(expected);
  });

  it('should handle asynchronous iterables correctly', async () => {
    // Arrange: Create async generator function that yields test objects
    async function* generateRecords() {
      yield { id: 1, name: 'first' };
      yield { id: 2, name: 'second' };
      yield { id: 3, name: 'third' };
    }

    const expectedRecords = [
      { id: 1, name: 'first' },
      { id: 2, name: 'second' },
      { id: 3, name: 'third' },
    ];
    const expected = expectedRecords.map(record => JSON.stringify(record)).join(RECORD_SEPARATOR) + RECORD_SEPARATOR;

    // Act: Create and read stream
    const stream = Workflow.createRecordStream(generateRecords());
    const output = await readStreamToString(stream);

    // Assert: Verify output matches expected format
    expect(output).toBe(expected);
  });

  it('should handle empty iterables correctly', async () => {
    // Arrange: Create empty async generator
    async function* emptyGenerator() {}

    // Act: Create and read stream
    const stream = Workflow.createRecordStream(emptyGenerator());
    const output = await readStreamToString(stream);

    // Assert: Verify empty output and proper stream closure
    expect(output).toBe('');
  });

  it('should handle JSON.stringify errors properly', async () => {
    // Arrange: Create object with circular reference
    const circularObj = { id: 1 } as any;
    circularObj.self = circularObj;
    const records = [circularObj];

    // Act: Create stream and prepare for reading
    const stream = Workflow.createRecordStream(records);
    const reader = stream.getReader();
    const closePromise = reader.closed;

    // Assert: Verify error propagation
    await expect(reader.read()).rejects.toBeDefined();
    await expect(closePromise).rejects.toBeDefined();
    await expect(reader.read()).rejects.toBeDefined();
  });

  it('should handle iteration errors properly', async () => {
    // Arrange: Create async iterator that yields one record then throws
    async function* failingGenerator() {
      yield { id: 1 };
      throw new Error('Simulated iterator failure');
    }

    // Act & Assert: Create stream and verify error handling
    const stream = Workflow.createRecordStream(failingGenerator());

    // Verify that reading from the stream throws an error
    await expect(readStreamToString(stream)).rejects.toThrow('Simulated iterator failure');
  });
});
