import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, beforeEach } from 'vitest';
import { ADD_ITEM_ROUTE, GET_ITEM_ROUTE, LIST_DATASETS_ROUTE, UPDATE_ITEM_ROUTE } from './datasets';
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

  describe('item tool mocks', () => {
    it('round-trips toolMocks through add, get, and update', async () => {
      const dataset = await mastra.datasets.create({ name: 'Mocks DS' });
      const toolMocks = [
        { toolName: 'getWeather', args: { city: 'Seattle' }, output: { temp: 52 } },
        { toolName: 'getWeather', args: { city: 'Paris' }, output: { temp: 60 } },
      ];

      const added = (await ADD_ITEM_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        input: { q: 'weather' },
        toolMocks,
      } as any)) as any;

      expect(added.toolMocks).toEqual(toolMocks);

      const fetched = (await GET_ITEM_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        itemId: added.id,
      } as any)) as any;

      expect(fetched.toolMocks).toEqual(toolMocks);

      // SCD-2: updating an unrelated field preserves toolMocks
      const updated = (await UPDATE_ITEM_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        itemId: added.id,
        input: { q: 'updated' },
      } as any)) as any;

      expect(updated.toolMocks).toEqual(toolMocks);
    });
  });
});
