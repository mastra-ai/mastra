/**
 * OpenAI Training Provider
 */

import type {
  TrainerProvider,
  TrainingJob,
  TrainingJobStatus,
  TrainingMethod,
  StartJobArgs,
  TrainingMetrics,
} from '../../types';
import { OpenAIClient } from './client';
import { OpenAIFilesAPI } from './files';
import { OpenAIFineTuningAPI, type FineTuningJob } from './fine-tuning';

export interface OpenAIProviderOptions {
  apiKey: string;
  baseUrl?: string;
  organization?: string;
}

/**
 * OpenAI Training Provider implementation.
 *
 * Supports SFT and DPO training methods via OpenAI's fine-tuning API.
 */
export class OpenAIProvider implements TrainerProvider {
  name = 'openai';

  private client: OpenAIClient;
  private files: OpenAIFilesAPI;
  private fineTuning: OpenAIFineTuningAPI;

  constructor(options: OpenAIProviderOptions) {
    this.client = new OpenAIClient({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      organization: options.organization,
    });
    this.files = new OpenAIFilesAPI(this.client);
    this.fineTuning = new OpenAIFineTuningAPI(this.client);
  }

  /**
   * Upload a file for training.
   */
  async uploadFile(content: Uint8Array, filename: string, purpose: 'fine-tune' | 'batch'): Promise<{ fileId: string }> {
    const file = await this.files.upload(content, filename, purpose);
    // Wait for file to be processed
    await this.files.waitForProcessing(file.id);
    return { fileId: file.id };
  }

  /**
   * Start a training job.
   */
  async startJob(args: StartJobArgs): Promise<{ jobId: string }> {
    const request = this.buildCreateRequest(args);
    const job = await this.fineTuning.create(request);
    return { jobId: job.id };
  }

  /**
   * Get job status.
   */
  async getJob(jobId: string): Promise<TrainingJob> {
    const job = await this.fineTuning.get(jobId);
    return this.convertJob(job);
  }

  /**
   * Cancel a job.
   */
  async cancelJob(jobId: string): Promise<void> {
    await this.fineTuning.cancel(jobId);
  }

  /**
   * List jobs.
   */
  async listJobs(agentId?: string): Promise<TrainingJob[]> {
    const response = await this.fineTuning.list(100);
    const jobs = response.data.map(job => this.convertJob(job));

    if (agentId) {
      // Filter by suffix containing agent ID
      return jobs.filter(j => j.agentId === agentId);
    }

    return jobs;
  }

  /**
   * Wait for job to complete with progress callback.
   */
  async waitForJob(jobId: string, onProgress?: (job: TrainingJob) => void): Promise<TrainingJob> {
    const job = await this.fineTuning.waitForCompletion(jobId, {
      onProgress: ftJob => {
        if (onProgress) {
          onProgress(this.convertJob(ftJob));
        }
      },
    });
    return this.convertJob(job);
  }

  /**
   * Get job events/logs.
   */
  async getJobEvents(jobId: string): Promise<Array<{ time: Date; level: string; message: string }>> {
    const response = await this.fineTuning.listEvents(jobId, 100);
    return response.data.map(event => ({
      time: new Date(event.created_at * 1000),
      level: event.level,
      message: event.message,
    }));
  }

  /**
   * Get job checkpoints.
   */
  async getJobCheckpoints(jobId: string): Promise<
    Array<{
      id: string;
      model: string;
      step: number;
      metrics: TrainingMetrics;
    }>
  > {
    const response = await this.fineTuning.listCheckpoints(jobId, 100);
    return response.data.map(cp => ({
      id: cp.id,
      model: cp.fine_tuned_model_checkpoint,
      step: cp.step_number,
      metrics: {
        trainingLoss: cp.metrics.train_loss,
        validationLoss: cp.metrics.valid_loss,
        steps: cp.step_number,
      },
    }));
  }

