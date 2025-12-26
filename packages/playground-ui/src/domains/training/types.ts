/**
 * Training types for the Playground UI.
 */

export type TrainingMethod = 'sft' | 'dpo';

export type TrainingJobStatus = 'pending' | 'preparing' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface TrainingJobProgress {
  stage: 'loading' | 'generating' | 'scoring' | 'selecting' | 'rendering' | 'uploading' | 'submitting' | 'training';
  stageLabel: string;
  current: number;
  total: number;
  percentage: number;
}

export interface TrainingJob {
  id: string;
  agentId: string;
  agentName: string;
  method: TrainingMethod;
  status: TrainingJobStatus;
  /** Raw status from the provider (e.g., "validating_files", "queued") */
  providerStatus?: string;
  providerJobId?: string;
  fineTunedModelId?: string;
  baseModel: string;
  trainingExamples: number;
  validationExamples?: number;
  metrics?: TrainingMetrics;
  progress?: TrainingJobProgress;
  error?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface TrainingMetrics {
  trainingLoss?: number;
  validationLoss?: number;
  trainedTokens?: number;
  epochs?: number;
  steps?: number;
}

export interface TrainingConfig {
  method: TrainingMethod;
  dataSource: 'traces' | 'dataset';
  filter?: {
    since?: string;
    until?: string;
    limit?: number;
  };
  scoring: {
    scorerIds: string[];
    weights: Record<string, number>;
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
    epochs?: number;
    batchSize?: number;
    learningRateMultiplier?: number;
  };
}

export interface TrainingJobEvent {
  time: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface TrainingJobCheckpoint {
  id: string;
  model: string;
  step: number;
  metrics: TrainingMetrics;
}
