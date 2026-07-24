import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { MastraStorage, ExperimentsStorage, DatasetsStorage, Experiment } from '@mastra/core/storage';
import type { TestCapabilities } from '../../factory';

export function createExperimentsTests({
  storage,
  capabilities = {},
}: {
  storage: MastraStorage;
  capabilities?: TestCapabilities;
}) {
  // Skip tests if storage doesn't have experiments domain
  const describeExperiments = storage.stores?.experiments ? describe : describe.skip;
  const supportsToolMocks = capabilities.toolMocks !== false;

  let experimentsStorage: ExperimentsStorage;
  // Optional — needed for cascade / filter-by-datasetId tests
  let datasetsStorage: DatasetsStorage | undefined;

  describeExperiments('Experiments Storage', () => {
    beforeAll(async () => {
      const store = await storage.getStore('experiments');
      if (!store) {
        throw new Error('Experiments storage not found');
      }
      experimentsStorage = store;
      datasetsStorage = (await storage.getStore('datasets')) ?? undefined;
    });

    // ---------------------------------------------------------------------------
    // Experiment CRUD
    // ---------------------------------------------------------------------------
    describe('Experiment CRUD', () => {
      beforeEach(async () => {
        await experimentsStorage.dangerouslyClearAll();
        if (datasetsStorage) {
          await datasetsStorage.dangerouslyClearAll();
        }
      });

      it('createExperiment returns experiment with pending status and zero counts', async () => {
        const exp = await experimentsStorage.createExperiment({
          name: 'test-exp',
          datasetId: null,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 5,
          thresholds: [
            { scorerId: 'quality', threshold: { min: 0.7, max: 0.9 }, targetScope: 'span' },
            { scorerId: 'style', threshold: 0.6, targetScope: 'span', stepId: 'draft' },
          ],
        });

        expect(exp.id).toBeDefined();
        expect(exp.name).toBe('test-exp');
        expect(exp.status).toBe('pending');
        expect(exp.executionStatusCounts).toEqual({ completed: 0, skipped: 0, error: 0, cancelled: 0 });
        expect(exp.scorerStatusCounts).toEqual({ completed: 0, error: 0 });
        expect(exp.thresholds).toEqual([
          { scorerId: 'quality', threshold: { min: 0.7, max: 0.9 }, targetScope: 'span' },
          { scorerId: 'style', threshold: 0.6, targetScope: 'span', stepId: 'draft' },
        ]);
        expect(exp.succeededCount).toBe(0);
        expect(exp.failedCount).toBe(0);
        expect(exp.skippedCount).toBe(0);

        const fetched = await experimentsStorage.getExperimentById({ id: exp.id });
        expect(fetched?.executionStatusCounts).toEqual(exp.executionStatusCounts);
        expect(fetched?.scorerStatusCounts).toEqual(exp.scorerStatusCounts);
        expect(fetched?.thresholds).toEqual(exp.thresholds);
      });

      it('createExperiment accepts custom id', async () => {
        const customId = 'custom-exp-id';
        const exp = await experimentsStorage.createExperiment({
          id: customId,
          name: 'custom-id-exp',
          datasetId: null,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 1,
        });

        expect(exp.id).toBe(customId);
      });

      it('createExperiment with null datasetId', async () => {
        const exp = await experimentsStorage.createExperiment({
          name: 'no-dataset-exp',
          datasetId: null,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 1,
        });

        expect(exp.datasetId).toBeNull();
        expect(exp.datasetVersion).toBeNull();
      });

      it('getExperimentById returns experiment or null', async () => {
        const exp = await experimentsStorage.createExperiment({
          name: 'get-exp',
          datasetId: null,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 1,
        });

        const found = await experimentsStorage.getExperimentById({ id: exp.id });
        const notFound = await experimentsStorage.getExperimentById({ id: 'nonexistent' });

        expect(found).toBeDefined();
        expect(found!.id).toBe(exp.id);
        expect(notFound).toBeNull();
      });

      it('createExperiment stores datasetVersion as integer', async () => {
        const exp = await experimentsStorage.createExperiment({
          name: 'version-type-exp',
          datasetId: 'ds-1',
          datasetVersion: 5,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 1,
        });

        expect(exp.datasetVersion).toBe(5);
        expect(typeof exp.datasetVersion).toBe('number');

        const fetched = await experimentsStorage.getExperimentById({ id: exp.id });
        expect(fetched!.datasetVersion).toBe(5);
      });

      it('updateExperiment updates fields and returns updated record', async () => {
        const exp = await experimentsStorage.createExperiment({
          name: 'update-exp',
          datasetId: null,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 3,
        });

        const updated = await experimentsStorage.updateExperiment({
          id: exp.id,
          status: 'running',
          executionStatusCounts: { completed: 1, skipped: 0, error: 1, cancelled: 1 },
          scorerStatusCounts: { completed: 4, error: 2 },
          succeededCount: 1,
          failedCount: 2,
        });

        expect(updated.status).toBe('running');
        expect(updated.executionStatusCounts).toEqual({ completed: 1, skipped: 0, error: 1, cancelled: 1 });
        expect(updated.scorerStatusCounts).toEqual({ completed: 4, error: 2 });
        expect(updated.succeededCount).toBe(1);
        expect(updated.failedCount).toBe(2);
        expect(updated.id).toBe(exp.id);
      });

      it('updateExperiment returns complete object including name, description, metadata, skippedCount', async () => {
        const exp = await experimentsStorage.createExperiment({
          name: 'F2 Experiment',
          description: 'A test',
          metadata: { key: 'value' },
          datasetId: null,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 5,
        });

        const updated = await experimentsStorage.updateExperiment({
          id: exp.id,
          status: 'running',
          skippedCount: 1,
        });

        expect(updated.name).toBe('F2 Experiment');
        expect(updated.description).toBe('A test');
        expect(updated.metadata).toEqual({ key: 'value' });
        expect(updated.skippedCount).toBe(1);
        expect(updated.executionStatusCounts).toEqual({ completed: 0, skipped: 1, error: 0, cancelled: 0 });
      });

      it('createExperiment sets initial totalItems and updateExperiment persists change', async () => {
        const exp = await experimentsStorage.createExperiment({
          name: 'total-items-exp',
          datasetId: null,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 0,
        });

        expect(exp.totalItems).toBe(0);

        const updated = await experimentsStorage.updateExperiment({
          id: exp.id,
          totalItems: 10,
        });

        expect(updated.totalItems).toBe(10);
      });

      it('updateExperiment throws for non-existent experiment', async () => {
        await expect(experimentsStorage.updateExperiment({ id: 'non-existent', status: 'running' })).rejects.toThrow();
      });

      it('listExperiments with pagination', async () => {
        for (let i = 0; i < 3; i++) {
          await experimentsStorage.createExperiment({
            name: `exp-${i}`,
            datasetId: null,
            datasetVersion: null,
            targetType: 'agent',
            targetId: 'agent-1',
            totalItems: 1,
          });
        }

        const page0 = await experimentsStorage.listExperiments({ pagination: { page: 0, perPage: 2 } });
        expect(page0.experiments).toHaveLength(2);
        expect(page0.pagination.total).toBe(3);
        expect(page0.pagination.hasMore).toBe(true);
      });

      it('deleteExperiment cascades to results', async () => {
        const exp = await experimentsStorage.createExperiment({
          name: 'delete-exp',
          datasetId: null,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 1,
        });

        await experimentsStorage.addExperimentResult({
          experimentId: exp.id,
          itemId: 'item-1',
          itemDatasetVersion: null,
          input: { q: 'test' },
          output: null,
          groundTruth: null,
          error: null,
          startedAt: new Date(),
          completedAt: new Date(),
          retryCount: 0,
        });

        await experimentsStorage.deleteExperiment({ id: exp.id });

        expect(await experimentsStorage.getExperimentById({ id: exp.id })).toBeNull();
      });

      // listExperiments filter by datasetId — requires datasets domain
      it('listExperiments filters by datasetId', async () => {
        if (!datasetsStorage) {
          return; // skip if datasets domain not available
        }

        const ds = await datasetsStorage.createDataset({ name: 'filter-ds' });

        await experimentsStorage.createExperiment({
          name: 'exp-with-ds',
          datasetId: ds.id,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 1,
        });
        await experimentsStorage.createExperiment({
          name: 'exp-no-ds',
          datasetId: null,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 1,
        });

        const filtered = await experimentsStorage.listExperiments({
          datasetId: ds.id,
          pagination: { page: 0, perPage: 10 },
        });
        expect(filtered.experiments).toHaveLength(1);
        expect(filtered.experiments[0]!.name).toBe('exp-with-ds');
      });
    });

    // ---------------------------------------------------------------------------
    // Experiment Results
    // ---------------------------------------------------------------------------
    describe('Experiment Results', () => {
      let exp: Experiment;

      beforeEach(async () => {
        await experimentsStorage.dangerouslyClearAll();
        exp = await experimentsStorage.createExperiment({
          name: 'results-exp',
          datasetId: null,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 3,
        });
      });

      it('addExperimentResult inserts a result row', async () => {
        const result = await experimentsStorage.addExperimentResult({
          experimentId: exp.id,
          itemId: 'item-1',
          itemDatasetVersion: null,
          input: { q: 'hello' },
          output: { a: 'world' },
          groundTruth: null,
          error: null,
          executionStatus: 'completed',
          startedAt: new Date(),
          completedAt: new Date(),
          retryCount: 0,
        });

        expect(result.id).toBeDefined();
        expect(result.experimentId).toBe(exp.id);
        expect(result.input).toEqual({ q: 'hello' });
        expect(result.executionStatus).toBe('completed');

        const fetched = await experimentsStorage.getExperimentResultById({ id: result.id });
        expect(fetched?.executionStatus).toBe('completed');
      });

      it('addExperimentResult with integer itemDatasetVersion', async () => {
        const result = await experimentsStorage.addExperimentResult({
          experimentId: exp.id,
          itemId: 'item-1',
          itemDatasetVersion: 42,
          input: { q: 'hello' },
          output: null,
          groundTruth: null,
          error: null,
          startedAt: new Date(),
          completedAt: new Date(),
          retryCount: 0,
        });

        expect(result.itemDatasetVersion).toBe(42);
      });

      it('addExperimentResult with null output and error field', async () => {
        const errorObj = { message: 'Something failed', code: 'ERR_TEST' };
        const result = await experimentsStorage.addExperimentResult({
          experimentId: exp.id,
          itemId: 'item-err',
          itemDatasetVersion: null,
          input: { q: 'fail' },
          output: null,
          groundTruth: null,
          error: errorObj,
          startedAt: new Date(),
          completedAt: new Date(),
          retryCount: 1,
        });

        expect(result.output).toBeNull();
        expect(result.error).toEqual(errorObj);
        expect(result.retryCount).toBe(1);
      });

      const toolMockReportFixture = {
        served: [{ mockIndex: 0, toolName: 'getWeather', args: { city: 'Seattle' } }],
        unconsumed: [{ mockIndex: 1, toolName: 'getWeather', args: { city: 'Paris' } }],
        liveCalls: [{ toolName: 'search', args: { q: 'x' } }],
        failure: { code: 'TOOL_MOCK_MISMATCH' as const, toolName: 'getWeather', args: { city: 'NYC' } },
      };

      (supportsToolMocks ? it : it.skip)('addExperimentResult persists toolMockReport and reads it back', async () => {
        const toolMockReport = toolMockReportFixture;
        const created = await experimentsStorage.addExperimentResult({
          experimentId: exp.id,
          itemId: 'item-mock',
          itemDatasetVersion: null,
          input: { q: 'hello' },
          output: null,
          groundTruth: null,
          error: null,
          startedAt: new Date(),
          completedAt: new Date(),
          retryCount: 0,
          toolMockReport,
        });
        expect(created.toolMockReport).toEqual(toolMockReport);

        const found = await experimentsStorage.getExperimentResultById({ id: created.id });
        expect(found!.toolMockReport).toEqual(toolMockReport);
      });

      (supportsToolMocks ? it.skip : it)('rejects toolMockReport when the adapter does not support it', async () => {
        await expect(
          experimentsStorage.addExperimentResult({
            experimentId: exp.id,
            itemId: 'item-mock-reject',
            itemDatasetVersion: null,
            input: { q: 'hello' },
            output: null,
            groundTruth: null,
            error: null,
            startedAt: new Date(),
            completedAt: new Date(),
            retryCount: 0,
            toolMockReport: toolMockReportFixture,
          }),
        ).rejects.toThrow();
      });

      it('getExperimentResultById returns result or null', async () => {
        const result = await experimentsStorage.addExperimentResult({
          experimentId: exp.id,
          itemId: 'item-1',
          itemDatasetVersion: null,
          input: { q: 'test' },
          output: null,
          groundTruth: null,
          error: null,
          startedAt: new Date(),
          completedAt: new Date(),
          retryCount: 0,
        });

        const found = await experimentsStorage.getExperimentResultById({ id: result.id });
        const notFound = await experimentsStorage.getExperimentResultById({ id: 'nonexistent' });

        expect(found).toBeDefined();
        expect(found!.id).toBe(result.id);
        expect(notFound).toBeNull();
      });

      it('listExperimentResults paginates and orders by startedAt ASC', async () => {
        const now = new Date();
        for (let i = 0; i < 3; i++) {
          await experimentsStorage.addExperimentResult({
            experimentId: exp.id,
            itemId: `item-${i}`,
            itemDatasetVersion: null,
            input: { q: `q${i}` },
            output: null,
            groundTruth: null,
            error: null,
            startedAt: new Date(now.getTime() + i * 1000),
            completedAt: new Date(now.getTime() + i * 1000 + 500),
            retryCount: 0,
          });
        }

        const results = await experimentsStorage.listExperimentResults({
          experimentId: exp.id,
          pagination: { page: 0, perPage: 2 },
        });

        expect(results.results).toHaveLength(2);
        expect(results.pagination.total).toBe(3);
        // Ordered by startedAt ASC
        expect(new Date(results.results[0]!.startedAt).getTime()).toBeLessThanOrEqual(
          new Date(results.results[1]!.startedAt).getTime(),
        );
      });

      it('deleteExperimentResults removes all results for experimentId', async () => {
        await experimentsStorage.addExperimentResult({
          experimentId: exp.id,
          itemId: 'item-1',
          itemDatasetVersion: null,
          input: { q: 'a' },
          output: null,
          groundTruth: null,
          error: null,
          startedAt: new Date(),
          completedAt: new Date(),
          retryCount: 0,
        });
        await experimentsStorage.addExperimentResult({
          experimentId: exp.id,
          itemId: 'item-2',
          itemDatasetVersion: null,
          input: { q: 'b' },
          output: null,
          groundTruth: null,
          error: null,
          startedAt: new Date(),
          completedAt: new Date(),
          retryCount: 0,
        });

        await experimentsStorage.deleteExperimentResults({ experimentId: exp.id });

        const results = await experimentsStorage.listExperimentResults({
          experimentId: exp.id,
          pagination: { page: 0, perPage: 10 },
        });
        expect(results.results).toHaveLength(0);
      });
    });

    // ---------------------------------------------------------------------------
    // Edge Cases
    // ---------------------------------------------------------------------------
    describe('Edge Cases', () => {
      beforeEach(async () => {
        await experimentsStorage.dangerouslyClearAll();
      });

      it('getExperimentById returns null for non-existent id', async () => {
        const result = await experimentsStorage.getExperimentById({ id: 'nonexistent-id' });
        expect(result).toBeNull();
      });

      it('getExperimentResultById returns null for non-existent id', async () => {
        const result = await experimentsStorage.getExperimentResultById({ id: 'nonexistent-id' });
        expect(result).toBeNull();
      });

      it('dangerouslyClearAll empties all tables', async () => {
        const exp = await experimentsStorage.createExperiment({
          name: 'clear-exp',
          datasetId: null,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 1,
        });
        await experimentsStorage.addExperimentResult({
          experimentId: exp.id,
          itemId: 'item-1',
          itemDatasetVersion: null,
          input: { q: 'data' },
          output: null,
          groundTruth: null,
          error: null,
          startedAt: new Date(),
          completedAt: new Date(),
          retryCount: 0,
        });

        await experimentsStorage.dangerouslyClearAll();

        const list = await experimentsStorage.listExperiments({ pagination: { page: 0, perPage: 10 } });
        expect(list.experiments).toHaveLength(0);
      });
    });

    // ---------------------------------------------------------------------------
    // Tenancy
    // ---------------------------------------------------------------------------
    describe('Tenancy', () => {
      beforeEach(async () => {
        await experimentsStorage.dangerouslyClearAll();
      });

      it('createExperiment persists organizationId and projectId', async () => {
        const exp = await experimentsStorage.createExperiment({
          name: 'tenancy-create',
          datasetId: null,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 1,
          organizationId: 'org_a',
          projectId: 'proj_a',
        });

        expect(exp.organizationId).toBe('org_a');
        expect(exp.projectId).toBe('proj_a');

        const reread = await experimentsStorage.getExperimentById({ id: exp.id });
        expect(reread?.organizationId).toBe('org_a');
        expect(reread?.projectId).toBe('proj_a');
      });

      it('createExperiment defaults tenancy fields to null when omitted', async () => {
        const exp = await experimentsStorage.createExperiment({
          name: 'tenancy-null',
          datasetId: null,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 1,
        });

        expect(exp.organizationId).toBeNull();
        expect(exp.projectId).toBeNull();
      });

      it('listExperiments filters by organizationId and projectId', async () => {
        await experimentsStorage.createExperiment({
          name: 'a-1',
          datasetId: null,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 1,
          organizationId: 'org_a',
          projectId: 'proj_1',
        });
        await experimentsStorage.createExperiment({
          name: 'a-2',
          datasetId: null,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 1,
          organizationId: 'org_a',
          projectId: 'proj_2',
        });
        await experimentsStorage.createExperiment({
          name: 'b-1',
          datasetId: null,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 1,
          organizationId: 'org_b',
          projectId: 'proj_1',
        });

        const byOrg = await experimentsStorage.listExperiments({
          pagination: { page: 0, perPage: 50 },
          filters: { organizationId: 'org_a' },
        });
        expect(byOrg.experiments.map(e => e.name).sort()).toEqual(['a-1', 'a-2']);

        const byOrgAndProject = await experimentsStorage.listExperiments({
          pagination: { page: 0, perPage: 50 },
          filters: { organizationId: 'org_a', projectId: 'proj_1' },
        });
        expect(byOrgAndProject.experiments.map(e => e.name)).toEqual(['a-1']);
      });

      it('addExperimentResult persists tenancy inherited from parent and listExperimentResults filters by it', async () => {
        // Two experiments under distinct tenancies — results denormalize their
        // parent's tenancy, mirroring the materializer/runner contract. We do
        // NOT cross-stamp results from a different tenancy onto the same
        // experiment: that would violate the parent→child invariant.
        const expA = await experimentsStorage.createExperiment({
          name: 'results-tenancy-a',
          datasetId: null,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 1,
          organizationId: 'org_a',
          projectId: 'proj_a',
        });
        const expB = await experimentsStorage.createExperiment({
          name: 'results-tenancy-b',
          datasetId: null,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 1,
          organizationId: 'org_b',
          projectId: 'proj_b',
        });

        await experimentsStorage.addExperimentResult({
          experimentId: expA.id,
          itemId: 'item-1',
          itemDatasetVersion: null,
          input: { x: 1 },
          output: { y: 1 },
          groundTruth: null,
          error: null,
          startedAt: new Date(),
          completedAt: new Date(),
          retryCount: 0,
          organizationId: expA.organizationId,
          projectId: expA.projectId,
        });
        await experimentsStorage.addExperimentResult({
          experimentId: expB.id,
          itemId: 'item-2',
          itemDatasetVersion: null,
          input: { x: 2 },
          output: { y: 2 },
          groundTruth: null,
          error: null,
          startedAt: new Date(),
          completedAt: new Date(),
          retryCount: 0,
          organizationId: expB.organizationId,
          projectId: expB.projectId,
        });

        // Filtering expA's results by org_a returns the one inherited result;
        // filtering by org_b returns nothing because expA's results inherit
        // expA's tenancy.
        const expAOrgA = await experimentsStorage.listExperimentResults({
          experimentId: expA.id,
          pagination: { page: 0, perPage: 50 },
          filters: { organizationId: 'org_a' },
        });
        expect(expAOrgA.results.map(r => r.itemId)).toEqual(['item-1']);
        expect(expAOrgA.results[0]!.organizationId).toBe('org_a');
        expect(expAOrgA.results[0]!.projectId).toBe('proj_a');

        const expAOrgB = await experimentsStorage.listExperimentResults({
          experimentId: expA.id,
          pagination: { page: 0, perPage: 50 },
          filters: { organizationId: 'org_b' },
        });
        expect(expAOrgB.results).toEqual([]);

        // Symmetric check for expB filtered by its own project.
        const expBProjB = await experimentsStorage.listExperimentResults({
          experimentId: expB.id,
          pagination: { page: 0, perPage: 50 },
          filters: { projectId: 'proj_b' },
        });
        expect(expBProjB.results.map(r => r.itemId)).toEqual(['item-2']);
        expect(expBProjB.results[0]!.organizationId).toBe('org_b');
        expect(expBProjB.results[0]!.projectId).toBe('proj_b');
      });

      it('getExperimentById returns row when tenancy filters match', async () => {
        const exp = await experimentsStorage.createExperiment({
          name: 'get-tenancy-match',
          datasetId: null,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 1,
          organizationId: 'org_a',
          projectId: 'proj_a',
        });

        const reread = await experimentsStorage.getExperimentById({
          id: exp.id,
          filters: { organizationId: 'org_a', projectId: 'proj_a' },
        });
        expect(reread?.id).toBe(exp.id);
        expect(reread?.organizationId).toBe('org_a');
        expect(reread?.projectId).toBe('proj_a');
      });

      it('getExperimentById returns null on tenancy mismatch (no cross-tenant existence leak)', async () => {
        const exp = await experimentsStorage.createExperiment({
          name: 'get-tenancy-mismatch',
          datasetId: null,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 1,
          organizationId: 'org_a',
          projectId: 'proj_a',
        });

        // Wrong organization
        const wrongOrg = await experimentsStorage.getExperimentById({
          id: exp.id,
          filters: { organizationId: 'org_b' },
        });
        expect(wrongOrg).toBeNull();

        // Wrong project (right org)
        const wrongProject = await experimentsStorage.getExperimentById({
          id: exp.id,
          filters: { organizationId: 'org_a', projectId: 'proj_b' },
        });
        expect(wrongProject).toBeNull();
      });

      it('getExperimentById ignores filters when omitted (backward compatible)', async () => {
        const exp = await experimentsStorage.createExperiment({
          name: 'get-no-filters',
          datasetId: null,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 1,
          organizationId: 'org_a',
          projectId: 'proj_a',
        });

        const reread = await experimentsStorage.getExperimentById({ id: exp.id });
        expect(reread?.id).toBe(exp.id);
      });

      it('getExperimentResultById returns row when tenancy filters match', async () => {
        const exp = await experimentsStorage.createExperiment({
          name: 'result-tenancy-match',
          datasetId: null,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 1,
          organizationId: 'org_a',
          projectId: 'proj_a',
        });

        const result = await experimentsStorage.addExperimentResult({
          experimentId: exp.id,
          itemId: 'item-1',
          itemDatasetVersion: null,
          input: { text: 'hi' },
          groundTruth: null,
          output: { text: 'ok' },
          error: null,
          startedAt: new Date(),
          completedAt: new Date(),
          retryCount: 0,
          organizationId: exp.organizationId,
          projectId: exp.projectId,
        });

        const reread = await experimentsStorage.getExperimentResultById({
          id: result.id,
          filters: { organizationId: 'org_a', projectId: 'proj_a' },
        });
        expect(reread?.id).toBe(result.id);
        expect(reread?.organizationId).toBe('org_a');
        expect(reread?.projectId).toBe('proj_a');
      });

      it('getExperimentResultById returns null on tenancy mismatch', async () => {
        const exp = await experimentsStorage.createExperiment({
          name: 'result-tenancy-mismatch',
          datasetId: null,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 1,
          organizationId: 'org_a',
          projectId: 'proj_a',
        });

        const result = await experimentsStorage.addExperimentResult({
          experimentId: exp.id,
          itemId: 'item-1',
          itemDatasetVersion: null,
          input: { text: 'hi' },
          groundTruth: null,
          output: { text: 'ok' },
          error: null,
          startedAt: new Date(),
          completedAt: new Date(),
          retryCount: 0,
          organizationId: exp.organizationId,
          projectId: exp.projectId,
        });

        const wrongOrg = await experimentsStorage.getExperimentResultById({
          id: result.id,
          filters: { organizationId: 'org_b' },
        });
        expect(wrongOrg).toBeNull();

        const wrongProject = await experimentsStorage.getExperimentResultById({
          id: result.id,
          filters: { organizationId: 'org_a', projectId: 'proj_b' },
        });
        expect(wrongProject).toBeNull();
      });

      it('deleteExperiment is a silent no-op on tenancy mismatch and preserves the row', async () => {
        const exp = await experimentsStorage.createExperiment({
          name: 'delete-tenancy-mismatch',
          datasetId: null,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 1,
          organizationId: 'org_a',
          projectId: 'proj_a',
        });

        const result = await experimentsStorage.addExperimentResult({
          experimentId: exp.id,
          itemId: 'item-1',
          itemDatasetVersion: null,
          input: { text: 'hi' },
          groundTruth: null,
          output: { text: 'ok' },
          error: null,
          startedAt: new Date(),
          completedAt: new Date(),
          retryCount: 0,
          organizationId: exp.organizationId,
          projectId: exp.projectId,
        });

        // Wrong org — must not throw and must not delete
        await experimentsStorage.deleteExperiment({
          id: exp.id,
          filters: { organizationId: 'org_b' },
        });

        // Wrong project (right org) — must not throw and must not delete
        await experimentsStorage.deleteExperiment({
          id: exp.id,
          filters: { organizationId: 'org_a', projectId: 'proj_b' },
        });

        const stillThere = await experimentsStorage.getExperimentById({ id: exp.id });
        expect(stillThere?.id).toBe(exp.id);
        const stillHasResult = await experimentsStorage.getExperimentResultById({ id: result.id });
        expect(stillHasResult?.id).toBe(result.id);
      });

      it('deleteExperiment deletes when tenancy filters match and cascades to results', async () => {
        const exp = await experimentsStorage.createExperiment({
          name: 'delete-tenancy-match',
          datasetId: null,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 1,
          organizationId: 'org_a',
          projectId: 'proj_a',
        });

        const result = await experimentsStorage.addExperimentResult({
          experimentId: exp.id,
          itemId: 'item-1',
          itemDatasetVersion: null,
          input: { text: 'hi' },
          groundTruth: null,
          output: { text: 'ok' },
          error: null,
          startedAt: new Date(),
          completedAt: new Date(),
          retryCount: 0,
          organizationId: exp.organizationId,
          projectId: exp.projectId,
        });

        await experimentsStorage.deleteExperiment({
          id: exp.id,
          filters: { organizationId: 'org_a', projectId: 'proj_a' },
        });

        const gone = await experimentsStorage.getExperimentById({ id: exp.id });
        expect(gone).toBeNull();
        const goneResult = await experimentsStorage.getExperimentResultById({ id: result.id });
        expect(goneResult).toBeNull();
      });

      it('deleteExperiment ignores filters when omitted (backward compatible)', async () => {
        const exp = await experimentsStorage.createExperiment({
          name: 'delete-no-filters',
          datasetId: null,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 1,
          organizationId: 'org_a',
          projectId: 'proj_a',
        });

        await experimentsStorage.deleteExperiment({ id: exp.id });
        const gone = await experimentsStorage.getExperimentById({ id: exp.id });
        expect(gone).toBeNull();
      });

      it('deleteExperimentResults is a silent no-op on tenancy mismatch and preserves rows', async () => {
        const exp = await experimentsStorage.createExperiment({
          name: 'delete-results-tenancy-mismatch',
          datasetId: null,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 1,
          organizationId: 'org_a',
          projectId: 'proj_a',
        });

        const result = await experimentsStorage.addExperimentResult({
          experimentId: exp.id,
          itemId: 'item-1',
          itemDatasetVersion: null,
          input: { text: 'hi' },
          groundTruth: null,
          output: { text: 'ok' },
          error: null,
          startedAt: new Date(),
          completedAt: new Date(),
          retryCount: 0,
          organizationId: exp.organizationId,
          projectId: exp.projectId,
        });

        await experimentsStorage.deleteExperimentResults({
          experimentId: exp.id,
          filters: { organizationId: 'org_b' },
        });
        await experimentsStorage.deleteExperimentResults({
          experimentId: exp.id,
          filters: { organizationId: 'org_a', projectId: 'proj_b' },
        });

        const stillThere = await experimentsStorage.getExperimentResultById({ id: result.id });
        expect(stillThere?.id).toBe(result.id);
      });

      it('deleteExperimentResults removes all results when tenancy filters match', async () => {
        const exp = await experimentsStorage.createExperiment({
          name: 'delete-results-tenancy-match',
          datasetId: null,
          datasetVersion: null,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 1,
          organizationId: 'org_a',
          projectId: 'proj_a',
        });

        const result = await experimentsStorage.addExperimentResult({
          experimentId: exp.id,
          itemId: 'item-1',
          itemDatasetVersion: null,
          input: { text: 'hi' },
          groundTruth: null,
          output: { text: 'ok' },
          error: null,
          startedAt: new Date(),
          completedAt: new Date(),
          retryCount: 0,
          organizationId: exp.organizationId,
          projectId: exp.projectId,
        });

        await experimentsStorage.deleteExperimentResults({
          experimentId: exp.id,
          filters: { organizationId: 'org_a', projectId: 'proj_a' },
        });

        const gone = await experimentsStorage.getExperimentResultById({ id: result.id });
        expect(gone).toBeNull();
        // Parent experiment stays; only results were removed.
        const parent = await experimentsStorage.getExperimentById({ id: exp.id });
        expect(parent?.id).toBe(exp.id);
      });
    });
  }); // describeExperiments
}
