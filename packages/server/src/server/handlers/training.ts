import type { TrainerStorage, TrainingJobRecord, TrainedModelRecord } from '@mastra/core/storage';
import { z } from 'zod';

import { HTTPException } from '../http-exception';
import {
  jobIdPathParams,
  listJobsQuerySchema,
  startJobBodySchema,
  listJobsResponseSchema,
  jobResponseSchema,
  jobEventsResponseSchema,
  jobCheckpointsResponseSchema,
  listModelsQuerySchema,
  listModelsResponseSchema,
  modelResponseSchema,
  modelIdPathParams,
  type TrainingJob,
} from '../schemas/training';
import { createRoute } from '../server-adapter/routes/route-builder';

import { handleError } from './error';

// Helper to get trainer storage with proper typing
async function getTrainerStorage(mastra: {
  getStorage: () => { getStore: (name: 'trainer') => Promise<TrainerStorage | undefined> } | undefined;
}): Promise<TrainerStorage | undefined> {
  const storage = mastra.getStorage();
  if (!storage) return undefined;
  return storage.getStore('trainer');
}

// Helper to get observability storage
async function getObservabilityStore(mastra: {
  getStorage: () =>
    | {
        getStore: (
          name: 'observability',
        ) => Promise<
          | {
              listTraces: (args: {
                filters?: Record<string, unknown>;
                pagination?: { page?: number; perPage?: number };
              }) => Promise<{ spans: unknown[]; pagination: { total: number } }>;
            }
          | undefined
        >;
      }
    | undefined;
}) {
  const storage = mastra.getStorage();
  if (!storage) return undefined;
  return storage.getStore('observability');
}

/**
 * Check if training data (traces) is available for an agent
 */
export const CHECK_TRAINING_DATA_ROUTE = createRoute({
  method: 'GET',
  path: '/api/training/check-data',
  responseType: 'json',
  queryParamSchema: z.object({
    agentId: z.string().optional(),
    agentName: z.string().optional(),
  }),
  responseSchema: z.object({
    hasData: z.boolean(),
    traceCount: z.number(),
    message: z.string().optional(),
  }),
  summary: 'Check training data availability',
  description: 'Checks if there are traces available for training an agent',
  tags: ['Training'],
  handler: async ({ mastra, agentId, agentName }) => {
    try {
      const observabilityStore = await getObservabilityStore(mastra);

      if (!observabilityStore) {
        return {
          hasData: false,
          traceCount: 0,
          message: 'Observability storage is not configured',
        };
      }

      // Build filters for agent traces
      const filters: Record<string, unknown> = {
        entityType: 'agent',
      };

      // Get agent name from agentId if provided
      let targetAgentName = agentName;
      if (agentId && !agentName) {
        try {
          const agent = (mastra as any).getAgentById(agentId);
          if (agent) {
            targetAgentName = agent.name;
          }
        } catch {
          // Agent not found, continue without name filter
        }
      }

      if (targetAgentName) {
        filters.entityName = targetAgentName;
      }

      // Query for traces with limit of 1 to check existence
      const result = await observabilityStore.listTraces({
        filters,
        pagination: { page: 0, perPage: 1 },
      });

      const traceCount = result.pagination.total;

      return {
        hasData: traceCount > 0,
        traceCount,
        message:
          traceCount === 0
            ? 'No traces found. Run some agent conversations first to generate training data.'
            : undefined,
      };
    } catch (error) {
      return handleError(error, 'Failed to check training data availability');
    }
  },
});

/**
 * List training jobs
 */