  /**
   * Build create request from args.
   */
  private buildCreateRequest(args: StartJobArgs): Parameters<OpenAIFineTuningAPI['create']>[0] {
    const request: Parameters<OpenAIFineTuningAPI['create']>[0] = {
      model: args.baseModel,
      training_file: args.trainingFileId,
    };

    if (args.validationFileId) {
      request.validation_file = args.validationFileId;
    }

    if (args.suffix) {
      request.suffix = args.suffix;
    }

    if (args.hyperparams) {
      request.hyperparameters = {
        n_epochs: args.hyperparams.n_epochs as number | 'auto',
        batch_size: args.hyperparams.batch_size as number | 'auto',
        learning_rate_multiplier: args.hyperparams.learning_rate_multiplier as number | 'auto',
      };
    }

    // Set method based on training type
    if (args.method === 'dpo') {
      request.method = {
        type: 'dpo',
        dpo: {
          hyperparameters: args.hyperparams as Record<string, unknown>,
        },
      };
    } else {
      request.method = {
        type: 'supervised',
        supervised: {
          hyperparameters: args.hyperparams as Record<string, unknown>,
        },
      };
    }

    return request;
  }

  /**
   * Convert OpenAI job to TrainingJob.
   */
  private convertJob(job: FineTuningJob): TrainingJob {
    const status = this.convertStatus(job.status);

    // Extract agent info from suffix
    const agentInfo = this.parseAgentFromSuffix(job.user_provided_suffix);

    return {
      id: job.id,
      agentId: agentInfo.agentId,
      agentName: agentInfo.agentName,
      method: this.getMethodFromJob(job),
      status,
      providerStatus: job.status, // Raw OpenAI status (validating_files, queued, running, etc.)
      providerJobId: job.id,
      fineTunedModelId: job.fine_tuned_model || undefined,
      baseModel: job.model,
      trainingExamples: 0, // Not available from API
      metrics: job.trained_tokens
        ? {
            trainedTokens: job.trained_tokens,
            epochs: typeof job.hyperparameters.n_epochs === 'number' ? job.hyperparameters.n_epochs : undefined,
          }
        : undefined,
      error: job.error?.message,
      config: {} as any, // Would need to store this separately
      createdAt: new Date(job.created_at * 1000),
      updatedAt: new Date(job.created_at * 1000),
      startedAt: job.created_at ? new Date(job.created_at * 1000) : undefined,
      completedAt: job.finished_at ? new Date(job.finished_at * 1000) : undefined,
    };
  }

  /**
   * Convert OpenAI status to TrainingJobStatus.
   */
  private convertStatus(status: FineTuningJob['status']): TrainingJobStatus {
    switch (status) {
      case 'validating_files':
        return 'preparing';
      case 'queued':
        return 'pending';
      case 'running':
        return 'running';
      case 'succeeded':
        return 'succeeded';
      case 'failed':
        return 'failed';
      case 'cancelled':
        return 'cancelled';
      default:
        return 'pending';
    }
  }

  /**
   * Get method from job.
   */
  private getMethodFromJob(job: FineTuningJob): TrainingMethod {
    if (job.method?.type === 'dpo') {
      return 'dpo';
    }
    return 'sft';
  }

  /**
   * Parse agent info from suffix.
   */
  private parseAgentFromSuffix(suffix: string | null): { agentId: string; agentName: string } {
    if (!suffix) {
      return { agentId: 'unknown', agentName: 'Unknown Agent' };
    }

    // Expected format: "mastra-{agentId}"
    const match = suffix.match(/^mastra-(.+)$/);
    if (match) {
      return { agentId: match[1]!, agentName: match[1]! };
    }

    return { agentId: suffix, agentName: suffix };
  }
}

// Re-export other modules
export { OpenAIClient } from './client';
export { OpenAIFilesAPI } from './files';
export { OpenAIFineTuningAPI } from './fine-tuning';
