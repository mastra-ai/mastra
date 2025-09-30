import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach, vi } from 'vitest';
import { VNextNetwork } from './vNextNetwork';

describe('VNextNetwork', () => {
  describe('stream', () => {
    let network: VNextNetwork;
    let onRecordSpy: ReturnType<typeof vi.fn>;
    let requestStub: ReturnType<typeof vi.spyOn>;

    const makeTestRecords = () => [
      { type: 'event1', data: 'test1' },
      { type: 'event2', data: 'test2' },
    ];

    const runStream = () => network.stream({ message: 'test message' }, onRecordSpy as any);

    const expectCallCountMatches = (spy: ReturnType<typeof vi.fn>, records: unknown[]) => {
      assert.strictEqual(spy.mock.calls.length, records.length);
    };

    beforeEach(() => {
      network = new VNextNetwork({ baseUrl: 'http://test.com' }, 'test-network-id');
      requestStub = vi.spyOn(network as any, 'request');
      onRecordSpy = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should parse string records from stream before passing to onRecord', async () => {
      // Arrange: Create test records and stub streamProcessor to yield strings
      const testRecords = makeTestRecords();
      const stringRecords = testRecords.map(record => JSON.stringify(record));

      vi.spyOn(network as any, 'streamProcessor').mockImplementation(async function* () {
        for (const rec of stringRecords) {
          yield rec as any;
        }
      });

      // Ensure request returns a successful response with a non-null body
      requestStub.mockResolvedValue(new Response('ok'));

      // Act: Call stream method
      await runStream();

      // Assert: Verify records were parsed and passed correctly
      expectCallCountMatches(onRecordSpy, testRecords);
      testRecords.forEach((record, index) => {
        const passedRecord = onRecordSpy.mock.calls[index][0];
        assert.deepStrictEqual(passedRecord, record);
      });
    });

    it('should pass object records from stream directly to onRecord without parsing', async () => {
      // Arrange: Create test records and stub streamProcessor to yield objects directly
      const testRecords = makeTestRecords();

      vi.spyOn(network as any, 'streamProcessor').mockImplementation(async function* () {
        for (const rec of testRecords) {
          yield rec as any;
        }
      });

      // Ensure request returns a successful response with a non-null body
      requestStub.mockResolvedValue(new Response('ok'));

      // Act: Call stream method
      await runStream();

      // Assert: Verify records were passed directly without modification
      expectCallCountMatches(onRecordSpy, testRecords);
      testRecords.forEach((record, index) => {
        const passedRecord = onRecordSpy.mock.calls[index][0];
        // Prove pass-through by reference equality
        assert.strictEqual(passedRecord, record);
        // And it should not be a string (ensuring no string parsing was required)
        assert.notStrictEqual(typeof passedRecord, 'string');
      });
    });
  });
});
