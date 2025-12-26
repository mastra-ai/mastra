import { z } from 'zod';

// Training method
export const trainingMethodSchema = z.enum(['sft', 'dpo']);

// Training job status
export const trainingJobStatusSchema = z.enum(['pending', 'preparing', 'running', 'succeeded', 'failed', 'cancelled']);

// Training metrics
export const trainingMetricsSchema = z.object({
  trainingLoss: z.number().optional(),
  validationLoss: z.number().optional(),
  trainedTokens: z.number().optional(),
  epochs: z.number().optional(),
  steps: z.number().optional(),
});

// Training progress
export const trainingProgressSchema = z.object({
  stage: z.enum(['loading', 'generating', 'scoring', 'selecting', 'rendering', 'uploading', 'submitting', 'training']),
  stageLabel: z.string(),
  current: z.number(),
  total: z.number(),
  percentage: z.number(),
});

// Training job
export const trainingJobSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  agentName: z.string(),
  method: trainingMethodSchema,
  status: trainingJobStatusSchema,
  /** Raw status from the provider (e.g., "validating_files", "queued") */
  providerStatus: z.string().optional(),
  providerJobId: z.string().optional(),
  fineTunedModelId: z.string().optional(),
  baseModel: z.string(),
  trainingExamples: z.number(),
  validationExamples: z.number().optional(),
  metrics: trainingMetricsSchema.optional(),
  progress: trainingProgressSchema.optional(),
  error: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
});

// Gate configuration
export const gateSchema = z.object({
  scorerId: z.string(),
  operator: z.enum(['gte', 'gt', 'lte', 'lt', 'eq']),
  threshold: z.number(),
});

// Training config for starting a job
export const trainingConfigSchema = z.object({
  method: trainingMethodSchema,
  dataSource: z.enum(['traces', 'dataset']),
  filter: z
    .object({
      since: z.string().optional(),
      until: z.string().optional(),
      limit: z.number().optional(),
    })
    .optional(),
  scoring: z.object({
    scorerIds: z.array(z.string()),
    weights: z.record(z.number()),
    gates: z.array(gateSchema).optional(),
  }),
  selection: z
    .object({
      minScore: z.number().optional(),
      maxExamples: z.number().optional(),
      holdoutRatio: z.number().optional(),
      dedupe: z.boolean().optional(),
    })
    .optional(),
  provider: z.object({
    baseModel: z.string(),
    epochs: z.number().optional(),
    batchSize: z.number().optional(),
    learningRateMultiplier: z.number().optional(),
  }),
});

// Path params
export const jobIdPathParams = z.object({
  jobId: z.string(),
});

// Query params for listing jobs
export const listJobsQuerySchema = z.object({
  agentId: z.string().optional(),
  status: trainingJobStatusSchema.optional(),
  method: trainingMethodSchema.optional(),
  limit: z.coerce.number().optional().default(50),
  offset: z.coerce.number().optional().default(0),
});

// Request body for starting a job
export const startJobBodySchema = z.object({
  agentId: z.string(),
  config: trainingConfigSchema,
});

// Response schemas
export const listJobsResponseSchema = z.object({
  jobs: z.array(trainingJobSchema),
});

export const jobResponseSchema = trainingJobSchema;

export const jobEventsResponseSchema = z.object({
  events: z.array(
    z.object({
      time: z.string(),
      level: z.enum(['info', 'warn', 'error']),
      message: z.string(),
    }),
  ),
});

export const jobCheckpointsResponseSchema = z.object({
  checkpoints: z.array(
    z.object({
      id: z.string(),
      model: z.string(),
      step: z.number(),
      metrics: trainingMetricsSchema,
    }),
  ),
});

// Trained model schema
export const trainedModelSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  agentName: z.string(),
  modelId: z.string(),
  baseModel: z.string(),
  trainingJobId: z.string(),
  method: trainingMethodSchema,
  isActive: z.boolean(),
  metrics: trainingMetricsSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Model path params
export const modelIdPathParams = z.object({
  modelId: z.string(),
});

// Query params for listing models
export const listModelsQuerySchema = z.object({
  agentId: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  limit: z.coerce.number().optional().default(50),
  offset: z.coerce.number().optional().default(0),
});

// Response schemas for models
export const listModelsResponseSchema = z.object({
  models: z.array(trainedModelSchema),
});

export const modelResponseSchema = trainedModelSchema;

// Set active model body
export const setActiveModelBodySchema = z.object({
  modelId: z.string(),
});

export type TrainingMethod = z.infer<typeof trainingMethodSchema>;
export type TrainingJobStatus = z.infer<typeof trainingJobStatusSchema>;
export type TrainingJob = z.infer<typeof trainingJobSchema>;
export type TrainingConfig = z.infer<typeof trainingConfigSchema>;
export type Gate = z.infer<typeof gateSchema>;
export type TrainedModel = z.infer<typeof trainedModelSchema>;
