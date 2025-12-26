import {
  TrainerStorage,
  type TrainingJobRecord,
  type TrainedModelRecord,
  type ListTrainingJobsInput,
  type ListTrainedModelsInput,
} from './base';

/**
 * In-memory implementation of TrainerStorage.
 * Uses standalone maps since it has a separate lifecycle from other domains.
 */
export class TrainerInMemory extends TrainerStorage {
  private jobsMap: Map<string, TrainingJobRecord>;
  private modelsMap: Map<string, TrainedModelRecord>;

  constructor() {
    super();
    this.jobsMap = new Map();
    this.modelsMap = new Map();
  }

  async init(): Promise<void> {
    // No-op for in-memory storage
  }

  private get jobs(): Map<string, TrainingJobRecord> {
    return this.jobsMap;
  }

  private get models(): Map<string, TrainedModelRecord> {
    return this.modelsMap;
  }

  // Training Jobs
  async saveTrainingJob(job: TrainingJobRecord): Promise<TrainingJobRecord> {
    this.jobs.set(job.id, { ...job });
    return job;
  }

  async getTrainingJob(id: string): Promise<TrainingJobRecord | null> {
    return this.jobs.get(id) || null;
  }

  async updateTrainingJob(id: string, updates: Partial<TrainingJobRecord>): Promise<TrainingJobRecord | null> {
    const existing = this.jobs.get(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.jobs.set(id, updated);
    return updated;
  }

  async listTrainingJobs(input?: ListTrainingJobsInput): Promise<{ jobs: TrainingJobRecord[]; total: number }> {
    let jobs = Array.from(this.jobs.values());

    // Apply filters
    if (input?.agentId) {
      jobs = jobs.filter(j => j.agentId === input.agentId);
    }
    if (input?.status) {
      jobs = jobs.filter(j => j.status === input.status);
    }
    if (input?.method) {
      jobs = jobs.filter(j => j.method === input.method);
    }

    // Sort by created date (newest first)
    jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = jobs.length;

    // Apply pagination
    if (input?.offset) {
      jobs = jobs.slice(input.offset);
    }
    if (input?.limit) {
      jobs = jobs.slice(0, input.limit);
    }

    return { jobs, total };
  }

  async deleteTrainingJob(id: string): Promise<void> {
    this.jobs.delete(id);
  }

  // Trained Models
  async saveTrainedModel(model: TrainedModelRecord): Promise<TrainedModelRecord> {
    this.models.set(model.id, { ...model });
    return model;
  }

  async getTrainedModel(id: string): Promise<TrainedModelRecord | null> {
    return this.models.get(id) || null;
  }

  async getActiveModelForAgent(agentId: string): Promise<TrainedModelRecord | null> {
    for (const model of this.models.values()) {
      if (model.agentId === agentId && model.isActive) {
        return model;
      }
    }
    return null;
  }

  async updateTrainedModel(id: string, updates: Partial<TrainedModelRecord>): Promise<TrainedModelRecord | null> {
    const existing = this.models.get(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.models.set(id, updated);
    return updated;
  }

  async listTrainedModels(input?: ListTrainedModelsInput): Promise<{ models: TrainedModelRecord[]; total: number }> {
    let models = Array.from(this.models.values());

    // Apply filters
    if (input?.agentId) {
      models = models.filter(m => m.agentId === input.agentId);
    }
    if (input?.isActive !== undefined) {
      models = models.filter(m => m.isActive === input.isActive);
    }

    // Sort by created date (newest first)
    models.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = models.length;

    // Apply pagination
    if (input?.offset) {
      models = models.slice(input.offset);
    }
    if (input?.limit) {
      models = models.slice(0, input.limit);
    }

    return { models, total };
  }

  async setActiveModel(agentId: string, modelId: string): Promise<void> {
    // Deactivate all models for this agent
    for (const [id, model] of this.models.entries()) {
      if (model.agentId === agentId && model.isActive) {
        this.models.set(id, { ...model, isActive: false, updatedAt: new Date() });
      }
    }

    // Activate the specified model
    const model = this.models.get(modelId);
    if (model) {
      this.models.set(modelId, { ...model, isActive: true, updatedAt: new Date() });
    }
  }

  async deleteTrainedModel(id: string): Promise<void> {
    this.models.delete(id);
  }

  async dangerouslyClearAll(): Promise<void> {
    this.jobsMap.clear();
    this.modelsMap.clear();
  }
}
