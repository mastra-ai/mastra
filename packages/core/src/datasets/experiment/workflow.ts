import { z } from 'zod';
import { MastraError } from '../../error/index.js';
import type { Mastra } from '../../mastra';
import { createStep, createWorkflow } from '../../workflows/evented';
import { resolveTarget } from './resolve-target';
import { EXPERIMENT_WORKFLOW_ID } from './workflow-id';

export { EXPERIMENT_WORKFLOW_ID } from './workflow-id';

const DEFAULT_MAX_CONCURRENCY = 5;

const versionSelectorSchema = z.union([
  z.object({ versionId: z.string() }),
  z.object({ status: z.enum(['draft', 'published']) }),
]);

/**
 * Input of a durable experiment run. Everything here is JSON so the run can be
 * picked up by any process sharing the storage and pubsub.
 */
export const experimentWorkflowInputSchema = z.object({
  datasetId: z.string(),
  experimentId: z.string(),
  organizationId: z.string().optional(),
  projectId: z.string().optional(),
  maxConcurrency: z.number().int().positive().optional(),
  itemTimeout: z.number().int().positive().optional(),
  maxRetries: z.number().int().nonnegative().optional(),
  /** `provider/model` string; model objects aren't serializable. */
  agentModel: z.string().optional(),
  unmockedToolPolicy: z.enum(['allow', 'deny']).optional(),
  requestContext: z.record(z.string(), z.unknown()).optional(),
  versions: z
    .object({
      agents: z.record(z.string(), versionSelectorSchema).optional(),
      defaultStatus: z.enum(['draft', 'published']).optional(),
    })
    .optional(),
});

export type ExperimentWorkflowInput = z.infer<typeof experimentWorkflowInputSchema>;

const itemRefSchema = z.object({ itemId: z.string() });
const itemOutcomeSchema = z.object({ itemId: z.string(), failed: z.boolean() });

function datasetHandle(mastra: Mastra, input: ExperimentWorkflowInput) {
  return mastra.datasets.get({
    id: input.datasetId,
    organizationId: input.organizationId,
    projectId: input.projectId,
  });
}

/**
 * Marks the experiment `failed` when a step throws, then rethrows so the run
 * fails too. Item target errors never get here: they're recorded on the item's
 * row. This covers setup errors and items that couldn't be run or saved.
 *
 * The experiment is only touched when the run's dataset, scope and experiment
 * belong together, so a run naming another project's experiment can't change it.
 */
async function failExperimentOnError<T>(
  mastra: Mastra,
  input: ExperimentWorkflowInput,
  body: () => Promise<T>,
): Promise<T> {
  try {
    return await body();
  } catch (error) {
    const logger = mastra.getLogger();
    logger?.error(`Experiment ${input.experimentId} failed: ${error instanceof Error ? error.message : String(error)}`);
    const owned = await datasetHandle(mastra, input)
      .then(dataset => dataset.getExperiment({ experimentId: input.experimentId }))
      .catch(() => null);
    if (owned) {
      const experimentsStore = await mastra.getStorage()?.getStore('experiments');
      await experimentsStore
        ?.updateExperiment({ id: owned.id, status: 'failed', completedAt: new Date() })
        .catch(() => {});
    }
    throw error;
  }
}

