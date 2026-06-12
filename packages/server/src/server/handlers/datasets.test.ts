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

    it('passes toolMocks and the matching policy through to startExperimentAsync', async () => {
      const startSpy = vi.spyOn(Dataset.prototype, 'startExperimentAsync').mockResolvedValue({
        experimentId: 'exp-mocks',
        status: 'pending',
        totalItems: 1,
      });
      const dataset = await mastra.datasets.create({ name: 'Mocks Dataset' });
      const toolMocks = {
        weatherTool: { output: { temperature: 70 } },
        paymentTool: { error: { name: 'PaymentError', message: 'declined' } },
        searchTool: { expect: { args: { query: 'mastra' }, calledTimes: 1 } },
      };

      const result = await TRIGGER_EXPERIMENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        targetType: 'agent',
        targetId: 'my-agent',
        toolReplay: { fromExperimentId: 'prior-exp', matching: 'strict' },
        toolMocks,
      });

      expect(result.status).toBe('pending');
      expect(startSpy).toHaveBeenCalledTimes(1);
      expect(startSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          targetType: 'agent',
          targetId: 'my-agent',
          toolReplay: { fromExperimentId: 'prior-exp', matching: 'strict' },
          toolMocks,
        }),
      );
    });

    it('rejects toolMocks for non-agent targets in the handler (covers the query-param merge path)', async () => {
      const startSpy = vi.spyOn(Dataset.prototype, 'startExperimentAsync');
      const dataset = await mastra.datasets.create({ name: 'Mocks Bypass Dataset' });

      await expect(
        TRIGGER_EXPERIMENT_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          datasetId: dataset.id,
          targetType: 'workflow',
          targetId: 'my-workflow',
          toolMocks: { weatherTool: { output: { temperature: 70 } } },
        }),
      ).rejects.toMatchObject({ status: 400 });
      expect(startSpy).not.toHaveBeenCalled();
    });

    it('rejects colliding toolMocks keys with a 400 before starting the experiment', async () => {
      // Keys that normalize to the same agent-formatted tool name would
      // otherwise only collide at experiment setup — in the background, after
      // this fire-and-forget route already answered 200/pending.
      const startSpy = vi.spyOn(Dataset.prototype, 'startExperimentAsync');
      const dataset = await mastra.datasets.create({ name: 'Collision Dataset' });

      await expect(
        TRIGGER_EXPERIMENT_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          datasetId: dataset.id,
          targetType: 'agent',
          targetId: 'my-agent',
          toolMocks: {
            'my.tool': { output: { ok: true } },
            my_tool: { output: { ok: false } },
          },
        }),
      ).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/both normalize/) });
      expect(startSpy).not.toHaveBeenCalled();
    });

    it('rejects malformed replay fields merged in past the body schema (query-param shapes)', async () => {
      // Adapters merge raw query params into handler params after zod runs on
      // the body, so `?toolReplay=x` or `?itemIds=abc` arrive as strings.
      // Direct handler invocation models exactly that bypass.
      const startSpy = vi.spyOn(Dataset.prototype, 'startExperimentAsync');
      const dataset = await mastra.datasets.create({ name: 'Shape Bypass Dataset' });
      const base = {
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        targetType: 'agent' as const,
        targetId: 'my-agent',
      };

      await expect(TRIGGER_EXPERIMENT_ROUTE.handler({ ...base, toolReplay: 'x' as never })).rejects.toMatchObject({
        status: 400,
        message: 'toolReplay must be an object',
      });
      await expect(TRIGGER_EXPERIMENT_ROUTE.handler({ ...base, toolMocks: 'x' as never })).rejects.toMatchObject({
        status: 400,
        message: 'toolMocks must be an object',
      });
      await expect(TRIGGER_EXPERIMENT_ROUTE.handler({ ...base, itemIds: 'abc' as never })).rejects.toMatchObject({
        status: 400,
        message: 'itemIds must be an array of strings',
      });
      expect(startSpy).not.toHaveBeenCalled();
    });

    it('passes itemIds through to startExperimentAsync', async () => {
      const startSpy = vi.spyOn(Dataset.prototype, 'startExperimentAsync').mockResolvedValue({
        experimentId: 'exp-items',
        status: 'pending',
        totalItems: 2,
      });
      const dataset = await mastra.datasets.create({ name: 'Subset Dataset' });

      const result = await TRIGGER_EXPERIMENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        targetType: 'agent',
        targetId: 'my-agent',
        itemIds: ['item-1', 'item-2'],
      });

      expect(result.status).toBe('pending');
      expect(startSpy).toHaveBeenCalledTimes(1);
      expect(startSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          targetType: 'agent',
          targetId: 'my-agent',
          itemIds: ['item-1', 'item-2'],
        }),
      );
    });

    it('forwards itemIds and toolReplay together from one request body', async () => {
      // The re-run-one-diverging-item flow sends both in a single request —
      // neither field may clobber the other on the way to the runner.
      const startSpy = vi.spyOn(Dataset.prototype, 'startExperimentAsync').mockResolvedValue({
        experimentId: 'exp-combined',
        status: 'pending',
        totalItems: 1,
      });
      const dataset = await mastra.datasets.create({ name: 'Combined Dataset' });

      const result = await TRIGGER_EXPERIMENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        targetType: 'agent',
        targetId: 'my-agent',
        itemIds: ['item-3'],
        toolReplay: { fromExperimentId: 'prior-exp', onMiss: 'error', matching: 'strict' },
      });

      expect(result.status).toBe('pending');
      expect(startSpy).toHaveBeenCalledTimes(1);
      expect(startSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          targetType: 'agent',
          targetId: 'my-agent',
          itemIds: ['item-3'],
          toolReplay: { fromExperimentId: 'prior-exp', onMiss: 'error', matching: 'strict' },
        }),
      );
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

      it('accepts the matching policy and rejects invalid values', () => {
        expect(triggerExperimentBodySchema.parse({ ...base, toolReplay: { matching: 'strict' } }).toolReplay).toEqual({
          matching: 'strict',
        });
        expect(triggerExperimentBodySchema.parse({ ...base, toolReplay: { matching: 'fifo' } }).toolReplay).toEqual({
          matching: 'fifo',
        });
        expect(() => triggerExperimentBodySchema.parse({ ...base, toolReplay: { matching: 'exact' } })).toThrowError();
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

      it('accepts data-shaped toolMocks (output, error, or expect entries)', () => {
        const toolMocks = {
          weatherTool: { output: { temperature: 70 } },
          paymentTool: { error: { name: 'PaymentError', message: 'declined' } },
          searchTool: { expect: { args: { query: 'mastra' }, calledTimes: 2 } },
        };
        expect(triggerExperimentBodySchema.parse({ ...base, toolMocks }).toolMocks).toEqual(toolMocks);
      });

      it('rejects a tool mock with none of output, error, or expect', () => {
        const result = triggerExperimentBodySchema.safeParse({ ...base, toolMocks: { weatherTool: {} } });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('at least one of output, error, or expect');
        }
      });

      it('rejects a tool mock that sets both output and error', () => {
        const result = triggerExperimentBodySchema.safeParse({
          ...base,
          toolMocks: { weatherTool: { output: { ok: true }, error: { message: 'boom' } } },
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('cannot set both output and error');
        }
      });

      it('rejects toolMocks for non-agent targets at the boundary', () => {
        const result = triggerExperimentBodySchema.safeParse({
          targetType: 'workflow',
          targetId: 'my-workflow',
          toolMocks: { weatherTool: { output: { temperature: 70 } } },
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toBe(
            "toolMocks is only supported for agent targets (got targetType 'workflow')",
          );
          expect(result.error.issues[0]?.path).toEqual(['toolMocks']);
        }
      });

      it('accepts itemIds for any target type and rejects an empty array', () => {
        expect(triggerExperimentBodySchema.parse({ ...base, itemIds: ['item-1', 'item-2'] }).itemIds).toEqual([
          'item-1',
          'item-2',
        ]);
        // itemIds is target-agnostic — no agent-only refinement applies.
        expect(
          triggerExperimentBodySchema.parse({
            targetType: 'workflow',
            targetId: 'my-workflow',
            itemIds: ['item-1'],
          }).itemIds,
        ).toEqual(['item-1']);
        expect(triggerExperimentBodySchema.safeParse({ ...base, itemIds: [] }).success).toBe(false);
      });

      it('still converts to JSON schema for OpenAPI despite the refinements', () => {
        // superRefine wraps the schema in ZodEffects — the OpenAPI pipeline
        // (toStandardSchema → JSON schema) must keep working.
        const jsonSchema = schemaToJsonSchema(triggerExperimentBodySchema) as {
          properties?: Record<string, unknown>;
        };
        expect(jsonSchema.properties?.toolReplay).toBeDefined();
        expect(jsonSchema.properties?.toolMocks).toBeDefined();
        expect(jsonSchema.properties?.itemIds).toBeDefined();
      });
    });
  });
});
