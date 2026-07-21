import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, beforeEach } from 'vitest';
import { HTTPException } from '../http-exception';
import {
  ADD_ITEM_ROUTE,
  BATCH_INSERT_ITEMS_ROUTE,
  DELETE_DATASET_ROUTE,
  GET_DATASET_ROUTE,
  GET_ITEM_ROUTE,
  LIST_DATASETS_ROUTE,
  UPDATE_DATASET_ROUTE,
  UPDATE_ITEM_ROUTE,
} from './datasets';
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

  describe('GET_DATASET_ROUTE tenancy', () => {
    it('returns the dataset when tenancy matches', async () => {
      const created = await mastra.datasets.create({
        name: 'Org-A DS',
        organizationId: 'org_a',
        projectId: 'proj_1',
      });

      const result = (await GET_DATASET_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: created.id,
        organizationId: 'org_a',
        projectId: 'proj_1',
      } as any)) as any;

      expect(result?.id).toBe(created.id);
    });

    it('returns 404 when organizationId does not match (no info leak)', async () => {
      const created = await mastra.datasets.create({
        name: 'Org-A DS',
        organizationId: 'org_a',
        projectId: 'proj_1',
      });

      const err = await GET_DATASET_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: created.id,
        organizationId: 'org_b',
      } as any).then(
        () => null,
        (e: unknown) => e,
      );
      expect(err).toBeInstanceOf(HTTPException);
      expect((err as HTTPException).status).toBe(404);
    });

    it('returns 404 when projectId does not match', async () => {
      const created = await mastra.datasets.create({
        name: 'Org-A DS',
        organizationId: 'org_a',
        projectId: 'proj_1',
      });

      const err = await GET_DATASET_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: created.id,
        organizationId: 'org_a',
        projectId: 'proj_2',
      } as any).then(
        () => null,
        (e: unknown) => e,
      );
      expect(err).toBeInstanceOf(HTTPException);
      expect((err as HTTPException).status).toBe(404);
    });
  });

  describe('UPDATE_DATASET_ROUTE tenancy', () => {
    it('updates when tenancy matches', async () => {
      const created = await mastra.datasets.create({
        name: 'Before',
        organizationId: 'org_a',
        projectId: 'proj_1',
      });

      const result = (await UPDATE_DATASET_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: created.id,
        organizationId: 'org_a',
        projectId: 'proj_1',
        name: 'After',
      } as any)) as any;

      expect(result.name).toBe('After');
    });

    it('rejects update with 404 when organizationId does not match', async () => {
      const created = await mastra.datasets.create({
        name: 'Before',
        organizationId: 'org_a',
        projectId: 'proj_1',
      });

      const err = await UPDATE_DATASET_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: created.id,
        organizationId: 'org_b',
        name: 'After',
      } as any).then(
        () => null,
        (e: unknown) => e,
      );
      expect(err).toBeInstanceOf(HTTPException);
      expect((err as HTTPException).status).toBe(404);

      // dataset unchanged
      const untouched = await mastra.datasets.get({ id: created.id });
      const details = await untouched.getDetails();
      expect(details.name).toBe('Before');
    });

    it('rejects update with 404 when projectId does not match', async () => {
      const created = await mastra.datasets.create({
        name: 'Before',
        organizationId: 'org_a',
        projectId: 'proj_1',
      });

      const err = await UPDATE_DATASET_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: created.id,
        organizationId: 'org_a',
        projectId: 'proj_2',
        name: 'After',
      } as any).then(
        () => null,
        (e: unknown) => e,
      );
      expect(err).toBeInstanceOf(HTTPException);
      expect((err as HTTPException).status).toBe(404);

      const untouched = await mastra.datasets.get({ id: created.id });
      const details = await untouched.getDetails();
      expect(details.name).toBe('Before');
    });
  });

  describe('DELETE_DATASET_ROUTE tenancy', () => {
    it('deletes when tenancy matches', async () => {
      const created = await mastra.datasets.create({
        name: 'To delete',
        organizationId: 'org_a',
        projectId: 'proj_1',
      });

      const result = (await DELETE_DATASET_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: created.id,
        organizationId: 'org_a',
        projectId: 'proj_1',
      } as any)) as any;

      expect(result.success).toBe(true);

      // gone
      await expect(mastra.datasets.get({ id: created.id }).then(d => d.getDetails())).rejects.toThrow();
    });

    it('silently no-ops delete when organizationId does not match and dataset remains', async () => {
      const created = await mastra.datasets.create({
        name: 'Guarded',
        organizationId: 'org_a',
        projectId: 'proj_1',
      });

      // Scoped delete on wrong tenant must NOT throw — silent no-op matches the
      // storage contract so cross-tenant existence is not leaked via error
      // timing or status.
      const result = (await DELETE_DATASET_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: created.id,
        organizationId: 'org_b',
      } as any)) as any;

      expect(result.success).toBe(true);

      // dataset survives untouched
      const survivor = await mastra.datasets.get({ id: created.id });
      const details = await survivor.getDetails();
      expect(details.id).toBe(created.id);
      expect(details.organizationId).toBe('org_a');
    });

    it('silently no-ops delete when projectId does not match and dataset remains', async () => {
      const created = await mastra.datasets.create({
        name: 'Guarded',
        organizationId: 'org_a',
        projectId: 'proj_1',
      });

      const result = (await DELETE_DATASET_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: created.id,
        organizationId: 'org_a',
        projectId: 'proj_2',
      } as any)) as any;

      expect(result.success).toBe(true);

      const survivor = await mastra.datasets.get({ id: created.id });
      const details = await survivor.getDetails();
      expect(details.id).toBe(created.id);
      expect(details.projectId).toBe('proj_1');
    });
  });

  describe('item identity', () => {
    it('forwards externalId through single and batch insertion', async () => {
      const dataset = await mastra.datasets.create({ name: 'Identity DS' });

      const added = await ADD_ITEM_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        externalId: 'single-item',
        input: { q: 'single' },
      } as any);
      const batch = await BATCH_INSERT_ITEMS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        items: [{ externalId: 'batch-item', input: { q: 'batch' } }],
      } as any);

      expect(added.externalId).toBe('single-item');
      expect(batch.items[0]?.externalId).toBe('batch-item');
    });

    it('maps incompatible externalId reuse to HTTP 409', async () => {
      const dataset = await mastra.datasets.create({ name: 'Conflict DS' });
      await ADD_ITEM_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        externalId: 'item-1',
        input: { q: 'first' },
      } as any);

      const error = await ADD_ITEM_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        externalId: 'item-1',
        input: { q: 'different' },
      } as any).then(
        () => null,
        (caught: unknown) => caught,
      );

      expect(error).toBeInstanceOf(HTTPException);
      expect((error as HTTPException).status).toBe(409);
      expect((error as HTTPException).cause).toMatchObject({
        conflicts: [expect.objectContaining({ externalId: 'item-1', reason: 'payload_mismatch' })],
      });
    });

    it('maps an empty externalId to HTTP 400', async () => {
      const dataset = await mastra.datasets.create({ name: 'Invalid Identity DS' });
      const error = await ADD_ITEM_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        externalId: '',
        input: { q: 'invalid' },
      } as any).then(
        () => null,
        (caught: unknown) => caught,
      );

      expect(error).toBeInstanceOf(HTTPException);
      expect((error as HTTPException).status).toBe(400);
      expect((error as HTTPException).cause).toEqual({ field: 'externalId' });
    });

    it('maps circular dataset item payloads to HTTP 400', async () => {
      const dataset = await mastra.datasets.create({ name: 'Circular Payload DS' });
      const input: Record<string, unknown> = { q: 'cyclic' };
      input.self = input;

      const error = await ADD_ITEM_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        input,
      } as any).then(
        () => null,
        (caught: unknown) => caught,
      );

      expect(error).toBeInstanceOf(HTTPException);
      expect((error as HTTPException).status).toBe(400);
      expect((error as HTTPException).message).toContain('items[0].input.self references items[0].input');
    });

    it('maps lossy dataset item payloads to HTTP 400', async () => {
      const dataset = await mastra.datasets.create({ name: 'Lossy Payload DS' });

      const error = await ADD_ITEM_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        input: { q: 'lossy', extra: undefined },
      } as any).then(
        () => null,
        (caught: unknown) => caught,
      );

      expect(error).toBeInstanceOf(HTTPException);
      expect((error as HTTPException).status).toBe(400);
      expect((error as HTTPException).message).toContain('undefined value at items[0].input.extra');
    });

    it('persists caller request context entries instead of the live server RequestContext', async () => {
      const dataset = await mastra.datasets.create({ name: 'Request Context DS' });

      // Adapters merge the body's requestContext entries into the live server
      // RequestContext and pass that instance to the handler in place of the
      // body field. The handler must recover the caller entries (reserved
      // mastra__* keys excluded) rather than persisting the live instance.
      const serverContext = createTestServerContext({ mastra });
      serverContext.requestContext.set('locale', 'fr-FR');
      serverContext.requestContext.set('mastra__authMode', 'server');

      const added = await ADD_ITEM_ROUTE.handler({
        ...serverContext,
        datasetId: dataset.id,
        input: { q: 'ctx' },
      } as any);

      expect(added.requestContext).toEqual({ locale: 'fr-FR' });

      // An empty live RequestContext must not persist an empty object.
      const bare = await ADD_ITEM_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        input: { q: 'no-ctx' },
      } as any);
      expect(bare.requestContext).toBeUndefined();
    });

    it('maps non-plain-object dataset item payloads to HTTP 400', async () => {
      const dataset = await mastra.datasets.create({ name: 'Non-Plain Payload DS' });

      const error = await ADD_ITEM_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        input: { q: 'date', createdAt: new Date('2026-01-01T00:00:00Z') },
      } as any).then(
        () => null,
        (caught: unknown) => caught,
      );

      expect(error).toBeInstanceOf(HTTPException);
      expect((error as HTTPException).status).toBe(400);
      expect((error as HTTPException).message).toContain('non-plain object (Date) at items[0].input.createdAt');
    });

    it('maps incompatible externalId reuse in a batch to HTTP 409', async () => {
      const dataset = await mastra.datasets.create({ name: 'Batch Conflict DS' });
      await BATCH_INSERT_ITEMS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        items: [{ externalId: 'item-1', input: { q: 'first' } }],
      } as any);

      const error = await BATCH_INSERT_ITEMS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        items: [{ externalId: 'item-1', input: { q: 'different' } }],
      } as any).then(
        () => null,
        (caught: unknown) => caught,
      );

      expect(error).toBeInstanceOf(HTTPException);
      expect((error as HTTPException).status).toBe(409);
      expect((error as HTTPException).cause).toMatchObject({
        conflicts: [expect.objectContaining({ externalId: 'item-1', reason: 'payload_mismatch' })],
      });
    });

    it('maps an empty externalId in a batch to HTTP 400', async () => {
      const dataset = await mastra.datasets.create({ name: 'Batch Invalid Identity DS' });
      const error = await BATCH_INSERT_ITEMS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        items: [{ externalId: '', input: { q: 'invalid' } }],
      } as any).then(
        () => null,
        (caught: unknown) => caught,
      );

      expect(error).toBeInstanceOf(HTTPException);
      expect((error as HTTPException).status).toBe(400);
      expect((error as HTTPException).cause).toEqual({ field: 'externalId' });
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
