import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HTTPException } from '../http-exception';
import { listExperimentsQuerySchema, triggerExperimentBodySchema } from '../schemas/datasets';
import {
  ADD_ITEM_ROUTE,
  BATCH_INSERT_ITEMS_ROUTE,
  DELETE_DATASET_ROUTE,
  GET_DATASET_ROUTE,
  GET_EXPERIMENT_ROUTE,
  GET_ITEM_ROUTE,
  GET_ITEM_VERSION_ROUTE,
  LIST_ALL_EXPERIMENTS_ROUTE,
  LIST_DATASETS_ROUTE,
  LIST_EXPERIMENTS_ROUTE,
  LIST_ITEM_VERSIONS_ROUTE,
  TRIGGER_EXPERIMENT_ROUTE,
  RUN_EXPERIMENT_ITEM_ROUTE,
  SUBMIT_EXPERIMENT_RESULT_ROUTE,
  FINALIZE_EXPERIMENT_ROUTE,
  LIST_EXPERIMENT_RESULTS_ROUTE,
  UPDATE_DATASET_ROUTE,
  UPDATE_EXPERIMENT_ROUTE,
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

  describe('PATCH /datasets/:datasetId/experiments/:experimentId', () => {
    async function createNamedExperiment() {
      const dataset = await mastra.datasets.create({ name: 'Rename DS' });
      await dataset.addItem({ input: { prompt: 'hello' } });
      const created = (await TRIGGER_EXPERIMENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        start: false,
        name: 'before',
        description: 'before desc',
      } as any)) as any;
      return { dataset, experimentId: created.experimentId as string };
    }

    it('should update the experiment name and return the updated record', async () => {
      // Given an experiment with an initial name
      const { dataset, experimentId } = await createNamedExperiment();

      // When the name is patched
      const updated = (await UPDATE_EXPERIMENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        experimentId,
        name: 'after',
      } as any)) as any;

      // Then the record reflects the new name and keeps the description
      expect(updated.name).toBe('after');
      expect(updated.description).toBe('before desc');
      const reloaded = (await GET_EXPERIMENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        experimentId,
      } as any)) as any;
      expect(reloaded.name).toBe('after');
    });

    it('should return 404 when the experiment does not exist', async () => {
      const dataset = await mastra.datasets.create({ name: 'Rename DS' });

      await expect(
        UPDATE_EXPERIMENT_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          datasetId: dataset.id,
          experimentId: 'missing',
          name: 'after',
        } as any),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('should reject an invalid body before the handler', () => {
      expect(UPDATE_EXPERIMENT_ROUTE.bodySchema.safeParse({ name: 42 }).success).toBe(false);
      expect(UPDATE_EXPERIMENT_ROUTE.bodySchema.safeParse({ metadata: [] }).success).toBe(false);
      expect(UPDATE_EXPERIMENT_ROUTE.bodySchema.safeParse({ status: 'completed' }).success).toBe(false);
      expect(UPDATE_EXPERIMENT_ROUTE.bodySchema.safeParse({ name: 'ok', description: 'd' }).success).toBe(true);
    });
  });

  describe('TRIGGER_EXPERIMENT_ROUTE', () => {
    // Exact request body from issue #20539.
    const issueReproductionBody = JSON.parse(`{
      "targetType": "workflow",
      "targetId": "my-workflow",
      "scorerIds": ["my-scorer"],
      "metadata": {
        "model": "anthropic/claude-haiku-4-5"
      }
    }`);

    async function triggerAndReadBack(body: unknown) {
      const dataset = await mastra.datasets.create({ name: 'Experiment Trigger DS' });
      await dataset.addItem({ input: { prompt: 'hello' } });

      const parsedBody = TRIGGER_EXPERIMENT_ROUTE.bodySchema.parse(body);
      const triggered = (await TRIGGER_EXPERIMENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        ...parsedBody,
      } as any)) as any;
      const experiment = await GET_EXPERIMENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        experimentId: triggered.experimentId,
      } as any);

      return { parsedBody, experiment };
    }

    it('preserves issue metadata through parsing, trigger, and readback', async () => {
      const { parsedBody, experiment } = await triggerAndReadBack(issueReproductionBody);

      expect(parsedBody.metadata).toEqual({ model: 'anthropic/claude-haiku-4-5' });
      expect(experiment?.metadata).toEqual({ model: 'anthropic/claude-haiku-4-5' });
    });

    it('preserves optional name and description through the same path', async () => {
      const { parsedBody, experiment } = await triggerAndReadBack({
        ...issueReproductionBody,
        name: 'Named experiment',
        description: 'Experiment description',
      });

      expect(parsedBody.name).toBe('Named experiment');
      expect(parsedBody.description).toBe('Experiment description');
      expect(experiment?.name).toBe('Named experiment');
      expect(experiment?.description).toBe('Experiment description');
    });

    it('rejects invalid name, description, and metadata shapes before the handler', () => {
      const baseBody = { targetType: 'workflow', targetId: 'my-workflow' };

      expect(TRIGGER_EXPERIMENT_ROUTE.bodySchema.safeParse({ ...baseBody, name: 42 }).success).toBe(false);
      expect(TRIGGER_EXPERIMENT_ROUTE.bodySchema.safeParse({ ...baseBody, description: 42 }).success).toBe(false);
      expect(TRIGGER_EXPERIMENT_ROUTE.bodySchema.safeParse({ ...baseBody, metadata: [] }).success).toBe(false);
    });

    it('strips unexpected: 1 and leaves omitted experiment fields absent', () => {
      const parsedBody = TRIGGER_EXPERIMENT_ROUTE.bodySchema.parse({
        targetType: 'workflow',
        targetId: 'my-workflow',
        unexpected: 1,
      });

      expect(parsedBody).not.toHaveProperty('unexpected');
      expect(parsedBody).not.toHaveProperty('name');
      expect(parsedBody).not.toHaveProperty('description');
      expect(parsedBody).not.toHaveProperty('metadata');
    });

    it('preserves existing fields and coerces version through the trigger path', async () => {
      const { parsedBody, experiment } = await triggerAndReadBack({
        targetType: 'workflow',
        targetId: 'my-workflow',
        scorerIds: ['my-scorer'],
        version: '1',
        agentVersion: 'agent-version-1',
        maxConcurrency: 2,
        requestContext: { source: 'test' },
        versions: { defaultStatus: 'published' },
      });

      expect(parsedBody).toMatchObject({
        targetType: 'workflow',
        targetId: 'my-workflow',
        scorerIds: ['my-scorer'],
        version: 1,
        agentVersion: 'agent-version-1',
        maxConcurrency: 2,
        requestContext: { source: 'test' },
        versions: { defaultStatus: 'published' },
      });
      expect(experiment?.datasetVersion).toBe(1);
    });

    it('converts a live RequestContext before forwarding to the dataset', async () => {
      const requestContext = new RequestContext();
      requestContext.set('tenantId', 'tenant-1');
      const startExperimentAsync = vi.fn().mockResolvedValue({
        experimentId: 'experiment-1',
        status: 'pending',
        totalItems: 1,
      });
      vi.spyOn(mastra.datasets, 'get').mockResolvedValue({ startExperimentAsync } as any);

      const parsedBody = TRIGGER_EXPERIMENT_ROUTE.bodySchema.parse({
        targetType: 'workflow',
        targetId: 'my-workflow',
      });
      await TRIGGER_EXPERIMENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: 'dataset-1',
        ...parsedBody,
        requestContext,
      } as any);

      expect(startExperimentAsync).toHaveBeenCalledWith(
        expect.objectContaining({ requestContext: { tenantId: 'tenant-1' } }),
      );
    });
  });

  describe('Experiment routes', () => {
    const grouping = {
      experimentSetId: 'set-1',
      comparisonId: 'comparison-1',
      variantId: 'variant-1',
      trialIndex: 0,
    };

    it('forwards grouping filters when listing all experiments', async () => {
      const experimentsStore = await mockStorage.getStore('experiments');
      const listExperiments = vi.spyOn(experimentsStore!, 'listExperiments');

      await LIST_ALL_EXPERIMENTS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        page: 2,
        perPage: 15,
        ...grouping,
      } as any);

      expect(listExperiments).toHaveBeenCalledWith({
        ...grouping,
        pagination: { page: 2, perPage: 15 },
      });
    });

    it('forwards grouping filters when listing dataset experiments', async () => {
      const listExperiments = vi.fn().mockResolvedValue({
        experiments: [],
        pagination: { total: 0, page: 1, perPage: 12, hasMore: false },
      });
      vi.spyOn(mastra.datasets, 'get').mockResolvedValue({ listExperiments } as any);

      await LIST_EXPERIMENTS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: 'dataset-1',
        page: 1,
        perPage: 12,
        ...grouping,
      } as any);

      expect(listExperiments).toHaveBeenCalledWith({ page: 1, perPage: 12, ...grouping });
    });

    it('forwards provenance and grouping when triggering an experiment', async () => {
      const startExperimentAsync = vi.fn().mockResolvedValue({
        experimentId: 'experiment-1',
        status: 'pending',
        totalItems: 3,
      });
      vi.spyOn(mastra.datasets, 'get').mockResolvedValue({ startExperimentAsync } as any);
      const provenance = {
        source: 'github',
        sourceId: 'mastra-ai/mastra',
        sourceVersion: 'abc123',
        metadata: { pullRequest: 20645 },
      };

      await TRIGGER_EXPERIMENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: 'dataset-1',
        targetType: 'agent',
        targetId: 'agent-1',
        provenance,
        grouping,
      } as any);

      expect(startExperimentAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          targetType: 'agent',
          targetId: 'agent-1',
          provenance,
          grouping,
        }),
      );
    });

    it('accepts trial index 0', () => {
      expect(listExperimentsQuerySchema.safeParse({ trialIndex: 0 }).success).toBe(true);
      expect(
        triggerExperimentBodySchema.safeParse({
          targetType: 'agent',
          targetId: 'agent-1',
          grouping: { trialIndex: 0 },
        }).success,
      ).toBe(true);
    });

    it.each([-1, 1.5])('rejects invalid trial index %s', trialIndex => {
      expect(listExperimentsQuerySchema.safeParse({ trialIndex }).success).toBe(false);
      expect(
        triggerExperimentBodySchema.safeParse({
          targetType: 'agent',
          targetId: 'agent-1',
          grouping: { trialIndex },
        }).success,
      ).toBe(false);
    });
  });

  describe('Caller-driven experiment routes', () => {
    async function setupDatasetWithItems() {
      const dataset = await mastra.datasets.create({ name: 'Caller-driven DS' });
      const item1 = await dataset.addItem({ input: { q: 'q1' }, groundTruth: 'a1' });
      const item2 = await dataset.addItem({ input: { q: 'q2' }, groundTruth: 'a2' });
      return { dataset, item1, item2 };
    }

    it('runs the full ingestion lifecycle: create, submit, finalize', async () => {
      const { dataset, item1, item2 } = await setupDatasetWithItems();

      const created = (await TRIGGER_EXPERIMENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        start: false,
        name: 'temporal-run',
      } as any)) as any;

      expect(created.status).toBe('running');
      expect(created.totalItems).toBe(2);

      await SUBMIT_EXPERIMENT_RESULT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        experimentId: created.experimentId,
        itemId: item1.id,
        output: { a: 'ok' },
      } as any);
      await SUBMIT_EXPERIMENT_RESULT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        experimentId: created.experimentId,
        itemId: item2.id,
        error: { message: 'boom' },
      } as any);

      const finalized = (await FINALIZE_EXPERIMENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        experimentId: created.experimentId,
      } as any)) as any;

      expect(finalized.status).toBe('completed');
      expect(finalized.succeededCount).toBe(1);
      expect(finalized.failedCount).toBe(1);
      expect(finalized.skippedCount).toBe(0);

      const listed = (await LIST_EXPERIMENT_RESULTS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        experimentId: created.experimentId,
        page: 0,
        perPage: 10,
      } as any)) as any;
      expect(listed.results).toHaveLength(2);
    });

    it('create is idempotent on a caller-supplied id', async () => {
      const { dataset } = await setupDatasetWithItems();

      const first = (await TRIGGER_EXPERIMENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        start: false,
        id: 'wf-run-1',
      } as any)) as any;
      const second = (await TRIGGER_EXPERIMENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        start: false,
        id: 'wf-run-1',
      } as any)) as any;

      expect(second.experimentId).toBe(first.experimentId);
    });

    it('retried submissions converge on a single row', async () => {
      const { dataset, item1 } = await setupDatasetWithItems();
      const created = (await TRIGGER_EXPERIMENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        start: false,
      } as any)) as any;

      const first = (await SUBMIT_EXPERIMENT_RESULT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        experimentId: created.experimentId,
        itemId: item1.id,
        output: 'v1',
      } as any)) as any;
      const second = (await SUBMIT_EXPERIMENT_RESULT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        experimentId: created.experimentId,
        itemId: item1.id,
        output: 'v2',
      } as any)) as any;

      expect(second.id).toBe(first.id);
      expect(second.output).toBe('v2');
    });

    it('rejects submissions to an experiment that has a target with 400', async () => {
      const { dataset, item1 } = await setupDatasetWithItems();
      const experimentsStore = await mockStorage.getStore('experiments');
      const native = await experimentsStore!.createExperiment({
        datasetId: dataset.id,
        datasetVersion: 1,
        targetType: 'agent',
        targetId: 'agent-1',
        totalItems: 2,
      });

      await expect(
        SUBMIT_EXPERIMENT_RESULT_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          datasetId: dataset.id,
          experimentId: native.id,
          itemId: item1.id,
          output: 'x',
        } as any),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('rejects submissions after finalization with 409', async () => {
      const { dataset, item1, item2 } = await setupDatasetWithItems();
      const created = (await TRIGGER_EXPERIMENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        start: false,
      } as any)) as any;
      await SUBMIT_EXPERIMENT_RESULT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        experimentId: created.experimentId,
        itemId: item1.id,
        output: 'x',
      } as any);
      await FINALIZE_EXPERIMENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        experimentId: created.experimentId,
      } as any);

      await expect(
        SUBMIT_EXPERIMENT_RESULT_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          datasetId: dataset.id,
          experimentId: created.experimentId,
          itemId: item2.id,
          output: 'y',
        } as any),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('runs one item server-side via the run-item route and upserts the row', async () => {
      const agent = new Agent({ id: 'run-agent', name: 'run-agent', instructions: 'test', model: {} as any });
      vi.spyOn(agent, 'getModel').mockResolvedValue({ specificationVersion: 'v2' } as any);
      vi.spyOn(agent, 'generate').mockResolvedValue({ text: 'agent answer' } as any);
      mastra = new Mastra({ logger: false, storage: mockStorage, agents: { 'run-agent': agent } });

      const { dataset, item1 } = await setupDatasetWithItems();
      const created = (await TRIGGER_EXPERIMENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        start: false,
        targetType: 'agent',
        targetId: 'run-agent',
      } as any)) as any;

      const first = (await RUN_EXPERIMENT_ITEM_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        experimentId: created.experimentId,
        itemId: item1.id,
      } as any)) as any;
      expect(first.result.output?.text).toBe('agent answer');
      expect(first.result.error).toBeNull();

      // A retried call converges on the same row.
      const second = (await RUN_EXPERIMENT_ITEM_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        experimentId: created.experimentId,
        itemId: item1.id,
      } as any)) as any;
      expect(second.result.id).toBe(first.result.id);

      const finalized = (await FINALIZE_EXPERIMENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        experimentId: created.experimentId,
      } as any)) as any;
      expect(finalized.succeededCount).toBe(1);
      expect(finalized.skippedCount).toBe(1);
    });

    it('rejects run-item on a target-less experiment with 400', async () => {
      const { dataset, item1 } = await setupDatasetWithItems();
      const created = (await TRIGGER_EXPERIMENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        start: false,
      } as any)) as any;

      await expect(
        RUN_EXPERIMENT_ITEM_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          datasetId: dataset.id,
          experimentId: created.experimentId,
          itemId: item1.id,
        } as any),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('rejects create-only experiments with an unknown target with 404', async () => {
      const { dataset } = await setupDatasetWithItems();
      await expect(
        TRIGGER_EXPERIMENT_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          datasetId: dataset.id,
          start: false,
          targetType: 'agent',
          targetId: 'missing-agent',
        } as any),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('rejects start without a target with 400', async () => {
      const { dataset } = await setupDatasetWithItems();
      await expect(
        TRIGGER_EXPERIMENT_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          datasetId: dataset.id,
        } as any),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('rejects unknown item ids with 404', async () => {
      const { dataset } = await setupDatasetWithItems();
      const created = (await TRIGGER_EXPERIMENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        start: false,
      } as any)) as any;

      await expect(
        SUBMIT_EXPERIMENT_RESULT_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          datasetId: dataset.id,
          experimentId: created.experimentId,
          itemId: 'missing-item',
          output: 'x',
        } as any),
      ).rejects.toMatchObject({ status: 404 });
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

  describe('GET_ITEM_VERSION_ROUTE', () => {
    it('returns an unchanged item visible in a later dataset snapshot', async () => {
      const dataset = await mastra.datasets.create({ name: 'Versioned Item DS' });
      const itemA = await dataset.addItem({ input: { value: 'first' } });
      const itemB = await dataset.addItem({ input: { value: 'second' } });

      const fetched = (await GET_ITEM_VERSION_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        itemId: itemA.id,
        datasetVersion: itemB.datasetVersion,
      } as any)) as any;

      expect(fetched).toMatchObject({
        id: itemA.id,
        datasetVersion: itemA.datasetVersion,
        input: { value: 'first' },
      });
    });
  });

  describe('item tool mocks', () => {
    it('round-trips toolMocks and unmockedToolPolicy through add, get, and update', async () => {
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
        unmockedToolPolicy: 'deny',
      } as any)) as any;

      expect(added.toolMocks).toEqual(toolMocks);
      expect(added.unmockedToolPolicy).toBe('deny');

      const fetched = (await GET_ITEM_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        itemId: added.id,
      } as any)) as any;

      expect(fetched.toolMocks).toEqual(toolMocks);
      expect(fetched.unmockedToolPolicy).toBe('deny');

      // SCD-2: updating an unrelated field preserves tool mock settings
      const updated = (await UPDATE_ITEM_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        itemId: added.id,
        input: { q: 'updated' },
      } as any)) as any;

      expect(updated.toolMocks).toEqual(toolMocks);
      expect(updated.unmockedToolPolicy).toBe('deny');

      const replaced = (await UPDATE_ITEM_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        itemId: added.id,
        unmockedToolPolicy: 'allow',
      } as any)) as any;

      expect(replaced.unmockedToolPolicy).toBe('allow');
    });

    it('forwards unmockedToolPolicy through batch insertion', async () => {
      const dataset = await mastra.datasets.create({ name: 'Batch Policy DS' });

      const batch = (await BATCH_INSERT_ITEMS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        items: [{ input: { q: 'strict' }, unmockedToolPolicy: 'deny' }, { input: { q: 'default' } }],
      } as any)) as any;

      expect(batch.items[0]?.unmockedToolPolicy).toBe('deny');
      expect(batch.items[1]?.unmockedToolPolicy).toBeUndefined();

      const fetched = (await GET_ITEM_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        itemId: batch.items[0].id,
      } as any)) as any;

      expect(fetched.unmockedToolPolicy).toBe('deny');
    });
  });

  describe('item scorer IDs', () => {
    it('round-trips scorerIds through single, batch, update, and version routes', async () => {
      const dataset = await mastra.datasets.create({ name: 'Scorer IDs DS' });
      const added = (await ADD_ITEM_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        input: { q: 'score me' },
        scorerIds: ['quality', 'safety'],
      } as any)) as any;
      expect(added.scorerIds).toEqual(['quality', 'safety']);

      const fetched = (await GET_ITEM_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        itemId: added.id,
      } as any)) as any;
      expect(fetched.scorerIds).toEqual(['quality', 'safety']);

      const preserved = (await UPDATE_ITEM_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        itemId: added.id,
        input: { q: 'updated' },
      } as any)) as any;
      expect(preserved.scorerIds).toEqual(['quality', 'safety']);

      const replaced = (await UPDATE_ITEM_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        itemId: added.id,
        scorerIds: ['relevance'],
      } as any)) as any;
      expect(replaced.scorerIds).toEqual(['relevance']);

      const disabled = (await UPDATE_ITEM_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        itemId: added.id,
        scorerIds: [],
      } as any)) as any;
      expect(disabled.scorerIds).toEqual([]);

      const cleared = (await UPDATE_ITEM_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        itemId: added.id,
        scorerIds: null,
      } as any)) as any;
      expect(cleared.scorerIds).toBeUndefined();

      const history = (await LIST_ITEM_VERSIONS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        itemId: added.id,
      } as any)) as any;
      expect(history.history.find((row: any) => row.datasetVersion === 1)?.scorerIds).toEqual(['quality', 'safety']);
      expect(history.history.find((row: any) => row.datasetVersion === 2)?.scorerIds).toEqual(['quality', 'safety']);
      expect(history.history.find((row: any) => row.datasetVersion === 3)?.scorerIds).toEqual(['relevance']);
      expect(history.history.find((row: any) => row.datasetVersion === 4)?.scorerIds).toEqual([]);
      expect(history.history.find((row: any) => row.datasetVersion === 5)?.scorerIds).toBeUndefined();

      const versionOne = (await GET_ITEM_VERSION_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        itemId: added.id,
        datasetVersion: 1,
      } as any)) as any;
      expect(versionOne.scorerIds).toEqual(['quality', 'safety']);

      const batch = (await BATCH_INSERT_ITEMS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        datasetId: dataset.id,
        items: [
          { input: { q: 'selected' }, scorerIds: ['quality'] },
          { input: { q: 'disabled' }, scorerIds: [] },
          { input: { q: 'inherited' } },
        ],
      } as any)) as any;
      const byInput = new Map(batch.items.map((item: any) => [item.input.q, item]));
      expect(byInput.get('selected')?.scorerIds).toEqual(['quality']);
      expect(byInput.get('disabled')?.scorerIds).toEqual([]);
      expect(byInput.get('inherited')?.scorerIds).toBeUndefined();
    });
  });
});
