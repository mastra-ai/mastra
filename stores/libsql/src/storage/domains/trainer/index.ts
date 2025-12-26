import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  TrainerStorage,
  createStorageErrorId,
  TABLE_TRAINING_JOBS,
  TABLE_TRAINED_MODELS,
  TRAINING_JOBS_SCHEMA,
  TRAINED_MODELS_SCHEMA,
} from '@mastra/core/storage';
import type {
  TrainingJobRecord,
  TrainedModelRecord,
  ListTrainingJobsInput,
  ListTrainedModelsInput,
} from '@mastra/core/storage';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';

export class TrainerLibSQL extends TrainerStorage {
  #db: LibSQLDB;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_TRAINING_JOBS, schema: TRAINING_JOBS_SCHEMA });
    await this.#db.createTable({ tableName: TABLE_TRAINED_MODELS, schema: TRAINED_MODELS_SCHEMA });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_TRAINING_JOBS });
    await this.#db.deleteData({ tableName: TABLE_TRAINED_MODELS });
  }

  private parseJson(value: any, fieldName?: string): any {
    if (!value) return undefined;
    if (typeof value !== 'string') return value;

    try {
      return JSON.parse(value);
    } catch (error) {
      const details: Record<string, string> = {
        value: value.length > 100 ? value.substring(0, 100) + '...' : value,
      };
      if (fieldName) {
        details.field = fieldName;
      }

      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'PARSE_JSON', 'INVALID_JSON'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Failed to parse JSON${fieldName ? ` for field "${fieldName}"` : ''}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details,
        },
        error,
      );
    }
  }

  private parseJobRow(row: any): TrainingJobRecord {
    return {
      id: row.id as string,
      agentId: row.agentId as string,
      agentName: row.agentName as string,
      method: row.method as 'sft' | 'dpo',
      status: row.status as TrainingJobRecord['status'],
      providerJobId: row.providerJobId as string | undefined,
      fineTunedModelId: row.fineTunedModelId as string | undefined,
      baseModel: row.baseModel as string,
      trainingExamples: row.trainingExamples as number,
      validationExamples: row.validationExamples as number | undefined,
      trainingFileId: row.trainingFileId as string | undefined,
      validationFileId: row.validationFileId as string | undefined,
      metrics: this.parseJson(row.metrics, 'metrics'),
      progress: this.parseJson(row.progress, 'progress'),
      error: row.error as string | undefined,
      config: this.parseJson(row.config, 'config') || {},
      createdAt: new Date(row.createdAt as string),
      updatedAt: new Date(row.updatedAt as string),
      startedAt: row.startedAt ? new Date(row.startedAt as string) : undefined,
      completedAt: row.completedAt ? new Date(row.completedAt as string) : undefined,
    };
  }

  private parseModelRow(row: any): TrainedModelRecord {
    return {
      id: row.id as string,
      agentId: row.agentId as string,
      agentName: row.agentName as string,
      modelId: row.modelId as string,
      baseModel: row.baseModel as string,
      trainingJobId: row.trainingJobId as string,
      method: row.method as 'sft' | 'dpo',
      isActive: Boolean(row.isActive),
      metrics: this.parseJson(row.metrics, 'metrics'),
      createdAt: new Date(row.createdAt as string),
      updatedAt: new Date(row.updatedAt as string),
    };
  }

  // Training Jobs
  async saveTrainingJob(job: TrainingJobRecord): Promise<TrainingJobRecord> {
    try {
      await this.#db.insert({
        tableName: TABLE_TRAINING_JOBS,
        record: {
          id: job.id,
          agentId: job.agentId,
          agentName: job.agentName,
          method: job.method,
          status: job.status,
          providerJobId: job.providerJobId ?? null,
          fineTunedModelId: job.fineTunedModelId ?? null,
          baseModel: job.baseModel,
          trainingExamples: job.trainingExamples,
          validationExamples: job.validationExamples ?? null,
          trainingFileId: job.trainingFileId ?? null,
          validationFileId: job.validationFileId ?? null,
          metrics: job.metrics ?? null,
          error: job.error ?? null,
          config: job.config,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
          startedAt: job.startedAt ?? null,
          completedAt: job.completedAt ?? null,
        },
      });

      return job;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'SAVE_TRAINING_JOB', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { jobId: job.id },
        },
        error,
      );
    }
  }

  async getTrainingJob(id: string): Promise<TrainingJobRecord | null> {
    try {
      const result = await this.#db.select<Record<string, any>>({
        tableName: TABLE_TRAINING_JOBS,
        keys: { id },
      });

      return result ? this.parseJobRow(result) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_TRAINING_JOB', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { jobId: id },
        },
        error,
      );
    }
  }

  async updateTrainingJob(id: string, updates: Partial<TrainingJobRecord>): Promise<TrainingJobRecord | null> {
    try {
      const existing = await this.getTrainingJob(id);
      if (!existing) return null;

      const data: Record<string, any> = {
        updatedAt: new Date(),
      };

      if (updates.status !== undefined) data.status = updates.status;
      if (updates.providerJobId !== undefined) data.providerJobId = updates.providerJobId;
      if (updates.fineTunedModelId !== undefined) data.fineTunedModelId = updates.fineTunedModelId;
      if (updates.trainingExamples !== undefined) data.trainingExamples = updates.trainingExamples;
      if (updates.validationExamples !== undefined) data.validationExamples = updates.validationExamples;
      if (updates.trainingFileId !== undefined) data.trainingFileId = updates.trainingFileId;
      if (updates.validationFileId !== undefined) data.validationFileId = updates.validationFileId;
      if (updates.metrics !== undefined) data.metrics = updates.metrics;
      if (updates.progress !== undefined) data.progress = updates.progress;
      if (updates.error !== undefined) data.error = updates.error;
      if (updates.startedAt !== undefined) data.startedAt = updates.startedAt;
      if (updates.completedAt !== undefined) data.completedAt = updates.completedAt;

      if (Object.keys(data).length > 1) {
        await this.#db.update({
          tableName: TABLE_TRAINING_JOBS,
          keys: { id },
          data,
        });
      }

      return this.getTrainingJob(id);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'UPDATE_TRAINING_JOB', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { jobId: id },
        },
        error,
      );
    }
  }

  async listTrainingJobs(input?: ListTrainingJobsInput): Promise<{ jobs: TrainingJobRecord[]; total: number }> {
    try {
      // Build WHERE conditions
      const conditions: string[] = [];
      const params: any[] = [];

      if (input?.agentId) {
        conditions.push('"agentId" = ?');
        params.push(input.agentId);
      }
      if (input?.status) {
        conditions.push('"status" = ?');
        params.push(input.status);
      }
      if (input?.method) {
        conditions.push('"method" = ?');
        params.push(input.method);
      }

      const whereClause =
        conditions.length > 0 ? { sql: `WHERE ${conditions.join(' AND ')}`, args: params } : undefined;

      // Get total count
      const total = await this.#db.selectTotalCount({
        tableName: TABLE_TRAINING_JOBS,
        whereClause,
      });

      if (total === 0) {
        return { jobs: [], total: 0 };
      }

      // Get paginated results
      const rows = await this.#db.selectMany<Record<string, any>>({
        tableName: TABLE_TRAINING_JOBS,
        whereClause,
        orderBy: '"createdAt" DESC',
        limit: input?.limit,
        offset: input?.offset,
      });

      const jobs = rows.map(row => this.parseJobRow(row));

      return { jobs, total };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_TRAINING_JOBS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteTrainingJob(id: string): Promise<void> {
    try {
      await this.#db.delete({
        tableName: TABLE_TRAINING_JOBS,
        keys: { id },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_TRAINING_JOB', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { jobId: id },
        },
        error,
      );
    }
  }

  // Trained Models
  async saveTrainedModel(model: TrainedModelRecord): Promise<TrainedModelRecord> {
    try {
      await this.#db.insert({
        tableName: TABLE_TRAINED_MODELS,
        record: {
          id: model.id,
          agentId: model.agentId,
          agentName: model.agentName,
          modelId: model.modelId,
          baseModel: model.baseModel,
          trainingJobId: model.trainingJobId,
          method: model.method,
          isActive: model.isActive ? 1 : 0,
          metrics: model.metrics ?? null,
          createdAt: model.createdAt,
          updatedAt: model.updatedAt,
        },
      });

      return model;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'SAVE_TRAINED_MODEL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { modelId: model.id },
        },
        error,
      );
    }
  }

  async getTrainedModel(id: string): Promise<TrainedModelRecord | null> {
    try {
      const result = await this.#db.select<Record<string, any>>({
        tableName: TABLE_TRAINED_MODELS,
        keys: { id },
      });

      return result ? this.parseModelRow(result) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_TRAINED_MODEL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { modelId: id },
        },
        error,
      );
    }
  }

  async getActiveModelForAgent(agentId: string): Promise<TrainedModelRecord | null> {
    try {
      const rows = await this.#db.selectMany<Record<string, any>>({
        tableName: TABLE_TRAINED_MODELS,
        whereClause: { sql: 'WHERE "agentId" = ? AND "isActive" = 1', args: [agentId] },
        limit: 1,
      });

      return rows.length > 0 ? this.parseModelRow(rows[0]) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_ACTIVE_MODEL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId },
        },
        error,
      );
    }
  }

  async updateTrainedModel(id: string, updates: Partial<TrainedModelRecord>): Promise<TrainedModelRecord | null> {
    try {
      const existing = await this.getTrainedModel(id);
      if (!existing) return null;

      const data: Record<string, any> = {
        updatedAt: new Date(),
      };

      if (updates.isActive !== undefined) data.isActive = updates.isActive ? 1 : 0;
      if (updates.metrics !== undefined) data.metrics = updates.metrics;

      if (Object.keys(data).length > 1) {
        await this.#db.update({
          tableName: TABLE_TRAINED_MODELS,
          keys: { id },
          data,
        });
      }

      return this.getTrainedModel(id);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'UPDATE_TRAINED_MODEL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { modelId: id },
        },
        error,
      );
    }
  }

  async listTrainedModels(input?: ListTrainedModelsInput): Promise<{ models: TrainedModelRecord[]; total: number }> {
    try {
      // Build WHERE conditions
      const conditions: string[] = [];
      const params: any[] = [];

      if (input?.agentId) {
        conditions.push('"agentId" = ?');
        params.push(input.agentId);
      }
      if (input?.isActive !== undefined) {
        conditions.push('"isActive" = ?');
        params.push(input.isActive ? 1 : 0);
      }

      const whereClause =
        conditions.length > 0 ? { sql: `WHERE ${conditions.join(' AND ')}`, args: params } : undefined;

      // Get total count
      const total = await this.#db.selectTotalCount({
        tableName: TABLE_TRAINED_MODELS,
        whereClause,
      });

      if (total === 0) {
        return { models: [], total: 0 };
      }

      // Get paginated results
      const rows = await this.#db.selectMany<Record<string, any>>({
        tableName: TABLE_TRAINED_MODELS,
        whereClause,
        orderBy: '"createdAt" DESC',
        limit: input?.limit,
        offset: input?.offset,
      });

      const models = rows.map(row => this.parseModelRow(row));

      return { models, total };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_TRAINED_MODELS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async setActiveModel(agentId: string, modelId: string): Promise<void> {
    try {
      // Get all active models for this agent and deactivate them
      const activeModels = await this.#db.selectMany<Record<string, any>>({
        tableName: TABLE_TRAINED_MODELS,
        whereClause: { sql: 'WHERE "agentId" = ? AND "isActive" = 1', args: [agentId] },
      });

      for (const model of activeModels) {
        await this.#db.update({
          tableName: TABLE_TRAINED_MODELS,
          keys: { id: model.id as string },
          data: { isActive: 0, updatedAt: new Date() },
        });
      }

      // Activate the specified model
      await this.#db.update({
        tableName: TABLE_TRAINED_MODELS,
        keys: { id: modelId },
        data: { isActive: 1, updatedAt: new Date() },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'SET_ACTIVE_MODEL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId, modelId },
        },
        error,
      );
    }
  }

  async deleteTrainedModel(id: string): Promise<void> {
    try {
      await this.#db.delete({
        tableName: TABLE_TRAINED_MODELS,
        keys: { id },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_TRAINED_MODEL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { modelId: id },
        },
        error,
      );
    }
  }
}
