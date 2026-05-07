import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, beforeEach, vi } from 'vitest';
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
    it('should forward adapter-injected auth request context to workflow experiments', async () => {
      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-1', email: 'user@example.com' });

      const startExperimentAsync = vi.fn().mockResolvedValue({
        experimentId: 'experiment-1',
        status: 'pending',
        totalItems: 1,
      });
      vi.spyOn(mastra.datasets, 'get').mockResolvedValue({ startExperimentAsync } as any);

      await TRIGGER_EXPERIMENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        requestContext,
        datasetId: 'dataset-1',
        targetType: 'workflow',
        targetId: 'workflow-1',
      } as any);

      expect(startExperimentAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          targetType: 'workflow',
          targetId: 'workflow-1',
          requestContext: {
            user: { id: 'user-1', email: 'user@example.com' },
          },
        }),
      );
    });

    it('should merge body request context over adapter-injected request context', async () => {
      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'auth-user' });
      requestContext.set('tenantId', 'auth-tenant');

      const startExperimentAsync = vi.fn().mockResolvedValue({
        experimentId: 'experiment-1',
        status: 'pending',
        totalItems: 1,
      });
      vi.spyOn(mastra.datasets, 'get').mockResolvedValue({ startExperimentAsync } as any);

      await TRIGGER_EXPERIMENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        requestContext,
        datasetId: 'dataset-1',
        targetType: 'workflow',
        targetId: 'workflow-1',
        bodyRequestContext: {
          tenantId: 'body-tenant',
          traceId: 'trace-1',
        },
      } as any);

      expect(startExperimentAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          requestContext: {
            user: { id: 'auth-user' },
            tenantId: 'body-tenant',
            traceId: 'trace-1',
          },
        }),
      );
    });
  });
});
