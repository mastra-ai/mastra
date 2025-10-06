import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { MastraError, ErrorCategory, ErrorDomain } from '../../../error';
import type { AISpanRecord } from '../../types';
import type { StoreOperations } from '../operations';
import { ObservabilityInMemory } from './inmemory';
import type { InMemoryObservability } from './inmemory';

describe('ObservabilityInMemory', () => {
  describe('updateAISpan', () => {
    let observability: ObservabilityInMemory;
    let collection: InMemoryObservability;
    let operations: StoreOperations;

    beforeEach(() => {
      collection = new Map();
      operations = {} as StoreOperations;
      observability = new ObservabilityInMemory({ collection, operations });
    });

    afterEach(() => {
      collection.clear();
    });

    it('throws MastraError when updating a non-existent span', async () => {
      const nonExistentSpanId = 'non-existent-span';
      const nonExistentTraceId = 'non-existent-trace';
      const updates = { name: 'Updated Name' };

      let thrown: unknown;
      try {
        await observability.updateAISpan({
          spanId: nonExistentSpanId,
          traceId: nonExistentTraceId,
          updates,
        });
      } catch (err) {
        thrown = err;
      }

      expect(thrown).toBeInstanceOf(MastraError);
      const e = thrown as MastraError;
      expect(e.id).toBe('OBSERVABILITY_UPDATE_AI_SPAN_NOT_FOUND');
      expect(e.domain).toBe(ErrorDomain.MASTRA_OBSERVABILITY);
      expect(e.category).toBe(ErrorCategory.SYSTEM);
      // message is the runtime-accessible field for the error text
      expect(e.message).toBe('Span not found for update');

      expect(collection.size).toBe(0);
    });

    it('successfully updates an existing span with partial updates', async () => {
      // Arrange
      const baseSpan: AISpanRecord = {
        spanId: 'test-span-id',
        traceId: 'test-trace-id',
        parentSpanId: null,
        name: 'Original Name',
        spanType: 'test',
        startedAt: new Date('2024-01-01'),
        endedAt: new Date('2024-01-02'),
        attributes: {
          originalKey: 'original value',
        },
      };

      const id = `${baseSpan.traceId}-${baseSpan.spanId}`;
      collection.set(id, baseSpan);

      const updates = {
        name: 'Updated Name',
        attributes: {
          newKey: 'new value',
        },
      };

      // Act
      await observability.updateAISpan({
        spanId: baseSpan.spanId,
        traceId: baseSpan.traceId,
        updates,
      });

      // Assert
      const updatedSpan = collection.get(id);
      expect(updatedSpan).toBeDefined();
      expect(updatedSpan?.name).toBe('Updated Name');
      expect(updatedSpan?.attributes).toEqual({
        newKey: 'new value',
      });
      // Verify unchanged fields remain the same
      expect(updatedSpan?.spanId).toBe(baseSpan.spanId);
      expect(updatedSpan?.traceId).toBe(baseSpan.traceId);
      expect(updatedSpan?.startedAt).toEqual(baseSpan.startedAt);
      expect(updatedSpan?.endedAt).toEqual(baseSpan.endedAt);
      expect(updatedSpan?.spanType).toBe(baseSpan.spanType);
      expect(updatedSpan?.parentSpanId).toBe(baseSpan.parentSpanId);
    });
  });
});