export const LIST_TRAINING_JOBS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/training/jobs',
  responseType: 'json',
  queryParamSchema: listJobsQuerySchema,
  responseSchema: listJobsResponseSchema,
  summary: 'List training jobs',
  description: 'Returns a list of all training jobs, optionally filtered by agent, status, or method',
  tags: ['Training'],
  handler: async ({ mastra, agentId, status, method, limit, offset }) => {
    try {
      const trainerStore = await getTrainerStorage(mastra);

      if (!trainerStore) {
        return { jobs: [] };
      }

      const { jobs } = await trainerStore.listTrainingJobs({
        agentId,
        status: status as 'pending' | 'preparing' | 'running' | 'succeeded' | 'failed' | 'cancelled' | undefined,
        method: method as 'sft' | 'dpo' | undefined,
        limit,
        offset,
      });

      // Refresh status for active jobs from provider
      const updatedJobs = await Promise.all(
        jobs.map(async job => {
          const isActive = job.status === 'pending' || job.status === 'preparing' || job.status === 'running';
          if (isActive && job.providerJobId) {
            try {
              const trainerModule = await import('@mastra/trainer');
              const apiKey = process.env.OPENAI_API_KEY;
              if (apiKey) {
                const provider = trainerModule.createOpenAIProvider({ apiKey });
                const providerJob = await provider.getJob(job.providerJobId);

                if (providerJob.status !== job.status || providerJob.providerStatus !== job.providerStatus) {
                  const updates: Partial<typeof job> = {
                    status: providerJob.status as typeof job.status,
                    providerStatus: providerJob.providerStatus,
                    fineTunedModelId: providerJob.fineTunedModelId,
                    metrics: providerJob.metrics as typeof job.metrics,
                    error: providerJob.error,
                  };

                  if (
                    providerJob.status === 'succeeded' ||
                    providerJob.status === 'failed' ||
                    providerJob.status === 'cancelled'
                  ) {
                    updates.completedAt = new Date();
                  }

                  const updatedJob = await trainerStore.updateTrainingJob(job.id, updates);
                  return updatedJob || job;
                }
              }
            } catch {
              // If we can't fetch from provider, just return stored job
            }
          }
          return job;
        }),
      );

      return {
        jobs: updatedJobs.map(jobToApiFormat),
      };
    } catch (error) {
      return handleError(error, 'Failed to list training jobs');
    }
  },
});

/**
 * Get a training job by ID
 */
export const GET_TRAINING_JOB_ROUTE = createRoute({
  method: 'GET',
  path: '/api/training/jobs/:jobId',
  responseType: 'json',
  pathParamSchema: jobIdPathParams,
  responseSchema: jobResponseSchema,
  summary: 'Get training job details',
  description: 'Returns details for a specific training job',
  tags: ['Training'],
  handler: async ({ mastra, jobId }) => {
    try {
      const trainerStore = await getTrainerStorage(mastra);

      if (!trainerStore) {
        throw new HTTPException(404, { message: 'Training job not found' });
      }

      let job = await trainerStore.getTrainingJob(jobId);
      if (!job) {
        throw new HTTPException(404, { message: 'Training job not found' });
      }

      // If job is still active and has a provider job ID, fetch fresh status from provider
      const isActive = job.status === 'pending' || job.status === 'preparing' || job.status === 'running';
      if (isActive && job.providerJobId) {
        try {
          const trainerModule = await import('@mastra/trainer');
          const apiKey = process.env.OPENAI_API_KEY;
          if (apiKey) {
            const provider = trainerModule.createOpenAIProvider({ apiKey });
            const providerJob = await provider.getJob(job.providerJobId);

            // Update stored job if status has changed
            if (providerJob.status !== job.status || providerJob.providerStatus !== job.providerStatus) {
              const updates: Partial<typeof job> = {
                status: providerJob.status as typeof job.status,
                providerStatus: providerJob.providerStatus,
                fineTunedModelId: providerJob.fineTunedModelId,
                metrics: providerJob.metrics as typeof job.metrics,
                error: providerJob.error,
              };

              // If job is now complete, set completedAt
              if (
                providerJob.status === 'succeeded' ||
                providerJob.status === 'failed' ||
                providerJob.status === 'cancelled'
              ) {
                updates.completedAt = new Date();
              }

              const updatedJob = await trainerStore.updateTrainingJob(jobId, updates);
              if (updatedJob) {
                job = updatedJob;
              }
            }
          }
        } catch {
          // If we can't fetch from provider, just return stored job
        }
      }

      return jobToApiFormat(job);
    } catch (error) {
      return handleError(error, 'Failed to get training job');
    }
  },
});

/**
 * Start a new training job
 */
