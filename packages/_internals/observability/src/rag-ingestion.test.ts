import { describe, expect, it, vi } from 'vitest';

import { startRagIngestion, withRagIngestion } from './rag-ingestion';

describe('rag-ingestion helpers', () => {
  describe('startRagIngestion', () => {
    it('returns a no-op observability context when no Mastra instance is provided', () => {
      const { span, observabilityContext } = startRagIngestion({ name: 'test ingestion' });
      // Without a Mastra instance, no span will be created
      expect(span).toBeUndefined();
      // But the context is always defined and safe to thread downstream
      expect(observabilityContext).toBeDefined();
      expect(observabilityContext.tracingContext).toBeDefined();
    });

    it('forces rag_ingestion as the entity type for root ingestion spans', () => {
      const span = {} as any;
      const startSpan = vi.fn(() => span);
      const mastra = {
        observability: {
          getSelectedInstance: () => ({
            startSpan,
          }),
        },
      } as any;

      const result = startRagIngestion({ mastra, name: 'test ingestion' });

      expect(startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'rag_ingestion',
          entityType: 'rag_ingestion',
        }),
      );
      expect(result.span).toBe(span);
      expect(result.observabilityContext.tracingContext.currentSpan).toBe(span);
    });
  });

  describe('withRagIngestion', () => {
    it('runs the callback and returns its result', async () => {
      const result = await withRagIngestion({ name: 'docs ingestion' }, async ctx => {
        expect(ctx).toBeDefined();
        return { chunkCount: 3 };
      });
      expect(result).toEqual({ chunkCount: 3 });
    });

    it('records errors via span.error and re-throws', async () => {
      const fn = vi.fn(async () => {
        throw new Error('boom');
      });
      await expect(withRagIngestion({ name: 'docs ingestion' }, fn)).rejects.toThrow('boom');
      expect(fn).toHaveBeenCalled();
    });
  });
});
