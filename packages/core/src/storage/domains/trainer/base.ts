import { StorageDomain } from '../base';

export type TrainingJobStatus = 'pending' | 'preparing' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export type TrainingMethod = 'sft' | 'dpo';

export interface TrainingJobProgress {
  stage: 'loading' | 'generating' | 'scoring' | 'selecting' | 'rendering' | 'uploading' | 'submitting' | 'training';
  stageLabel: string;
  current: number;
  total: number;
  percentage: number;
}

export interface TrainingJobRecord {
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
  trainingFileId?: string;
  validationFileId?: string;
  metrics?: {
    trainingLoss?: number;
    validationLoss?: number;
    trainedTokens?: number;
    epochs?: number;
    steps?: number;
  };
  progress?: TrainingJobProgress;
  error?: string;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface TrainedModelRecord {
  id: string;
  agentId: string;
  agentName: string;
  modelId: string;
  baseModel: string;
  trainingJobId: string;
  method: TrainingMethod;
  isActive: boolean;
  metrics?: {
    trainingLoss?: number;
    validationLoss?: number;
    trainedTokens?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ListTrainingJobsInput {
  agentId?: string;
  status?: TrainingJobStatus;
  method?: TrainingMethod;
  limit?: number;
  offset?: number;
}

export interface ListTrainedModelsInput {
  agentId?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Storage domain for training jobs and trained models.
 */
export abstract class TrainerStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'TRAINER',
    });
  }

  // Training Jobs
  abstract saveTrainingJob(job: TrainingJobRecord): Promise<TrainingJobRecord>;
  abstract getTrainingJob(id: string): Promise<TrainingJobRecord | null>;
  abstract updateTrainingJob(id: string, updates: Partial<TrainingJobRecord>): Promise<TrainingJobRecord | null>;
  abstract listTrainingJobs(input?: ListTrainingJobsInput): Promise<{ jobs: TrainingJobRecord[]; total: number }>;
  abstract deleteTrainingJob(id: string): Promise<void>;

  // Trained Models
  abstract saveTrainedModel(model: TrainedModelRecord): Promise<TrainedModelRecord>;
  abstract getTrainedModel(id: string): Promise<TrainedModelRecord | null>;
  abstract getActiveModelForAgent(agentId: string): Promise<TrainedModelRecord | null>;
  abstract updateTrainedModel(id: string, updates: Partial<TrainedModelRecord>): Promise<TrainedModelRecord | null>;
  abstract listTrainedModels(input?: ListTrainedModelsInput): Promise<{ models: TrainedModelRecord[]; total: number }>;
  abstract setActiveModel(agentId: string, modelId: string): Promise<void>;
  abstract deleteTrainedModel(id: string): Promise<void>;
}
