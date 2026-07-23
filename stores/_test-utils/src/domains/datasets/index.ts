import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { MastraStorage, DatasetsStorage, DatasetRecord, DatasetItem } from '@mastra/core/storage';
import type { TestCapabilities } from '../../factory';

export function createDatasetsTests({
  storage,
  capabilities = {},
}: {
  storage: MastraStorage;
  capabilities?: TestCapabilities;
}) {
  // Skip tests if storage doesn't have datasets domain
  const describeDatasets = storage.stores?.datasets ? describe : describe.skip;
  const supportsToolMocks = capabilities.toolMocks !== false;
  const supportsItemTimeout = capabilities.datasetItemTimeout !== false;
  const itItemIdentity = capabilities.datasetItemIdentity === false ? it.skip : it;

  let datasetsStorage: DatasetsStorage;

  describeDatasets('Datasets Storage', () => {
    beforeAll(async () => {
      const store = await storage.getStore('datasets');
      if (!store) {
        throw new Error('Datasets storage not found');
      }
      datasetsStorage = store;
    });

    // ---------------------------------------------------------------------------
    // Dataset CRUD
    // ---------------------------------------------------------------------------
    describe('Dataset CRUD', () => {
      beforeEach(async () => {
        await datasetsStorage.dangerouslyClearAll();
      });

      it('createDataset returns record with UUID id and version=0', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'test-ds' });

        expect(ds.id).toBeDefined();
        expect(ds.id.length).toBe(36);
        expect(ds.name).toBe('test-ds');
        expect(ds.version).toBe(0);
        expect(ds.createdAt).toBeInstanceOf(Date);
      });

      it('createDataset atomically resolves compatible caller-defined IDs', async () => {
        const input = {
          id: 'caller-defined-dataset',
          name: 'first-write-wins',
          organizationId: 'org_1',
          projectId: null,
        };
        const results = await Promise.all(Array.from({ length: 20 }, () => datasetsStorage.createDataset(input)));
        const listed = await datasetsStorage.listDatasets({ pagination: { page: 0, perPage: 100 } });

        expect(results.every(dataset => dataset.id === input.id)).toBe(true);
        expect(results.every(dataset => dataset.createdAt.getTime() === results[0]!.createdAt.getTime())).toBe(true);
        expect(listed.datasets.filter(dataset => dataset.id === input.id)).toHaveLength(1);
      });

      it('createDataset returns the current record for a compatible retry without mutation', async () => {
        await datasetsStorage.createDataset({
          id: 'retry-dataset',
          name: 'original',
          organizationId: 'org_1',
        });
        const updated = await datasetsStorage.updateDataset({ id: 'retry-dataset', name: 'updated' });
        const retried = await datasetsStorage.createDataset({
          id: 'retry-dataset',
          name: 'ignored',
          organizationId: 'org_1',
          projectId: null,
        });

        expect(retried.name).toBe('updated');
        expect(retried.updatedAt.getTime()).toBe(updated.updatedAt.getTime());
        expect(retried.version).toBe(0);
      });

      it('createDataset treats omitted and null immutable fields as compatible', async () => {
        const created = await datasetsStorage.createDataset({
          id: 'normalized-dataset',
          name: 'original',
          organizationId: undefined,
          projectId: null,
        });
        const retried = await datasetsStorage.createDataset({
          id: 'normalized-dataset',
          name: 'ignored',
          organizationId: null,
          projectId: undefined,
        });

        expect(retried.createdAt.getTime()).toBe(created.createdAt.getTime());
        expect(retried.name).toBe('original');
      });

      it('createDataset rejects incompatible caller-defined ID reuse', async () => {
        await datasetsStorage.createDataset({
          id: 'conflicting-dataset',
          name: 'original',
          organizationId: 'org_1',
          candidateId: 'candidate_1',
        });

        await expect(
          datasetsStorage.createDataset({
            id: 'conflicting-dataset',
            name: 'retry',
            organizationId: 'org_2',
            candidateId: 'candidate_1',
          }),
        ).rejects.toMatchObject({ id: 'DATASET_ID_CONFLICT' });
      });

      it('createDataset releases a caller-defined ID after deletion', async () => {
        const first = await datasetsStorage.createDataset({ id: 'reusable-dataset', name: 'first' });
        await datasetsStorage.deleteDataset({ id: first.id });
        const second = await datasetsStorage.createDataset({ id: first.id, name: 'second' });

        expect(second.name).toBe('second');
        expect(second.version).toBe(0);
      });

      it('getDatasetById returns record or null', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'get-test' });
        const found = await datasetsStorage.getDatasetById({ id: ds.id });
        const notFound = await datasetsStorage.getDatasetById({ id: 'nonexistent' });

        expect(found).toBeDefined();
        expect(found!.id).toBe(ds.id);
        expect(notFound).toBeNull();
      });

      it('updateDataset updates fields and returns merged record', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'update-test' });
        const updated = await datasetsStorage.updateDataset({
          id: ds.id,
          name: 'updated-name',
          description: 'new desc',
        });

        expect(updated.name).toBe('updated-name');
        expect(updated.description).toBe('new desc');
        expect(updated.version).toBe(0); // version unchanged by update
      });

      it('updateDataset throws for non-existent dataset', async () => {
        await expect(datasetsStorage.updateDataset({ id: 'non-existent', name: 'x' })).rejects.toThrow();
      });

      it('deleteDataset removes dataset + items + versions', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'delete-test' });
        await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'hello' } });
        await datasetsStorage.deleteDataset({ id: ds.id });

        expect(await datasetsStorage.getDatasetById({ id: ds.id })).toBeNull();
      });

      // -----------------------------------------------------------------------
      // Tenancy scoping — getDatasetById + deleteDataset MUST push tenancy
      // predicates into the query.
      // -----------------------------------------------------------------------
      describe('tenancy scoping', () => {
        it('getDatasetById returns null when organizationId does not match', async () => {
          const ds = await datasetsStorage.createDataset({
            name: 'org-scoped',
            organizationId: 'org_a',
            projectId: 'proj_1',
          });

          const wrongOrg = await datasetsStorage.getDatasetById({
            id: ds.id,
            filters: { organizationId: 'org_b' },
          });
          expect(wrongOrg).toBeNull();

          const rightOrg = await datasetsStorage.getDatasetById({
            id: ds.id,
            filters: { organizationId: 'org_a' },
          });
          expect(rightOrg).not.toBeNull();
          expect(rightOrg!.id).toBe(ds.id);
        });

        it('getDatasetById returns null when projectId does not match', async () => {
          const ds = await datasetsStorage.createDataset({
            name: 'proj-scoped',
            organizationId: 'org_a',
            projectId: 'proj_1',
          });

          const wrongProject = await datasetsStorage.getDatasetById({
            id: ds.id,
            filters: { organizationId: 'org_a', projectId: 'proj_2' },
          });
          expect(wrongProject).toBeNull();

          const rightProject = await datasetsStorage.getDatasetById({
            id: ds.id,
            filters: { organizationId: 'org_a', projectId: 'proj_1' },
          });
          expect(rightProject).not.toBeNull();
          expect(rightProject!.id).toBe(ds.id);
        });

        it('getDatasetById does not throw on tenancy mismatch (no info leak via error)', async () => {
          const ds = await datasetsStorage.createDataset({
            name: 'silent-scope',
            organizationId: 'org_a',
          });

          // Should return null, not throw. If it threw, the error timing/text
          // could be used to distinguish "exists but not yours" from "does not
          // exist at all" — leaking existence across tenants.
          await expect(
            datasetsStorage.getDatasetById({ id: ds.id, filters: { organizationId: 'org_b' } }),
          ).resolves.toBeNull();
        });

        it('deleteDataset is a silent no-op when organizationId does not match', async () => {
          const ds = await datasetsStorage.createDataset({
            name: 'delete-scoped',
            organizationId: 'org_a',
          });

          await expect(
            datasetsStorage.deleteDataset({ id: ds.id, filters: { organizationId: 'org_b' } }),
          ).resolves.toBeUndefined();

          // Dataset must still exist.
          const stillThere = await datasetsStorage.getDatasetById({ id: ds.id });
          expect(stillThere).not.toBeNull();
          expect(stillThere!.id).toBe(ds.id);
        });

        it('deleteDataset is a silent no-op when projectId does not match', async () => {
          const ds = await datasetsStorage.createDataset({
            name: 'delete-proj-scoped',
            organizationId: 'org_a',
            projectId: 'proj_1',
          });

          await datasetsStorage.deleteDataset({
            id: ds.id,
            filters: { organizationId: 'org_a', projectId: 'proj_2' },
          });

          expect(await datasetsStorage.getDatasetById({ id: ds.id })).not.toBeNull();
        });

        it('deleteDataset with matching tenancy removes the dataset', async () => {
          const ds = await datasetsStorage.createDataset({
            name: 'delete-match',
            organizationId: 'org_a',
            projectId: 'proj_1',
          });
          await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'hi' } });

          await datasetsStorage.deleteDataset({
            id: ds.id,
            filters: { organizationId: 'org_a', projectId: 'proj_1' },
          });

          expect(await datasetsStorage.getDatasetById({ id: ds.id })).toBeNull();
        });

        it('mixed-tenancy: deleting scoped to org A does not touch org B rows', async () => {
          const dsA = await datasetsStorage.createDataset({
            name: 'ds-a',
            organizationId: 'org_a',
          });
          const dsB = await datasetsStorage.createDataset({
            name: 'ds-b',
            organizationId: 'org_b',
          });
          await datasetsStorage.addItem({ datasetId: dsA.id, input: { v: 'a' } });
          await datasetsStorage.addItem({ datasetId: dsB.id, input: { v: 'b' } });

          // Attempt to delete dsB using org A tenancy — must no-op.
          await datasetsStorage.deleteDataset({
            id: dsB.id,
            filters: { organizationId: 'org_a' },
          });

          // dsB must be intact.
          const foundB = await datasetsStorage.getDatasetById({ id: dsB.id });
          expect(foundB).not.toBeNull();
          const itemsB = await datasetsStorage.listItems({
            datasetId: dsB.id,
            pagination: { page: 0, perPage: 10 },
          });
          expect(itemsB.items).toHaveLength(1);

          // Now delete dsA with correct tenancy — must succeed.
          await datasetsStorage.deleteDataset({
            id: dsA.id,
            filters: { organizationId: 'org_a' },
          });
          expect(await datasetsStorage.getDatasetById({ id: dsA.id })).toBeNull();

          // dsB is still untouched.
          expect(await datasetsStorage.getDatasetById({ id: dsB.id })).not.toBeNull();
        });

        it('getDatasetById with undefined filters returns the record regardless of tenancy (legacy behavior)', async () => {
          const ds = await datasetsStorage.createDataset({
            name: 'unscoped-lookup',
            organizationId: 'org_a',
          });

          // No filters => no predicate => legacy OSS behavior preserved.
          const found = await datasetsStorage.getDatasetById({ id: ds.id });
          expect(found).not.toBeNull();
          expect(found!.id).toBe(ds.id);
        });

        it('updateDataset throws NOT_FOUND when tenancy does not match (does not mutate row)', async () => {
          const ds = await datasetsStorage.createDataset({
            name: 'update-scoped',
            organizationId: 'org_a',
            projectId: 'proj_1',
          });

          // Wrong org — must NOT_FOUND and must NOT mutate.
          await expect(
            datasetsStorage.updateDataset({
              id: ds.id,
              name: 'renamed-by-attacker',
              filters: { organizationId: 'org_b' },
            }),
          ).rejects.toThrow();

          const after = await datasetsStorage.getDatasetById({ id: ds.id });
          expect(after).not.toBeNull();
          expect(after!.name).toBe('update-scoped');
          expect(after!.organizationId).toBe('org_a');
        });

        it('updateDataset with matching tenancy applies the update', async () => {
          const ds = await datasetsStorage.createDataset({
            name: 'update-scoped-ok',
            organizationId: 'org_a',
            projectId: 'proj_1',
          });

          const updated = await datasetsStorage.updateDataset({
            id: ds.id,
            name: 'renamed',
            filters: { organizationId: 'org_a', projectId: 'proj_1' },
          });

          expect(updated.name).toBe('renamed');
          expect(updated.organizationId).toBe('org_a');
        });

        it('mixed-tenancy: updating scoped to org A does not touch org B rows', async () => {
          const dsA = await datasetsStorage.createDataset({
            name: 'A-original',
            organizationId: 'org_a',
          });
          const dsB = await datasetsStorage.createDataset({
            name: 'B-original',
            organizationId: 'org_b',
          });

          // Cross-tenant attempt on dsB using org A tenancy — must NOT_FOUND.
          await expect(
            datasetsStorage.updateDataset({
              id: dsB.id,
              name: 'B-hijacked',
              filters: { organizationId: 'org_a' },
            }),
          ).rejects.toThrow();

          const afterB = await datasetsStorage.getDatasetById({ id: dsB.id });
          expect(afterB!.name).toBe('B-original');

          // Legitimate scoped update on dsA — must succeed.
          const updatedA = await datasetsStorage.updateDataset({
            id: dsA.id,
            name: 'A-renamed',
            filters: { organizationId: 'org_a' },
          });
          expect(updatedA.name).toBe('A-renamed');
        });
      });

      it('listDatasets with pagination', async () => {
        await datasetsStorage.createDataset({ name: 'ds-1' });
        await datasetsStorage.createDataset({ name: 'ds-2' });
        await datasetsStorage.createDataset({ name: 'ds-3' });

        const page0 = await datasetsStorage.listDatasets({ pagination: { page: 0, perPage: 2 } });
        expect(page0.datasets).toHaveLength(2);
        expect(page0.pagination.total).toBe(3);
        expect(page0.pagination.hasMore).toBe(true);

        const page1 = await datasetsStorage.listDatasets({ pagination: { page: 1, perPage: 2 } });
        expect(page1.datasets).toHaveLength(1);
        expect(page1.pagination.hasMore).toBe(false);
      });

      it('listDatasets filters by targetType', async () => {
        await datasetsStorage.createDataset({ name: 'agent-ds', targetType: 'agent' });
        await datasetsStorage.createDataset({ name: 'workflow-ds', targetType: 'workflow' });
        await datasetsStorage.createDataset({ name: 'untyped-ds' });

        const agentOnly = await datasetsStorage.listDatasets({
          filters: { targetType: 'agent' },
          pagination: { page: 0, perPage: 10 },
        });
        expect(agentOnly.datasets).toHaveLength(1);
        expect(agentOnly.datasets[0]!.name).toBe('agent-ds');

        const workflowOnly = await datasetsStorage.listDatasets({
          filters: { targetType: 'workflow' },
          pagination: { page: 0, perPage: 10 },
        });
        expect(workflowOnly.datasets).toHaveLength(1);
        expect(workflowOnly.datasets[0]!.name).toBe('workflow-ds');
      });

      it('listDatasets filters by targetIds with overlap semantics', async () => {
        await datasetsStorage.createDataset({ name: 'ds-a', targetType: 'agent', targetIds: ['a1', 'a2'] });
        await datasetsStorage.createDataset({ name: 'ds-b', targetType: 'agent', targetIds: ['a2', 'a3'] });
        await datasetsStorage.createDataset({ name: 'ds-c', targetType: 'agent', targetIds: ['a4'] });
        await datasetsStorage.createDataset({ name: 'ds-d' });

        // Single id matches any dataset whose targetIds contain it
        const matchA2 = await datasetsStorage.listDatasets({
          filters: { targetIds: ['a2'] },
          pagination: { page: 0, perPage: 10 },
        });
        expect(matchA2.datasets.map(d => d.name).sort()).toEqual(['ds-a', 'ds-b']);

        // Multiple ids match any dataset whose targetIds overlap with the filter (union)
        const matchA1OrA4 = await datasetsStorage.listDatasets({
          filters: { targetIds: ['a1', 'a4'] },
          pagination: { page: 0, perPage: 10 },
        });
        expect(matchA1OrA4.datasets.map(d => d.name).sort()).toEqual(['ds-a', 'ds-c']);

        // No overlap returns empty
        const noMatch = await datasetsStorage.listDatasets({
          filters: { targetIds: ['zzz'] },
          pagination: { page: 0, perPage: 10 },
        });
        expect(noMatch.datasets).toHaveLength(0);
      });

      it('listDatasets filters by name substring case-insensitively', async () => {
        await datasetsStorage.createDataset({ name: 'Production Tickets' });
        await datasetsStorage.createDataset({ name: 'production-logs' });
        await datasetsStorage.createDataset({ name: 'staging-tickets' });

        const prod = await datasetsStorage.listDatasets({
          filters: { name: 'PROD' },
          pagination: { page: 0, perPage: 10 },
        });
        expect(prod.datasets.map(d => d.name).sort()).toEqual(['Production Tickets', 'production-logs']);

        const tickets = await datasetsStorage.listDatasets({
          filters: { name: 'tickets' },
          pagination: { page: 0, perPage: 10 },
        });
        expect(tickets.datasets.map(d => d.name).sort()).toEqual(['Production Tickets', 'staging-tickets']);
      });

      it('listDatasets combines targetType, targetIds, and name filters', async () => {
        await datasetsStorage.createDataset({
          name: 'agent-prod-alpha',
          targetType: 'agent',
          targetIds: ['a1'],
        });
        await datasetsStorage.createDataset({
          name: 'agent-prod-beta',
          targetType: 'agent',
          targetIds: ['a2'],
        });
        await datasetsStorage.createDataset({
          name: 'workflow-prod-alpha',
          targetType: 'workflow',
          targetIds: ['a1'],
        });
        await datasetsStorage.createDataset({
          name: 'agent-staging-alpha',
          targetType: 'agent',
          targetIds: ['a1'],
        });

        const result = await datasetsStorage.listDatasets({
          filters: { targetType: 'agent', targetIds: ['a1'], name: 'prod' },
          pagination: { page: 0, perPage: 10 },
        });
        expect(result.datasets).toHaveLength(1);
        expect(result.datasets[0]!.name).toBe('agent-prod-alpha');
      });
    });

    // ---------------------------------------------------------------------------
    // Item CRUD
    // ---------------------------------------------------------------------------
    describe('Item CRUD', () => {
      beforeEach(async () => {
        await datasetsStorage.dangerouslyClearAll();
      });

      it('addItem returns item with version and id', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'item-add' });
        const item = await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'hello' } });

        expect(item.id).toBeDefined();
        expect(item.datasetVersion).toBe(1);
        expect(item.input).toEqual({ q: 'hello' });
      });

      it('addItem throws for non-existent dataset', async () => {
        await expect(datasetsStorage.addItem({ datasetId: 'non-existent', input: {} })).rejects.toThrow();
      });

      it('getItemById returns item or null', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'item-get' });
        const item = await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'test' } });

        const found = await datasetsStorage.getItemById({ id: item.id });
        expect(found).toBeDefined();
        expect(found!.id).toBe(item.id);

        const notFound = await datasetsStorage.getItemById({ id: 'nonexistent' });
        expect(notFound).toBeNull();
      });

      const toolMocksFixture = [
        { toolName: 'getWeather', args: { city: 'Seattle' }, output: { temp: 52 } },
        { toolName: 'getWeather', args: { city: 'Seattle' }, output: { temp: 48 } },
        {
          toolName: 'agent-balanceAgent',
          args: { prompt: 'lookup YJ' },
          output: { text: 'YJ: $100' },
          matchArgs: 'ignore' as const,
        },
      ];

      (supportsToolMocks ? it : it.skip)('toolMocks round-trip through add, get, and SCD-2 update', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'item-tool-mocks' });
        const toolMocks = toolMocksFixture;

        const item = await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'hi' }, toolMocks });
        expect(item.toolMocks).toEqual(toolMocks);

        const fetched = await datasetsStorage.getItemById({ id: item.id });
        expect(fetched!.toolMocks).toEqual(toolMocks);

        // Updating an unrelated field must preserve toolMocks through versioning.
        const updated = await datasetsStorage.updateItem({ id: item.id, datasetId: ds.id, input: { q: 'hi2' } });
        expect(updated.datasetVersion).toBe(2);
        expect(updated.toolMocks).toEqual(toolMocks);

        // Explicitly replacing toolMocks updates them.
        const replaced = await datasetsStorage.updateItem({
          id: item.id,
          datasetId: ds.id,
          toolMocks: [{ toolName: 'other', args: {}, output: 1 }],
        });
        expect(replaced.toolMocks).toEqual([{ toolName: 'other', args: {}, output: 1 }]);
      });

      (supportsToolMocks ? it.skip : it)('rejects toolMocks when the adapter does not support them', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'item-tool-mocks-reject' });
        await expect(
          datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'hi' }, toolMocks: toolMocksFixture }),
        ).rejects.toThrow();
      });

      (supportsItemTimeout ? it : it.skip)(
        'timeout round-trips through add, batch insert, updates, and SCD-2 history',
        async () => {
          const ds = await datasetsStorage.createDataset({ name: 'item-timeout' });
          const item = await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'one' }, timeout: 1_000 });

          expect(item.timeout).toBe(1_000);
          expect((await datasetsStorage.getItemById({ id: item.id }))?.timeout).toBe(1_000);

          const batch = await datasetsStorage.batchInsertItems({
            datasetId: ds.id,
            items: [
              { input: { q: 'two' }, timeout: 2_000 },
              { input: { q: 'three' }, timeout: 3_000 },
            ],
          });
          expect(batch.map(batchItem => batchItem.timeout)).toEqual([2_000, 3_000]);
          expect((await datasetsStorage.getItemById({ id: batch[0]!.id }))?.timeout).toBe(2_000);

          const preserved = await datasetsStorage.updateItem({
            id: item.id,
            datasetId: ds.id,
            input: { q: 'updated' },
          });
          expect(preserved.timeout).toBe(1_000);

          const replaced = await datasetsStorage.updateItem({ id: item.id, datasetId: ds.id, timeout: 4_000 });
          expect(replaced.timeout).toBe(4_000);
          expect(
            (await datasetsStorage.getItemsByVersion({ datasetId: ds.id, version: 1 })).find(
              versionItem => versionItem.id === item.id,
            )?.timeout,
          ).toBe(1_000);
          expect(
            (await datasetsStorage.getItemsByVersion({ datasetId: ds.id, version: 3 })).find(
              versionItem => versionItem.id === item.id,
            )?.timeout,
          ).toBe(1_000);
          expect(
            (await datasetsStorage.getItemsByVersion({ datasetId: ds.id, version: 4 })).find(
              versionItem => versionItem.id === item.id,
            )?.timeout,
          ).toBe(4_000);

          const history = await datasetsStorage.getItemHistory(item.id);
          expect(history.map(row => row.timeout)).toEqual([4_000, 1_000, 1_000]);
        },
      );

      (supportsItemTimeout ? it.skip : it)('rejects timeout writes before mutating the dataset', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'item-timeout-reject' });
        const unsupportedError = { id: 'MYSQL_DATASET_ITEM_TIMEOUT_UNSUPPORTED' };

        await expect(
          datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'rejected' }, timeout: 1_000 }),
        ).rejects.toMatchObject(unsupportedError);
        expect((await datasetsStorage.getDatasetById({ id: ds.id }))?.version).toBe(0);

        const item = await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'plain' } });
        await expect(
          datasetsStorage.updateItem({ id: item.id, datasetId: ds.id, timeout: 2_000 }),
        ).rejects.toMatchObject(unsupportedError);
        await expect(
          datasetsStorage.batchInsertItems({
            datasetId: ds.id,
            items: [{ input: { q: 'plain-batch' } }, { input: { q: 'rejected-batch' }, timeout: 3_000 }],
          }),
        ).rejects.toMatchObject(unsupportedError);
        expect((await datasetsStorage.getDatasetById({ id: ds.id }))?.version).toBe(1);
      });

      it('updateItem creates new version row', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'item-update' });
        const item = await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'v1' } });

        const updated = await datasetsStorage.updateItem({ id: item.id, datasetId: ds.id, input: { q: 'v2' } });

        expect(updated.datasetVersion).toBe(2);
        expect(updated.input).toEqual({ q: 'v2' });
      });

      it('updateItem throws for non-existent item', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'item-update-missing' });
        await expect(datasetsStorage.updateItem({ id: 'non-existent', datasetId: ds.id, input: {} })).rejects.toThrow();
      });

      it('updateItem throws when item does not belong to dataset', async () => {
        const ds1 = await datasetsStorage.createDataset({ name: 'ds1' });
        const ds2 = await datasetsStorage.createDataset({ name: 'ds2' });
        const item = await datasetsStorage.addItem({ datasetId: ds1.id, input: {} });

        await expect(datasetsStorage.updateItem({ id: item.id, datasetId: ds2.id, input: {} })).rejects.toThrow();
      });

      it('deleteItem throws when item does not belong to dataset', async () => {
        const ds1 = await datasetsStorage.createDataset({ name: 'ds1-del' });
        const ds2 = await datasetsStorage.createDataset({ name: 'ds2-del' });
        const item = await datasetsStorage.addItem({ datasetId: ds1.id, input: {} });

        await expect(datasetsStorage.deleteItem({ id: item.id, datasetId: ds2.id })).rejects.toThrow();
      });

      it('deleteItem makes item invisible as current', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'item-delete' });
        const item = await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'bye' } });

        await datasetsStorage.deleteItem({ id: item.id, datasetId: ds.id });

        const current = await datasetsStorage.getItemById({ id: item.id });
        expect(current).toBeNull();
      });

      it('listItems paginates current items', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'list-items' });
        await datasetsStorage.batchInsertItems({
          datasetId: ds.id,
          items: [{ input: { q: 'a' } }, { input: { q: 'b' } }, { input: { q: 'c' } }],
        });

        const page0 = await datasetsStorage.listItems({ datasetId: ds.id, pagination: { page: 0, perPage: 2 } });
        expect(page0.items).toHaveLength(2);
        expect(page0.pagination.total).toBe(3);
        expect(page0.pagination.hasMore).toBe(true);
      });
    });

    // ---------------------------------------------------------------------------
    // SCD-2 Versioning
    // ---------------------------------------------------------------------------
    describe('SCD-2 Versioning', () => {
      beforeEach(async () => {
        await datasetsStorage.dangerouslyClearAll();
      });

      it('addItem bumps dataset version and inserts version row', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'scd2-add' });
        expect(ds.version).toBe(0);

        const item = await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'hello' } });
        expect(item.datasetVersion).toBe(1);

        // Dataset version bumped
        const refreshed = await datasetsStorage.getDatasetById({ id: ds.id });
        expect(refreshed!.version).toBe(1);

        // dataset_version row exists
        const versions = await datasetsStorage.listDatasetVersions({
          datasetId: ds.id,
          pagination: { page: 0, perPage: 10 },
        });
        expect(versions.versions).toHaveLength(1);
        expect(versions.versions[0]!.version).toBe(1);
      });

      it('item has validTo=NULL and isDeleted=false', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'scd2-flags' });
        const item = await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'test' } });

        const history = await datasetsStorage.getItemHistory(item.id);
        expect(history).toHaveLength(1);
        expect(history[0]!.validTo).toBeNull();
        expect(history[0]!.isDeleted).toBe(false);
      });

      it('updateItem closes old row, inserts new row, bumps version', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'scd2-update' });
        const item = await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'v1' } });

        const updated = await datasetsStorage.updateItem({ id: item.id, datasetId: ds.id, input: { q: 'v2' } });

        expect(updated.datasetVersion).toBe(2);
        expect(updated.input).toEqual({ q: 'v2' });

        const history = await datasetsStorage.getItemHistory(item.id);
        expect(history).toHaveLength(2);

        const oldRow = history.find(h => h.datasetVersion === 1);
        const newRow = history.find(h => h.datasetVersion === 2);

        expect(oldRow!.validTo).toBe(2);
        expect(newRow!.validTo).toBeNull();
        expect(newRow!.isDeleted).toBe(false);
      });

      it('deleteItem closes old row and inserts tombstone', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'scd2-delete' });
        const item = await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'bye' } });

        await datasetsStorage.deleteItem({ id: item.id, datasetId: ds.id });

        const current = await datasetsStorage.getItemById({ id: item.id });
        expect(current).toBeNull();

        const history = await datasetsStorage.getItemHistory(item.id);
        expect(history).toHaveLength(2);

        const tombstone = history.find(h => h.isDeleted);
        expect(tombstone).toBeDefined();
        expect(tombstone!.validTo).toBeNull(); // tombstone is the "current" version
      });

      it('deleteItem tombstone inherits tenancy from parent dataset', async () => {
        const ds = await datasetsStorage.createDataset({
          name: 'scd2-delete-tenancy',
          organizationId: 'org_delete',
          projectId: 'proj_delete',
        });
        const item = await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'bye' } });

        await datasetsStorage.deleteItem({ id: item.id, datasetId: ds.id });

        const history = await datasetsStorage.getItemHistory(item.id);
        const tombstone = history.find(h => h.isDeleted);
        expect(tombstone).toBeDefined();
        expect(tombstone!.organizationId).toBe('org_delete');
        expect(tombstone!.projectId).toBe('proj_delete');
      });

      it('batchDeleteItems tombstones inherit tenancy from parent dataset', async () => {
        const ds = await datasetsStorage.createDataset({
          name: 'scd2-batch-delete-tenancy',
          organizationId: 'org_batch',
          projectId: 'proj_batch',
        });
        const items = await datasetsStorage.batchInsertItems({
          datasetId: ds.id,
          items: [{ input: { q: 'a' } }, { input: { q: 'b' } }],
        });

        await datasetsStorage.batchDeleteItems({
          datasetId: ds.id,
          itemIds: items.map(i => i.id),
        });

        for (const item of items) {
          const history = await datasetsStorage.getItemHistory(item.id);
          const tombstone = history.find(h => h.isDeleted);
          expect(tombstone).toBeDefined();
          expect(tombstone!.organizationId).toBe('org_batch');
          expect(tombstone!.projectId).toBe('proj_batch');
        }
      });

      it('addItem inherits tenancy from parent dataset onto the live row', async () => {
        const ds = await datasetsStorage.createDataset({
          name: 'scd2-add-tenancy',
          organizationId: 'org_add',
          projectId: 'proj_add',
        });
        const item = await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'hello' } });

        expect(item.organizationId).toBe('org_add');
        expect(item.projectId).toBe('proj_add');

        // Also assert via listItems so we exercise the persisted row mapper, not just the returned value
        const listed = await datasetsStorage.listItems({
          datasetId: ds.id,
          pagination: { page: 0, perPage: 10 },
        });
        const persisted = listed.items.find(i => i.id === item.id);
        expect(persisted).toBeDefined();
        expect(persisted!.organizationId).toBe('org_add');
        expect(persisted!.projectId).toBe('proj_add');
      });

      it('updateItem re-inherits tenancy from parent dataset onto the new live row', async () => {
        const ds = await datasetsStorage.createDataset({
          name: 'scd2-update-tenancy',
          organizationId: 'org_update',
          projectId: 'proj_update',
        });
        const item = await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'v1' } });

        const updated = await datasetsStorage.updateItem({
          id: item.id,
          datasetId: ds.id,
          input: { q: 'v2' },
        });

        expect(updated.organizationId).toBe('org_update');
        expect(updated.projectId).toBe('proj_update');

        // History should include the new live row carrying tenancy
        const history = await datasetsStorage.getItemHistory(item.id);
        const live = history.find(h => h.validTo === null && !h.isDeleted);
        expect(live).toBeDefined();
        expect(live!.organizationId).toBe('org_update');
        expect(live!.projectId).toBe('proj_update');
      });
    });

    // ---------------------------------------------------------------------------
    // Version Query Semantics
    // ---------------------------------------------------------------------------
    describe('Version Query Semantics', () => {
      let ds: DatasetRecord;
      let item1: DatasetItem;

      beforeEach(async () => {
        await datasetsStorage.dangerouslyClearAll();
        ds = await datasetsStorage.createDataset({ name: 'scd2-queries' });
        item1 = await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'original' } });
        // version is now 1
        await datasetsStorage.updateItem({ id: item1.id, datasetId: ds.id, input: { q: 'updated' } });
        // version is now 2
      });

      it('getItemById without version returns current row', async () => {
        const current = await datasetsStorage.getItemById({ id: item1.id });
        expect(current!.input).toEqual({ q: 'updated' });
      });

      it('getItemById with version returns that exact version', async () => {
        const v1 = await datasetsStorage.getItemById({ id: item1.id, datasetVersion: 1 });
        expect(v1!.input).toEqual({ q: 'original' });

        const v2 = await datasetsStorage.getItemById({ id: item1.id, datasetVersion: 2 });
        expect(v2!.input).toEqual({ q: 'updated' });
      });

      it('getItemsByVersion returns correct snapshot', async () => {
        // Add another item at version 3 so we have 2 items
        await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'second' } });
        // version is now 3

        // At version 1: only item1 with original value
        const v1Items = await datasetsStorage.getItemsByVersion({ datasetId: ds.id, version: 1 });
        expect(v1Items).toHaveLength(1);
        expect(v1Items[0]!.input).toEqual({ q: 'original' });

        // At version 3: item1 (updated) + second item
        const v3Items = await datasetsStorage.getItemsByVersion({ datasetId: ds.id, version: 3 });
        expect(v3Items).toHaveLength(2);
      });

      it('getItemHistory returns all rows ordered by datasetVersion DESC', async () => {
        const history = await datasetsStorage.getItemHistory(item1.id);
        expect(history.length).toBeGreaterThanOrEqual(2);
        expect(history[0]!.datasetVersion).toBeGreaterThan(history[1]!.datasetVersion);
      });

      it('listItems supports version param for time-travel', async () => {
        await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'second' } });
        // v1: 1 item, v2: 1 item (updated), v3: 2 items

        const v1 = await datasetsStorage.listItems({
          datasetId: ds.id,
          version: 1,
          pagination: { page: 0, perPage: 10 },
        });
        expect(v1.items).toHaveLength(1);

        const v3 = await datasetsStorage.listItems({
          datasetId: ds.id,
          version: 3,
          pagination: { page: 0, perPage: 10 },
        });
        expect(v3.items).toHaveLength(2);
      });

      it('listItems applies search alongside version', async () => {
        // Use a fresh dataset with string-valued inputs because some adapters
        // (mongodb) only run search against string-valued input fields.
        const searchDs = await datasetsStorage.createDataset({ name: 'version-search' });
        const a = await datasetsStorage.addItem({ datasetId: searchDs.id, input: 'alpha-original' });
        await datasetsStorage.addItem({ datasetId: searchDs.id, input: 'beta-original' });
        // v2 now. Updating a -> v3
        await datasetsStorage.updateItem({ id: a.id, datasetId: searchDs.id, input: 'alpha-updated' });

        const searchUpdated = await datasetsStorage.listItems({
          datasetId: searchDs.id,
          version: 3,
          search: 'updated',
          pagination: { page: 0, perPage: 10 },
        });
        expect(searchUpdated.items).toHaveLength(1);
        expect(searchUpdated.items[0]!.input).toBe('alpha-updated');

        // Search at an older version reaches into historical input values
        const searchOriginalAtV2 = await datasetsStorage.listItems({
          datasetId: searchDs.id,
          version: 2,
          search: 'alpha-original',
          pagination: { page: 0, perPage: 10 },
        });
        expect(searchOriginalAtV2.items).toHaveLength(1);
        expect(searchOriginalAtV2.items[0]!.input).toBe('alpha-original');
      });

      it('listItems applies pagination alongside version', async () => {
        // Add two more items so v4 has 3 items: item1 'updated', second, third
        await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'second' } });
        await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'third' } });

        const page0 = await datasetsStorage.listItems({
          datasetId: ds.id,
          version: 4,
          pagination: { page: 0, perPage: 2 },
        });
        expect(page0.items).toHaveLength(2);
        expect(page0.pagination.total).toBe(3);
        expect(page0.pagination.hasMore).toBe(true);

        const page1 = await datasetsStorage.listItems({
          datasetId: ds.id,
          version: 4,
          pagination: { page: 1, perPage: 2 },
        });
        expect(page1.items).toHaveLength(1);
        expect(page1.pagination.hasMore).toBe(false);
      });
    });

    // ---------------------------------------------------------------------------
    // Bulk Operations
    // ---------------------------------------------------------------------------
    describe('Bulk Operations', () => {
      beforeEach(async () => {
        await datasetsStorage.dangerouslyClearAll();
      });

      it('batchInsertItems uses single version bump for all items', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'bulk-add' });

        const items = await datasetsStorage.batchInsertItems({
          datasetId: ds.id,
          items: [{ input: { q: 'a' } }, { input: { q: 'b' } }, { input: { q: 'c' } }],
        });

        expect(items).toHaveLength(3);
        // All items should have the same version
        const versions = new Set(items.map(i => i.datasetVersion));
        expect(versions.size).toBe(1);

        // Dataset version bumped by exactly 1
        const refreshed = await datasetsStorage.getDatasetById({ id: ds.id });
        expect(refreshed!.version).toBe(1);

        // Only 1 dataset_version row
        const dv = await datasetsStorage.listDatasetVersions({
          datasetId: ds.id,
          pagination: { page: 0, perPage: 10 },
        });
        expect(dv.versions).toHaveLength(1);
      });

      itItemIdentity('batchInsertItems treats exact externalId retries as no-ops', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'identity-retry' });
        const payload = { externalId: 'item-1', input: { q: 'same' }, metadata: { source: 'test' } };

        const [first] = await datasetsStorage.batchInsertItems({ datasetId: ds.id, items: [payload] });
        const [retry] = await datasetsStorage.batchInsertItems({ datasetId: ds.id, items: [payload] });

        expect(retry!.id).toBe(first!.id);
        expect(retry!.externalId).toBe('item-1');
        expect(first).not.toHaveProperty('validTo');
        expect(first).not.toHaveProperty('isDeleted');
        expect(retry).not.toHaveProperty('validTo');
        expect(retry).not.toHaveProperty('isDeleted');

        const history = await datasetsStorage.getItemHistory(first!.id);
        expect(history).toHaveLength(1);
        expect(history[0]!.validTo).toBeNull();
        expect(history[0]!.isDeleted).toBe(false);
        expect((await datasetsStorage.getDatasetById({ id: ds.id }))!.version).toBe(1);
      });

      itItemIdentity('batchInsertItems converges concurrent exact externalId retries', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'identity-concurrent' });
        const payload = { externalId: 'item-1', input: { q: 'same' } };

        const [[first], [second]] = await Promise.all([
          datasetsStorage.batchInsertItems({ datasetId: ds.id, items: [payload] }),
          datasetsStorage.batchInsertItems({ datasetId: ds.id, items: [payload] }),
        ]);

        expect(second!.id).toBe(first!.id);
        expect(
          (await datasetsStorage.listItems({ datasetId: ds.id, pagination: { page: 0, perPage: 10 } })).items,
        ).toHaveLength(1);
        expect((await datasetsStorage.getDatasetById({ id: ds.id }))!.version).toBe(1);
      });

      itItemIdentity('batchInsertItems rejects incompatible externalId reuse without mutation', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'identity-conflict' });
        const [first] = await datasetsStorage.batchInsertItems({
          datasetId: ds.id,
          items: [{ externalId: 'item-1', input: { q: 'first' } }],
        });

        await expect(
          datasetsStorage.batchInsertItems({
            datasetId: ds.id,
            items: [
              { externalId: 'item-2', input: { q: 'new' } },
              { externalId: 'item-1', input: { q: 'different' } },
            ],
          }),
        ).rejects.toMatchObject({ id: 'DATASET_ITEM_IDENTITY_CONFLICT' });

        expect((await datasetsStorage.getDatasetById({ id: ds.id }))!.version).toBe(1);
        expect(
          (await datasetsStorage.listItems({ datasetId: ds.id, pagination: { page: 0, perPage: 10 } })).items,
        ).toEqual([expect.objectContaining({ id: first!.id })]);
      });

      itItemIdentity('batchInsertItems resolves equivalent request-local identities to one item', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'identity-local-duplicate' });
        const items = await datasetsStorage.batchInsertItems({
          datasetId: ds.id,
          items: [
            { externalId: 'item-1', input: { q: 'same' } },
            { externalId: 'item-1', input: { q: 'same' } },
            { input: { q: 'append' } },
          ],
        });

        expect(items).toHaveLength(3);
        expect(items[0]!.id).toBe(items[1]!.id);
        expect(items[2]!.id).not.toBe(items[0]!.id);
        expect(
          (await datasetsStorage.listItems({ datasetId: ds.id, pagination: { page: 0, perPage: 10 } })).items,
        ).toHaveLength(2);
      });

      itItemIdentity('batchInsertItems rejects incompatible request-local identities', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'identity-local-conflict' });

        await expect(
          datasetsStorage.batchInsertItems({
            datasetId: ds.id,
            items: [
              { externalId: 'item-1', input: { q: 'first' } },
              { externalId: 'item-1', input: { q: 'different' } },
            ],
          }),
        ).rejects.toMatchObject({ id: 'DATASET_ITEM_IDENTITY_CONFLICT' });

        expect((await datasetsStorage.getDatasetById({ id: ds.id }))!.version).toBe(0);
      });

      itItemIdentity('preserves externalId through updates and compares retries against the first row', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'identity-update' });
        const original = { externalId: 'item-1', input: { q: 'original' } };
        const [created] = await datasetsStorage.batchInsertItems({ datasetId: ds.id, items: [original] });
        const updated = await datasetsStorage.updateItem({
          id: created!.id,
          datasetId: ds.id,
          input: { q: 'updated' },
        });

        expect(updated.externalId).toBe('item-1');
        const [retry] = await datasetsStorage.batchInsertItems({ datasetId: ds.id, items: [original] });
        expect(retry!.id).toBe(created!.id);
        expect(retry!.input).toEqual({ q: 'updated' });
        expect((await datasetsStorage.getDatasetById({ id: ds.id }))!.version).toBe(2);
      });

      itItemIdentity('keeps deleted externalIds reserved', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'identity-delete' });
        const original = { externalId: 'item-1', input: { q: 'original' } };
        const [created] = await datasetsStorage.batchInsertItems({ datasetId: ds.id, items: [original] });
        await datasetsStorage.deleteItem({ id: created!.id, datasetId: ds.id });

        await expect(datasetsStorage.batchInsertItems({ datasetId: ds.id, items: [original] })).rejects.toMatchObject({
          id: 'DATASET_ITEM_IDENTITY_CONFLICT',
          conflicts: [expect.objectContaining({ reason: 'deleted' })],
        });
        expect((await datasetsStorage.getDatasetById({ id: ds.id }))!.version).toBe(2);
      });

      itItemIdentity('scopes externalId identity to the dataset', async () => {
        const firstDataset = await datasetsStorage.createDataset({ name: 'identity-scope-1' });
        const secondDataset = await datasetsStorage.createDataset({ name: 'identity-scope-2' });
        const payload = { externalId: 'shared', input: { q: 'same' } };

        const [first] = await datasetsStorage.batchInsertItems({ datasetId: firstDataset.id, items: [payload] });
        const [second] = await datasetsStorage.batchInsertItems({ datasetId: secondDataset.id, items: [payload] });

        expect(first!.id).not.toBe(second!.id);
      });

      it('treats empty batches as true no-ops', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'empty-batch' });
        await expect(datasetsStorage.batchInsertItems({ datasetId: ds.id, items: [] })).resolves.toEqual([]);
        expect((await datasetsStorage.getDatasetById({ id: ds.id }))!.version).toBe(0);
      });

      it('batchInsertItems validates against inputSchema', async () => {
        const ds = await datasetsStorage.createDataset({
          name: 'schema-test',
          inputSchema: {
            type: 'object',
            properties: { prompt: { type: 'string' } },
            required: ['prompt'],
          },
        });

        const validResult = await datasetsStorage.batchInsertItems({
          datasetId: ds.id,
          items: [{ input: { prompt: 'hello' } }, { input: { prompt: 'world' } }],
        });
        expect(validResult).toHaveLength(2);

        await expect(
          datasetsStorage.batchInsertItems({
            datasetId: ds.id,
            items: [{ input: { notPrompt: 123 } }],
          }),
        ).rejects.toThrow();
      });

      it('batchDeleteItems creates tombstones for all items', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'bulk-delete' });
        const items = await datasetsStorage.batchInsertItems({
          datasetId: ds.id,
          items: [{ input: { q: 'x' } }, { input: { q: 'y' } }],
        });

        await datasetsStorage.batchDeleteItems({
          datasetId: ds.id,
          itemIds: items.map(i => i.id),
        });

        // No current items visible
        const list = await datasetsStorage.listItems({ datasetId: ds.id, pagination: { page: 0, perPage: 10 } });
        expect(list.items).toHaveLength(0);

        // Version bumped by 1 more (total 2: 1 for bulk add + 1 for bulk delete)
        const refreshed = await datasetsStorage.getDatasetById({ id: ds.id });
        expect(refreshed!.version).toBe(2);
      });
    });

    // ---------------------------------------------------------------------------
    // Edge Cases
    // ---------------------------------------------------------------------------
    describe('Edge Cases', () => {
      beforeEach(async () => {
        await datasetsStorage.dangerouslyClearAll();
      });

      it('getDatasetById returns null for non-existent id', async () => {
        const result = await datasetsStorage.getDatasetById({ id: 'nonexistent-id' });
        expect(result).toBeNull();
      });

      it('getItemById returns null for non-existent id', async () => {
        const result = await datasetsStorage.getItemById({ id: 'nonexistent-id' });
        expect(result).toBeNull();
      });

      it('complex JSON roundtrips correctly', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'json-test' });
        const complexInput = {
          nested: { deeply: { value: [1, 2, 3] } },
          nullVal: null,
          boolVal: true,
          numVal: 42.5,
        };

        const item = await datasetsStorage.addItem({ datasetId: ds.id, input: complexInput });
        const retrieved = await datasetsStorage.getItemById({ id: item.id });

        expect(retrieved!.input).toEqual(complexInput);
      });

      it('dangerouslyClearAll empties all tables', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'clear-test' });
        await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'data' } });

        await datasetsStorage.dangerouslyClearAll();

        const list = await datasetsStorage.listDatasets({ pagination: { page: 0, perPage: 10 } });
        expect(list.datasets).toHaveLength(0);
      });

      it('dataset versions paginate and order by version DESC', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'ver-list' });
        await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'a' } }); // v1
        await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'b' } }); // v2
        await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'c' } }); // v3

        const result = await datasetsStorage.listDatasetVersions({
          datasetId: ds.id,
          pagination: { page: 0, perPage: 2 },
        });

        expect(result.versions).toHaveLength(2);
        expect(result.versions[0]!.version).toBeGreaterThan(result.versions[1]!.version);
        expect(result.pagination.total).toBe(3);
        expect(result.pagination.hasMore).toBe(true);
      });
    });
  }); // describeDatasets
}