const prepareStep = createStep({
  id: 'prepare',
  inputSchema: experimentWorkflowInputSchema,
  outputSchema: z.array(itemRefSchema),
  // Reads the run input, not `inputData`: a step event's previous result must not choose the experiment.
  execute: async ({ getInitData, mastra }) => {
    const inputData = getInitData<ExperimentWorkflowInput>();
    return failExperimentOnError(mastra, inputData, async () => {
      const experimentsStore = await mastra.getStorage()?.getStore('experiments');
      const datasetsStore = await mastra.getStorage()?.getStore('datasets');
      if (!experimentsStore || !datasetsStore) {
        throw new MastraError({
          id: 'EXPERIMENTS_STORAGE_NOT_CONFIGURED',
          text: 'Durable experiments need datasets and experiments storage on the Mastra instance.',
          domain: 'STORAGE',
          category: 'USER',
        });
      }

      const dataset = await datasetHandle(mastra, inputData);
      const experiment = await dataset.getExperiment({ experimentId: inputData.experimentId });
      if (!experiment) {
        throw new MastraError({
          id: 'EXPERIMENT_NOT_FOUND',
          text: `Experiment not found: ${inputData.experimentId}`,
          domain: 'STORAGE',
          category: 'USER',
        });
      }
      if (experiment.status === 'completed' || experiment.status === 'failed') return [];

      if (experiment.targetType === null || experiment.targetId === null) {
        throw new MastraError({
          id: 'EXPERIMENT_HAS_NO_TARGET',
          text: `Experiment ${experiment.id} has no target to run`,
          domain: 'STORAGE',
          category: 'USER',
        });
      }
      const target = await resolveTarget(
        mastra,
        experiment.targetType,
        experiment.targetId,
        experiment.agentVersion ?? undefined,
      );
      if (!target) {
        throw new MastraError({
          id: 'EXPERIMENT_TARGET_NOT_FOUND',
          text: `Target not found: ${experiment.targetType} "${experiment.targetId}"`,
          domain: 'STORAGE',
          category: 'USER',
        });
      }

      const items = await datasetsStore.getItemsByVersion({
        datasetId: dataset.id,
        version: experiment.datasetVersion ?? 0,
      });

      if (experiment.status !== 'running') {
        await experimentsStore.updateExperiment({ id: experiment.id, status: 'running', startedAt: new Date() });
      }

      return items.map(item => ({ itemId: item.id }));
    });
  },
});

const runItemStep = createStep({
  id: 'runItem',
  inputSchema: itemRefSchema,
  outputSchema: itemOutcomeSchema,
  execute: async ({ inputData, getInitData, mastra }) => {
    const input = getInitData<ExperimentWorkflowInput>();
    return failExperimentOnError(mastra, input, async () => {
      const dataset = await datasetHandle(mastra, input);
      const { result } = await dataset.runExperimentItem({
        experimentId: input.experimentId,
        itemId: inputData.itemId,
        requestContext: input.requestContext,
        agentModel: input.agentModel,
        unmockedToolPolicy: input.unmockedToolPolicy,
        itemTimeout: input.itemTimeout,
        maxRetries: input.maxRetries,
        versions: input.versions,
      });
      return { itemId: inputData.itemId, failed: result.error !== null };
    });
  },
});

const finalizeStep = createStep({
  id: 'finalize',
  inputSchema: z.array(itemOutcomeSchema),
  outputSchema: z.object({
    experimentId: z.string(),
    status: z.string(),
    succeededCount: z.number(),
    failedCount: z.number(),
    skippedCount: z.number(),
  }),
  execute: async ({ getInitData, mastra }) => {
    const input = getInitData<ExperimentWorkflowInput>();
    return failExperimentOnError(mastra, input, async () => {
      const dataset = await datasetHandle(mastra, input);
      const experiment = await dataset.finalizeExperiment({ experimentId: input.experimentId });
      return {
        experimentId: experiment.id,
        status: experiment.status,
        succeededCount: experiment.succeededCount,
        failedCount: experiment.failedCount,
        skippedCount: experiment.skippedCount,
      };
    });
  },
});

/**
 * Runs a stored experiment on the evented engine: `prepare` lists the items,
 * each item runs as its own step via `runExperimentItem` (one result row per
 * item, so a redelivered step converges), and `finalize` counts the rows.
 */
export function buildExperimentWorkflow() {
  return createWorkflow({
    id: EXPERIMENT_WORKFLOW_ID,
    inputSchema: experimentWorkflowInputSchema,
    outputSchema: finalizeStep.outputSchema,
  })
    .then(prepareStep)
    .foreach(runItemStep, {
      concurrency: ({ getInitData }) =>
        experimentWorkflowInputSchema.parse(getInitData()).maxConcurrency ?? DEFAULT_MAX_CONCURRENCY,
    })
    .then(finalizeStep)
    .commit();
}
