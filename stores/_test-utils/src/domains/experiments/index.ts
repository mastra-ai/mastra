import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { MastraStorage, ExperimentsStorage, DatasetsStorage, Experiment } from '@mastra/core/storage';

export function createExperimentsTests({ storage }: { storage: MastraStorage }) {
  // Skip tests if storage doesn't have experiments domain
  const describeExperiments = storage.stores?.experiments ? describe : describe.skip;

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
        });

        expect(exp.id).toBeDefined();
        expect(exp.name).toBe('test-exp');
        expect(exp.status).toBe('pending');
        expect(exp.succeededCount).toBe(0);
        expect(exp.failedCount).toBe(0);
        expect(exp.skippedCount).toBe(0);
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
          succeededCount: 1,
        });

        expect(updated.status).toBe('running');
        expect(updated.succeededCount).toBe(1);
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
          startedAt: new Date(),
          completedAt: new Date(),
          retryCount: 0,
        });

        expect(result.id).toBeDefined();
        expect(result.experimentId).toBe(exp.id);
        expect(result.input).toEqual({ q: 'hello' });
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
  }); // describeExperiments
}
