import { Dataset } from '@mastra/core/datasets';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { triggerExperimentBodySchema } from '../schemas/datasets';
import { schemaToJsonSchema } from '../server-adapter/openapi-utils';
import { LIST_DATASETS_ROUTE, TRIGGER_EXPERIMENT_ROUTE } from './datasets';
import { createTestServerContext } from './test-utils';

describe('Datasets Handlers', () => {
  let mockStorage: InMemoryStore;
  let mastra: Mastra;

  beforeEach(async () => {
    mockStorage = new InMemoryStore();
    await mockStorage.init();

    mastra = new Mastra({
      logger: false,
      storage: mockStorage,
    });
  });

  describe('LIST_DATASETS_ROUTE', () => {
    it('should respect explicit perPage parameter larger than the default', async () => {
      for (let i = 0; i < 15; i++) {
        await mastra.datasets.create({ name: `Dataset ${i + 1}` });
      }

      const result = await LIST_DATASETS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        page: 0,
        perPage: 15,
      });

      expect(result.datasets).toHaveLength(15);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should return all datasets when fewer than the default page size exist', async () => {
      for (let i = 0; i < 5; i++) {
        await mastra.datasets.create({ name: `Dataset ${i + 1}` });
      }

      const result = await LIST_DATASETS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
      });

      expect(result.datasets).toHaveLength(5);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should paginate correctly across pages using the default perPage of 10', async () => {
      for (let i = 0; i < 25; i++) {
        await mastra.datasets.create({ name: `Dataset ${i + 1}` });
      }

      const page0 = await LIST_DATASETS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        page: 0,
      });

      expect(page0.datasets).toHaveLength(10);
      expect(page0.pagination.hasMore).toBe(true);

      const page1 = await LIST_DATASETS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        page: 1,
      });

      expect(page1.datasets).toHaveLength(10);
      expect(page1.pagination.hasMore).toBe(true);

      const page2 = await LIST_DATASETS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        page: 2,
      });

      expect(page2.datasets).toHaveLength(5);
      expect(page2.pagination.hasMore).toBe(false);
    });
  });

  describe('TRIGGER_EXPERIMENT_ROUTE', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('passes toolReplay through to startExperimentAsync', async () => {
      // The handler resolves a fresh Dataset per request — spy at the prototype
      // so the fire-and-forget experiment never actually runs in this test.
      const startSpy = vi.spyOn(Dataset.prototype, 'startExperimentAsync').mockResolvedValue({
        experimentId: 'exp-1',
        status: 'pending',
        totalItems: 1,
      });
      const dataset = await mastra.datasets.create({ name: 'Replay Dataset' });

      const result = await TRIGGER_EXPERIMENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        targetType: 'agent',
        targetId: 'my-agent',
        toolReplay: { fromExperimentId: 'prior-exp', onMiss: 'passthrough' },
      });

      expect(result.status).toBe('pending');
      expect(startSpy).toHaveBeenCalledTimes(1);
      expect(startSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          targetType: 'agent',
          targetId: 'my-agent',
          toolReplay: { fromExperimentId: 'prior-exp', onMiss: 'passthrough' },
        }),
      );
    });

    it('rejects toolReplay for non-agent targets in the handler (covers the query-param merge path)', async () => {
      // Adapters merge unvalidated query params into handler params, so the
      // body-schema refinement alone can be bypassed — the handler guard must
      // hold on its own. Direct handler invocation skips schema validation,
      // which is exactly the bypass scenario.
      const startSpy = vi.spyOn(Dataset.prototype, 'startExperimentAsync');
      const dataset = await mastra.datasets.create({ name: 'Bypass Dataset' });

      await expect(
        TRIGGER_EXPERIMENT_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          datasetId: dataset.id,
          targetType: 'workflow',
          targetId: 'my-workflow',
          toolReplay: { fromExperimentId: 'prior-exp' },
        }),
      ).rejects.toMatchObject({ status: 400 });
      expect(startSpy).not.toHaveBeenCalled();
    });

    it('omits toolReplay from the config when not provided', async () => {
      const startSpy = vi.spyOn(Dataset.prototype, 'startExperimentAsync').mockResolvedValue({
        experimentId: 'exp-2',
        status: 'pending',
        totalItems: 1,
      });
      const dataset = await mastra.datasets.create({ name: 'Plain Dataset' });

      await TRIGGER_EXPERIMENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        targetType: 'agent',
        targetId: 'my-agent',
      });

      expect(startSpy).toHaveBeenCalledWith(expect.objectContaining({ toolReplay: undefined }));
    });

    describe('triggerExperimentBodySchema', () => {
      const base = { targetType: 'agent', targetId: 'my-agent' };

      it('accepts toolReplay with both fields, one field, or an empty object', () => {
        expect(
          triggerExperimentBodySchema.parse({
            ...base,
            toolReplay: { fromExperimentId: 'prior', onMiss: 'error' },
          }).toolReplay,
        ).toEqual({ fromExperimentId: 'prior', onMiss: 'error' });
        expect(
          triggerExperimentBodySchema.parse({ ...base, toolReplay: { fromExperimentId: 'prior' } }).toolReplay,
        ).toEqual({ fromExperimentId: 'prior' });
        expect(triggerExperimentBodySchema.parse({ ...base, toolReplay: {} }).toolReplay).toEqual({});
      });

      it('is unaffected when toolReplay is absent', () => {
        const parsed = triggerExperimentBodySchema.parse(base);
        expect(parsed.toolReplay).toBeUndefined();
      });

      it('rejects invalid onMiss values', () => {
        expect(() => triggerExperimentBodySchema.parse({ ...base, toolReplay: { onMiss: 'retry' } })).toThrowError();
      });

      it('rejects toolReplay for non-agent targets at the boundary', () => {
        // The route is fire-and-forget — this must 400 instead of failing the
        // experiment in the background after a 200/pending response.
        const result = triggerExperimentBodySchema.safeParse({
          targetType: 'workflow',
          targetId: 'my-workflow',
          toolReplay: {},
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('only supported for agent targets');
          expect(result.error.issues[0]?.path).toEqual(['toolReplay']);
        }
      });

      it('still converts to JSON schema for OpenAPI despite the refinement', () => {
        // superRefine wraps the schema in ZodEffects — the OpenAPI pipeline
        // (toStandardSchema → JSON schema) must keep working.
        const jsonSchema = schemaToJsonSchema(triggerExperimentBodySchema) as {
          properties?: Record<string, unknown>;
        };
        expect(jsonSchema.properties?.toolReplay).toBeDefined();
      });
    });
  });
});