export const START_TRAINING_JOB_ROUTE = createRoute({
  method: 'POST',
  path: '/api/training/jobs',
  responseType: 'json',
  bodySchema: startJobBodySchema,
  responseSchema: jobResponseSchema,
  summary: 'Start a new training job',
  description: 'Creates and starts a new agent training job',
  tags: ['Training'],
  handler: async ({ mastra, agentId, config }) => {
    try {
      // Get agent by ID (the internal agent id, not the config key)
      const agent = mastra.getAgentById(agentId);
      if (!agent) {
        throw new HTTPException(400, { message: `Agent not found: ${agentId}` });
      }

      const trainerStore = await getTrainerStorage(mastra);

      // Create job record
      const jobId = `ftjob-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const now = new Date();

      const jobRecord = {
        id: jobId,
        agentId,
        agentName: agent.name,
        method: config.method as 'sft' | 'dpo',
        status: 'pending' as const,
        baseModel: config.provider.baseModel,
        trainingExamples: 0,
        config: config as Record<string, unknown>,
        createdAt: now,
        updatedAt: now,
      };

      // Save to storage if available
      if (trainerStore) {
        await trainerStore.saveTrainingJob(jobRecord);
      }

      // Start training asynchronously
      console.log(`[Training] Starting async training for job ${jobId}, agent ${agentId}`);
      startTrainingAsync(mastra, agent, jobId, config, trainerStore).catch(err => {
        console.error(`[Training] Training job ${jobId} failed:`, err);
      });

      return jobToApiFormat(jobRecord);
    } catch (error) {
      return handleError(error, 'Failed to start training job');
    }
  },
});

/**
 * Cancel a training job
 */
export const CANCEL_TRAINING_JOB_ROUTE = createRoute({
  method: 'POST',
  path: '/api/training/jobs/:jobId/cancel',
  responseType: 'json',
  pathParamSchema: jobIdPathParams,
  responseSchema: jobResponseSchema,
  summary: 'Cancel a training job',
  description: 'Cancels a running or pending training job',
  tags: ['Training'],
  handler: async ({ mastra, jobId }) => {
    try {
      const trainerStore = await getTrainerStorage(mastra);

      if (!trainerStore) {
        throw new HTTPException(404, { message: 'Training job not found' });
      }

      const job = await trainerStore.getTrainingJob(jobId);
      if (!job) {
        throw new HTTPException(404, { message: 'Training job not found' });
      }

      if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') {
        throw new HTTPException(400, { message: `Cannot cancel job in ${job.status} state` });
      }

      const updated = await trainerStore.updateTrainingJob(jobId, {
        status: 'cancelled',
        completedAt: new Date(),
      });

      // TODO: Cancel on provider side if job has providerJobId

      return jobToApiFormat(updated!);
    } catch (error) {
      return handleError(error, 'Failed to cancel training job');
    }
  },
});

/**
 * Get training job events
 */
export const GET_TRAINING_JOB_EVENTS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/training/jobs/:jobId/events',
  responseType: 'json',
  pathParamSchema: jobIdPathParams,
  responseSchema: jobEventsResponseSchema,
  summary: 'Get training job events',
  description: 'Returns event log for a specific training job',
  tags: ['Training'],
  handler: async ({ mastra, jobId }) => {
    try {
      const trainerStore = await getTrainerStorage(mastra);

      if (!trainerStore) {
        throw new HTTPException(404, { message: 'Training job not found' });
      }

      const job = await trainerStore.getTrainingJob(jobId);
      if (!job) {
        throw new HTTPException(404, { message: 'Training job not found' });
      }

      // If we have a provider job ID, try to fetch real events from OpenAI
      if (job.providerJobId) {
        try {
          const trainerModule = await import('@mastra/trainer');
          const apiKey = process.env.OPENAI_API_KEY;
          if (apiKey) {
            const provider = trainerModule.createOpenAIProvider({ apiKey });
            const providerEvents = await provider.getJobEvents(job.providerJobId);

            if (providerEvents && providerEvents.length > 0) {
              // Return real events from OpenAI
              return {
                events: providerEvents.map((e: { time: Date; level: string; message: string }) => ({
                  time: e.time.toISOString(),
                  level: e.level as 'info' | 'warn' | 'error',
                  message: e.message,
                })),
              };
            }
          }
        } catch {
          // Fall through to synthetic events if we can't fetch from provider
        }
      }

      // Build synthetic events from job state as fallback
      const events: Array<{ time: string; level: 'info' | 'warn' | 'error'; message: string }> = [];

      events.push({
        time: job.createdAt.toISOString(),
        level: 'info',
        message: 'Job created',
      });

      if (job.startedAt) {
        events.push({
          time: job.startedAt.toISOString(),
          level: 'info',
          message: 'Training started',
        });
      }

      if (job.status === 'running' || job.status === 'preparing') {
        const statusLabel = job.providerStatus ? job.providerStatus.replace(/_/g, ' ') : job.status;
        events.push({
          time: new Date().toISOString(),
          level: 'info',
          message: `Status: ${statusLabel}${job.trainingExamples ? ` (${job.trainingExamples} examples)` : ''}`,
        });
      }

      if (job.completedAt) {
        events.push({
          time: job.completedAt.toISOString(),
          level: job.status === 'failed' ? 'error' : 'info',
          message: job.status === 'failed' ? `Training failed: ${job.error}` : 'Training completed',
        });
      }

      return { events };
    } catch (error) {
      return handleError(error, 'Failed to get training job events');
    }
  },
});

/**
 * Get training job checkpoints
 */
export const GET_TRAINING_JOB_CHECKPOINTS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/training/jobs/:jobId/checkpoints',
  responseType: 'json',
  pathParamSchema: jobIdPathParams,
  responseSchema: jobCheckpointsResponseSchema,
  summary: 'Get training job checkpoints',
  description: 'Returns model checkpoints for a training job',
  tags: ['Training'],
  handler: async ({ mastra, jobId }) => {
    try {
      const trainerStore = await getTrainerStorage(mastra);

      if (!trainerStore) {
        throw new HTTPException(404, { message: 'Training job not found' });
      }

      const job = await trainerStore.getTrainingJob(jobId);
      if (!job) {
        throw new HTTPException(404, { message: 'Training job not found' });
      }

      // TODO: Fetch actual checkpoints from provider
      const checkpoints: Array<{
        id: string;
        model: string;
        step: number;
        metrics: { trainingLoss?: number };
      }> = [];

      if (job.metrics?.steps) {
        checkpoints.push({
          id: `${job.id}-cp-final`,
          model: job.fineTunedModelId || `${job.baseModel}:ft-checkpoint`,
          step: job.metrics.steps,
          metrics: { trainingLoss: job.metrics.trainingLoss },
        });
      }

      return { checkpoints };
    } catch (error) {
      return handleError(error, 'Failed to get training job checkpoints');
    }
  },
});

/**
 * List trained models
 */
export const LIST_TRAINED_MODELS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/training/models',
  responseType: 'json',
  queryParamSchema: listModelsQuerySchema,
  responseSchema: listModelsResponseSchema,
  summary: 'List trained models',
  description: 'Returns a list of all trained models',
  tags: ['Training'],
  handler: async ({ mastra, agentId, isActive, limit, offset }) => {
    try {
      const trainerStore = await getTrainerStorage(mastra);

      if (!trainerStore) {
        return { models: [] };
      }

      const { models } = await trainerStore.listTrainedModels({
        agentId,
        isActive,
        limit,
        offset,
      });

      return {
        models: models.map(modelToApiFormat),
      };
    } catch (error) {
      return handleError(error, 'Failed to list trained models');
    }
  },
});

/**
 * Get a trained model by ID
 */
export const GET_TRAINED_MODEL_ROUTE = createRoute({
  method: 'GET',
  path: '/api/training/models/:modelId',
  responseType: 'json',
  pathParamSchema: modelIdPathParams,
  responseSchema: modelResponseSchema,
  summary: 'Get trained model details',
  description: 'Returns details for a specific trained model',
  tags: ['Training'],
  handler: async ({ mastra, modelId }) => {
    try {
      const trainerStore = await getTrainerStorage(mastra);

      if (!trainerStore) {
        throw new HTTPException(404, { message: 'Trained model not found' });
      }

      const model = await trainerStore.getTrainedModel(modelId);
      if (!model) {
        throw new HTTPException(404, { message: 'Trained model not found' });
      }

      return modelToApiFormat(model);
    } catch (error) {
      return handleError(error, 'Failed to get trained model');
    }
  },
});

/**
 * Set active model for an agent
 */
export const SET_ACTIVE_MODEL_ROUTE = createRoute({
  method: 'POST',
  path: '/api/training/models/:modelId/activate',
  responseType: 'json',
  pathParamSchema: modelIdPathParams,
  responseSchema: modelResponseSchema,
  summary: 'Activate a trained model',
  description: 'Sets a trained model as the active model for its agent',
  tags: ['Training'],
  handler: async ({ mastra, modelId }) => {
    try {
      const trainerStore = await getTrainerStorage(mastra);

      if (!trainerStore) {
        throw new HTTPException(404, { message: 'Trained model not found' });
      }

      const model = await trainerStore.getTrainedModel(modelId);
      if (!model) {
        throw new HTTPException(404, { message: 'Trained model not found' });
      }

      await trainerStore.setActiveModel(model.agentId, modelId);

      const updated = await trainerStore.getTrainedModel(modelId);
      return modelToApiFormat(updated!);
    } catch (error) {
      return handleError(error, 'Failed to set active model');
    }
  },
});

// Helper functions

function jobToApiFormat(job: {
  id: string;
  agentId: string;
  agentName: string;
  method: string;
  status: string;
  providerStatus?: string;
  providerJobId?: string;
  fineTunedModelId?: string;
  baseModel: string;
  trainingExamples: number;
  validationExamples?: number;
  metrics?: { trainingLoss?: number; validationLoss?: number; trainedTokens?: number; epochs?: number; steps?: number };
  progress?: { stage: string; stageLabel: string; current: number; total: number; percentage: number };
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}): TrainingJob {
  return {
    id: job.id,
    agentId: job.agentId,
    agentName: job.agentName,
    method: job.method as 'sft' | 'dpo',
    status: job.status as 'pending' | 'preparing' | 'running' | 'succeeded' | 'failed' | 'cancelled',
    providerStatus: job.providerStatus,
    providerJobId: job.providerJobId,
    fineTunedModelId: job.fineTunedModelId,
    baseModel: job.baseModel,
    trainingExamples: job.trainingExamples,
    validationExamples: job.validationExamples,
    metrics: job.metrics,
    progress: job.progress as TrainingJob['progress'],
    error: job.error,
    createdAt: job.createdAt instanceof Date ? job.createdAt.toISOString() : job.createdAt,
    updatedAt: job.updatedAt instanceof Date ? job.updatedAt.toISOString() : job.updatedAt,
    startedAt: job.startedAt instanceof Date ? job.startedAt.toISOString() : job.startedAt,
    completedAt: job.completedAt instanceof Date ? job.completedAt.toISOString() : job.completedAt,
  };
}

function modelToApiFormat(model: {
  id: string;
  agentId: string;
  agentName: string;
  modelId: string;
  baseModel: string;
  trainingJobId: string;
  method: string;
  isActive: boolean;
  metrics?: { trainingLoss?: number; validationLoss?: number; trainedTokens?: number };
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: model.id,
    agentId: model.agentId,
    agentName: model.agentName,
    modelId: model.modelId,
    baseModel: model.baseModel,
    trainingJobId: model.trainingJobId,
    method: model.method as 'sft' | 'dpo',
    isActive: model.isActive,
    metrics: model.metrics,
    createdAt: model.createdAt instanceof Date ? model.createdAt.toISOString() : model.createdAt,
    updatedAt: model.updatedAt instanceof Date ? model.updatedAt.toISOString() : model.updatedAt,
  };
}

/**
 * UI config format from playground
 */
interface UITrainingConfig {
  method: string;
  dataSource?: 'traces' | 'dataset';
  filter?: {
    since?: string;
    until?: string;
    limit?: number;
  };
  scoring?: {
    scorerIds?: string[];
    weights?: Record<string, number>;
    gates?: Array<{
      scorerId: string;
      operator: 'gte' | 'gt' | 'lte' | 'lt' | 'eq';
      threshold: number;
    }>;
  };
  selection?: {
    minScore?: number;
    maxExamples?: number;
    holdoutRatio?: number;
    dedupe?: boolean;
  };
  provider: {
    baseModel: string;
    apiKey?: string;
    organizationId?: string;
    epochs?: number;
    batchSize?: number;
    learningRateMultiplier?: number;
  };
}

/**
 * Transform UI config to trainer's FitAgentOptions format
 */
function transformConfigForTrainer(config: UITrainingConfig, agentName: string) {
  // Build data config (dataset source)
  const data: {
    source: 'traces' | 'dataset' | 'file';
    filter?: {
      agentName?: string;
      since?: Date;
      until?: Date;
      limit?: number;
    };
  } = {
    source: config.dataSource || 'traces',
  };

  // Add filter for traces source
  if (data.source === 'traces') {
    data.filter = {
      agentName,
    };
    if (config.filter?.since) {
      data.filter.since = new Date(config.filter.since);
    }
    if (config.filter?.until) {
      data.filter.until = new Date(config.filter.until);
    }
    if (config.filter?.limit) {
      data.filter.limit = config.filter.limit;
    }
  }

  // Build scoring config
  // Transform { scorerIds, weights } to { composite: weights }
  const scoring: {
    composite: Record<string, number>;
    gates?: Array<{
      scorerId: string;
      operator: 'gte' | 'gt' | 'lte' | 'lt' | 'eq';
      threshold: number;
    }>;
  } = {
    composite: {},
  };

  if (config.scoring?.weights) {
    scoring.composite = config.scoring.weights;
  } else if (config.scoring?.scorerIds) {
    // If only scorerIds provided, give each equal weight
    for (const id of config.scoring.scorerIds) {
      scoring.composite[id] = 1;
    }
  }

  if (config.scoring?.gates) {
    scoring.gates = config.scoring.gates;
  }

  // Build provider config
  const provider: {
    kind: 'openai';
    baseModel: string;
    hyperparams?: {
      n_epochs?: number;
      batch_size?: number;
      learning_rate_multiplier?: number;
    };
  } = {
    kind: 'openai',
    baseModel: config.provider.baseModel,
  };

  if (config.provider.epochs || config.provider.batchSize || config.provider.learningRateMultiplier) {
    provider.hyperparams = {};
    if (config.provider.epochs) {
      provider.hyperparams.n_epochs = config.provider.epochs;
    }
    if (config.provider.batchSize) {
      provider.hyperparams.batch_size = config.provider.batchSize;
    }
    if (config.provider.learningRateMultiplier) {
      provider.hyperparams.learning_rate_multiplier = config.provider.learningRateMultiplier;
    }
  }

  return {
    method: config.method as 'sft' | 'dpo',
    data,
    scoring,
    selection: config.selection,
    provider,
  };
}

/**
 * Start training asynchronously.
 * Note: This function dynamically imports @mastra/trainer to avoid making it a hard dependency.
 */
async function startTrainingAsync(
  mastra: {
    getStorage: () => { getStore: (name: 'trainer') => Promise<TrainerStorage | undefined> } | undefined;
    getAgent: (id: string) => { id: string; name: string } | undefined;
  },
  agent: { id: string; name: string },
  jobId: string,
  config: UITrainingConfig,
  trainerStore: TrainerStorage | undefined,
): Promise<void> {
  console.log(`[Training] startTrainingAsync called for job ${jobId}`);
  try {
    // Import trainer dynamically to avoid making it a hard dependency
    // The user must have @mastra/trainer installed for training to work
    let trainerModule: {
      createOpenAIProvider: (opts: { apiKey?: string; organizationId?: string }) => unknown;
      Trainer: new (opts: { mastra: unknown; provider: unknown; storage?: unknown }) => {
        fitAgent: (
          agent: unknown,
          config: unknown,
        ) => Promise<{
          status: string;
          jobId: string;
          fineTunedModelId?: string;
          metrics?: unknown;
          artifacts?: { trainingFile?: string; validationFile?: string };
        }>;
        waitForJob: (
          jobId: string,
          onProgress?: (job: {
            status: string;
            providerStatus?: string;
            fineTunedModelId?: string;
            metrics?: unknown;
            error?: string;
          }) => void,
        ) => Promise<{
          status: string;
          providerStatus?: string;
          fineTunedModelId?: string;
          metrics?: unknown;
          error?: string;
        }>;
      };
    };
    try {
      console.log(`[Training] Importing @mastra/trainer...`);
      trainerModule = await import('@mastra/trainer');
      console.log(`[Training] @mastra/trainer imported successfully`);
    } catch (importErr) {
      console.error('[Training] Failed to import @mastra/trainer:', importErr);
      if (trainerStore) {
        await trainerStore.updateTrainingJob(jobId, {
          status: 'failed',
          error: '@mastra/trainer package is not installed',
          completedAt: new Date(),
        });
      }
      return;
    }

    // Update status to preparing
    if (trainerStore) {
      await trainerStore.updateTrainingJob(jobId, {
        status: 'preparing',
      });
    }

    // Create provider
    const provider = trainerModule.createOpenAIProvider({
      apiKey: config.provider.apiKey || process.env.OPENAI_API_KEY,
      organizationId: config.provider.organizationId,
    });

    // Create trainer
    const trainer = new trainerModule.Trainer({
      mastra,
      provider,
      storage: mastra.getStorage?.(),
    });

    // Transform config from UI format to trainer format
    const trainerConfig = transformConfigForTrainer(config, agent.name);

    // Add progress callback to update job record
    const configWithProgress = {
      ...trainerConfig,
      onProgress: async (progress: {
        stage: string;
        stageLabel: string;
        current: number;
        total: number;
        percentage: number;
      }) => {
        console.log(`[Training] Progress: ${progress.stageLabel} (${progress.percentage}%)`);
        if (trainerStore) {
          await trainerStore.updateTrainingJob(jobId, {
            progress: progress as TrainingJobRecord['progress'],
          });
        }
      },
    };

    console.log(`[Training] Config transformed, calling fitAgent...`);

    // Run training - this submits the job to OpenAI
    const result = await trainer.fitAgent(agent, configWithProgress);
    console.log(`[Training] fitAgent completed. OpenAI job ID: ${result.jobId}, status: ${result.status}`);

    // Update job with initial results and provider job ID
    if (trainerStore) {
      await trainerStore.updateTrainingJob(jobId, {
        status: result.status as TrainingJobRecord['status'],
        providerJobId: result.jobId,
        trainingFileId: result.artifacts?.trainingFile,
        validationFileId: result.artifacts?.validationFile,
      });
    }

    console.log(`[Training] Waiting for job completion...`);
    // Now wait for the job to complete, updating status as it progresses
    // This is important because OpenAI jobs can fail during validation
    const completedJob = await trainer.waitForJob(result.jobId, async progressJob => {
      console.log(
        `[Training] Progress update: status=${progressJob.status}, providerStatus=${progressJob.providerStatus}`,
      );
      // Update status on each progress callback
      if (trainerStore) {
        await trainerStore.updateTrainingJob(jobId, {
          status: progressJob.status as TrainingJobRecord['status'],
          providerStatus: progressJob.providerStatus,
          metrics: progressJob.metrics as TrainingJobRecord['metrics'],
        });
      }
    });

    // Update job with final results
    if (trainerStore) {
      const updates: Partial<TrainingJobRecord> = {
        status: completedJob.status as TrainingJobRecord['status'],
        providerStatus: completedJob.providerStatus,
        fineTunedModelId: completedJob.fineTunedModelId,
        metrics: completedJob.metrics as TrainingJobRecord['metrics'],
        error: completedJob.error,
        completedAt: new Date(),
      };

      await trainerStore.updateTrainingJob(jobId, updates);

      // If succeeded, create trained model record
      if (completedJob.status === 'succeeded' && completedJob.fineTunedModelId) {
        const modelId = `model-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const trainedModel: TrainedModelRecord = {
          id: modelId,
          agentId: agent.id,
          agentName: agent.name,
          modelId: completedJob.fineTunedModelId,
          baseModel: config.provider.baseModel,
          trainingJobId: jobId,
          method: config.method as TrainedModelRecord['method'],
          isActive: false,
          metrics: completedJob.metrics as TrainedModelRecord['metrics'],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await trainerStore.saveTrainedModel(trainedModel);
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Training job ${jobId} error:`, error);

    if (trainerStore) {
      await trainerStore.updateTrainingJob(jobId, {
        status: 'failed',
        error: errorMessage,
        completedAt: new Date(),
      });
    }
  }
}
