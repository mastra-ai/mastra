/**
 * OpenAI Fine-tuning API wrapper.
 */

import type { OpenAIClient } from './client';

export interface FineTuningJob {
  id: string;
  object: 'fine_tuning.job';
  created_at: number;
  finished_at: number | null;
  model: string;
  fine_tuned_model: string | null;
  organization_id: string;
  status: 'validating_files' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  hyperparameters: {
    n_epochs: number | 'auto';
    batch_size: number | 'auto';
    learning_rate_multiplier: number | 'auto';
  };
  training_file: string;
  validation_file: string | null;
  result_files: string[];
  trained_tokens: number | null;
  error: {
    code: string;
    message: string;
    param: string | null;
  } | null;
  user_provided_suffix: string | null;
  seed: number | null;
  estimated_finish: number | null;
  integrations: unknown[];
  method?: {
    type: 'supervised' | 'dpo';
    supervised?: {
      hyperparameters: Record<string, unknown>;
    };
    dpo?: {
      hyperparameters: Record<string, unknown>;
    };
  };
}

export interface FineTuningJobEvent {
  id: string;
  object: 'fine_tuning.job.event';
  created_at: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  type: string;
  data?: unknown;
}

export interface ListFineTuningJobsResponse {
  object: 'list';
  data: FineTuningJob[];
  has_more: boolean;
}

export interface ListFineTuningEventsResponse {
  object: 'list';
  data: FineTuningJobEvent[];
  has_more: boolean;
}

export interface CreateFineTuningJobRequest {
  model: string;
  training_file: string;
  validation_file?: string;
  hyperparameters?: {
    n_epochs?: number | 'auto';
    batch_size?: number | 'auto';
    learning_rate_multiplier?: number | 'auto';
  };
  suffix?: string;
  seed?: number;
  method?: {
    type: 'supervised' | 'dpo';
    supervised?: {
      hyperparameters?: Record<string, unknown>;
    };
    dpo?: {
      hyperparameters?: {
        beta?: number;
      };
    };
  };
}

export interface FineTuningCheckpoint {
  id: string;
  object: 'fine_tuning.job.checkpoint';
  created_at: number;
  fine_tuning_job_id: string;
  fine_tuned_model_checkpoint: string;
  step_number: number;
  metrics: {
    step?: number;
    train_loss?: number;
    train_mean_token_accuracy?: number;
    valid_loss?: number;
    valid_mean_token_accuracy?: number;
    full_valid_loss?: number;
    full_valid_mean_token_accuracy?: number;
  };
}

export interface ListCheckpointsResponse {
  object: 'list';
  data: FineTuningCheckpoint[];
  has_more: boolean;
}

export class OpenAIFineTuningAPI {
  constructor(private client: OpenAIClient) {}

  /**
   * Create a fine-tuning job.
   */
  async create(request: CreateFineTuningJobRequest): Promise<FineTuningJob> {
    return this.client.post<FineTuningJob>('/fine_tuning/jobs', request);
  }

  /**
   * Get a fine-tuning job.
   */
  async get(jobId: string): Promise<FineTuningJob> {
    return this.client.get<FineTuningJob>(`/fine_tuning/jobs/${jobId}`);
  }

  /**
   * List fine-tuning jobs.
   */
  async list(limit?: number, after?: string): Promise<ListFineTuningJobsResponse> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', String(limit));
    if (after) params.append('after', after);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.client.get<ListFineTuningJobsResponse>(`/fine_tuning/jobs${query}`);
  }

  /**
   * Cancel a fine-tuning job.
   */
  async cancel(jobId: string): Promise<FineTuningJob> {
    return this.client.post<FineTuningJob>(`/fine_tuning/jobs/${jobId}/cancel`);
  }

  /**
   * List events for a fine-tuning job.
   */
  async listEvents(jobId: string, limit?: number, after?: string): Promise<ListFineTuningEventsResponse> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', String(limit));
    if (after) params.append('after', after);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.client.get<ListFineTuningEventsResponse>(`/fine_tuning/jobs/${jobId}/events${query}`);
  }

  /**
   * List checkpoints for a fine-tuning job.
   */
  async listCheckpoints(jobId: string, limit?: number, after?: string): Promise<ListCheckpointsResponse> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', String(limit));
    if (after) params.append('after', after);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.client.get<ListCheckpointsResponse>(`/fine_tuning/jobs/${jobId}/checkpoints${query}`);
  }

  /**
   * Wait for a job to complete.
   */
  async waitForCompletion(
    jobId: string,
    options: {
      timeoutMs?: number;
      pollIntervalMs?: number;
      onProgress?: (job: FineTuningJob) => void;
    } = {},
  ): Promise<FineTuningJob> {
    const { timeoutMs = 3600000, pollIntervalMs = 30000, onProgress } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const job = await this.get(jobId);

      if (onProgress) {
        onProgress(job);
      }

      if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') {
        return job;
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Fine-tuning job timed out after ${timeoutMs}ms`);
  }
}
