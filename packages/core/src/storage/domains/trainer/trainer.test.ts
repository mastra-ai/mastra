import { describe, it, expect, beforeEach } from 'vitest';
import { TrainerInMemory } from './inmemory';
import type { TrainingJobRecord, TrainedModelRecord } from './base';

describe('TrainerStorage', () => {
  let storage: TrainerInMemory;

  beforeEach(async () => {
    storage = new TrainerInMemory();
    await storage.init();
  });

  describe('Training Jobs', () => {
    const createTestJob = (overrides?: Partial<TrainingJobRecord>): TrainingJobRecord => ({
      id: 'job-1',
      agentId: 'agent-1',
      agentName: 'TestAgent',
      method: 'sft',
      status: 'pending',
      baseModel: 'gpt-4o-mini-2024-07-18',
      trainingExamples: 100,
      config: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

    it('should save and retrieve a training job', async () => {
      const job = createTestJob();
      await storage.saveTrainingJob(job);

      const retrieved = await storage.getTrainingJob('job-1');
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe('job-1');
      expect(retrieved!.agentId).toBe('agent-1');
      expect(retrieved!.method).toBe('sft');
    });

    it('should return null for non-existent job', async () => {
      const job = await storage.getTrainingJob('non-existent');
      expect(job).toBeNull();
    });

    it('should update a training job', async () => {
      const job = createTestJob();
      await storage.saveTrainingJob(job);

      const updated = await storage.updateTrainingJob('job-1', {
        status: 'running',
        startedAt: new Date(),
      });

      expect(updated).toBeDefined();
      expect(updated!.status).toBe('running');
      expect(updated!.startedAt).toBeDefined();
    });

    it('should return null when updating non-existent job', async () => {
      const result = await storage.updateTrainingJob('non-existent', { status: 'running' });
      expect(result).toBeNull();
    });

    it('should list training jobs with pagination', async () => {
      // Create multiple jobs
      for (let i = 1; i <= 10; i++) {
        await storage.saveTrainingJob(
          createTestJob({
            id: `job-${i}`,
            createdAt: new Date(Date.now() - i * 1000),
          }),
        );
      }

      const { jobs, total } = await storage.listTrainingJobs({ limit: 5 });
      expect(jobs).toHaveLength(5);
      expect(total).toBe(10);
    });

    it('should filter jobs by agentId', async () => {
      await storage.saveTrainingJob(createTestJob({ id: 'job-1', agentId: 'agent-1' }));
      await storage.saveTrainingJob(createTestJob({ id: 'job-2', agentId: 'agent-2' }));
      await storage.saveTrainingJob(createTestJob({ id: 'job-3', agentId: 'agent-1' }));

      const { jobs } = await storage.listTrainingJobs({ agentId: 'agent-1' });
      expect(jobs).toHaveLength(2);
      expect(jobs.every(j => j.agentId === 'agent-1')).toBe(true);
    });

    it('should filter jobs by status', async () => {
      await storage.saveTrainingJob(createTestJob({ id: 'job-1', status: 'pending' }));
      await storage.saveTrainingJob(createTestJob({ id: 'job-2', status: 'running' }));
      await storage.saveTrainingJob(createTestJob({ id: 'job-3', status: 'succeeded' }));

      const { jobs } = await storage.listTrainingJobs({ status: 'running' });
      expect(jobs).toHaveLength(1);
      expect(jobs[0]!.status).toBe('running');
    });

    it('should filter jobs by method', async () => {
      await storage.saveTrainingJob(createTestJob({ id: 'job-1', method: 'sft' }));
      await storage.saveTrainingJob(createTestJob({ id: 'job-2', method: 'dpo' }));
      await storage.saveTrainingJob(createTestJob({ id: 'job-3', method: 'sft' }));

      const { jobs } = await storage.listTrainingJobs({ method: 'dpo' });
      expect(jobs).toHaveLength(1);
      expect(jobs[0]!.method).toBe('dpo');
    });

    it('should delete a training job', async () => {
      await storage.saveTrainingJob(createTestJob());
      await storage.deleteTrainingJob('job-1');

      const job = await storage.getTrainingJob('job-1');
      expect(job).toBeNull();
    });
  });

  describe('Trained Models', () => {
    const createTestModel = (overrides?: Partial<TrainedModelRecord>): TrainedModelRecord => ({
      id: 'model-1',
      agentId: 'agent-1',
      agentName: 'TestAgent',
      modelId: 'ft:gpt-4o-mini:org:12345',
      baseModel: 'gpt-4o-mini-2024-07-18',
      trainingJobId: 'job-1',
      method: 'sft',
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

    it('should save and retrieve a trained model', async () => {
      const model = createTestModel();
      await storage.saveTrainedModel(model);

      const retrieved = await storage.getTrainedModel('model-1');
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe('model-1');
      expect(retrieved!.modelId).toBe('ft:gpt-4o-mini:org:12345');
    });

    it('should return null for non-existent model', async () => {
      const model = await storage.getTrainedModel('non-existent');
      expect(model).toBeNull();
    });

    it('should update a trained model', async () => {
      const model = createTestModel();
      await storage.saveTrainedModel(model);

      const updated = await storage.updateTrainedModel('model-1', {
        isActive: true,
      });

      expect(updated).toBeDefined();
      expect(updated!.isActive).toBe(true);
    });

    it('should list trained models with pagination', async () => {
      for (let i = 1; i <= 10; i++) {
        await storage.saveTrainedModel(
          createTestModel({
            id: `model-${i}`,
            modelId: `ft:gpt-4o-mini:org:${i}`,
            createdAt: new Date(Date.now() - i * 1000),
          }),
        );
      }

      const { models, total } = await storage.listTrainedModels({ limit: 5 });
      expect(models).toHaveLength(5);
      expect(total).toBe(10);
    });

    it('should filter models by agentId', async () => {
      await storage.saveTrainedModel(createTestModel({ id: 'model-1', agentId: 'agent-1' }));
      await storage.saveTrainedModel(createTestModel({ id: 'model-2', agentId: 'agent-2' }));
      await storage.saveTrainedModel(createTestModel({ id: 'model-3', agentId: 'agent-1' }));

      const { models } = await storage.listTrainedModels({ agentId: 'agent-1' });
      expect(models).toHaveLength(2);
      expect(models.every(m => m.agentId === 'agent-1')).toBe(true);
    });

    it('should filter models by isActive', async () => {
      await storage.saveTrainedModel(createTestModel({ id: 'model-1', isActive: false }));
      await storage.saveTrainedModel(createTestModel({ id: 'model-2', isActive: true }));
      await storage.saveTrainedModel(createTestModel({ id: 'model-3', isActive: false }));

      const { models } = await storage.listTrainedModels({ isActive: true });
      expect(models).toHaveLength(1);
      expect(models[0]!.isActive).toBe(true);
    });

    it('should get active model for agent', async () => {
      await storage.saveTrainedModel(createTestModel({ id: 'model-1', isActive: false }));
      await storage.saveTrainedModel(createTestModel({ id: 'model-2', isActive: true }));

      const active = await storage.getActiveModelForAgent('agent-1');
      expect(active).toBeDefined();
      expect(active!.id).toBe('model-2');
      expect(active!.isActive).toBe(true);
    });

    it('should return null when no active model exists', async () => {
      await storage.saveTrainedModel(createTestModel({ id: 'model-1', isActive: false }));

      const active = await storage.getActiveModelForAgent('agent-1');
      expect(active).toBeNull();
    });

    it('should set active model and deactivate others', async () => {
      await storage.saveTrainedModel(createTestModel({ id: 'model-1', isActive: true }));
      await storage.saveTrainedModel(createTestModel({ id: 'model-2', isActive: false }));

      await storage.setActiveModel('agent-1', 'model-2');

      const model1 = await storage.getTrainedModel('model-1');
      const model2 = await storage.getTrainedModel('model-2');

      expect(model1!.isActive).toBe(false);
      expect(model2!.isActive).toBe(true);
    });

    it('should only deactivate models for same agent', async () => {
      await storage.saveTrainedModel(createTestModel({ id: 'model-1', agentId: 'agent-1', isActive: true }));
      await storage.saveTrainedModel(createTestModel({ id: 'model-2', agentId: 'agent-1', isActive: false }));
      await storage.saveTrainedModel(createTestModel({ id: 'model-3', agentId: 'agent-2', isActive: true }));

      await storage.setActiveModel('agent-1', 'model-2');

      const model1 = await storage.getTrainedModel('model-1');
      const model2 = await storage.getTrainedModel('model-2');
      const model3 = await storage.getTrainedModel('model-3');

      expect(model1!.isActive).toBe(false);
      expect(model2!.isActive).toBe(true);
      expect(model3!.isActive).toBe(true); // Should remain active (different agent)
    });

    it('should delete a trained model', async () => {
      await storage.saveTrainedModel(createTestModel());
      await storage.deleteTrainedModel('model-1');

      const model = await storage.getTrainedModel('model-1');
      expect(model).toBeNull();
    });
  });

  describe('Clear All', () => {
    it('should clear all data', async () => {
      await storage.saveTrainingJob({
        id: 'job-1',
        agentId: 'agent-1',
        agentName: 'TestAgent',
        method: 'sft',
        status: 'pending',
        baseModel: 'gpt-4o-mini-2024-07-18',
        trainingExamples: 100,
        config: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await storage.saveTrainedModel({
        id: 'model-1',
        agentId: 'agent-1',
        agentName: 'TestAgent',
        modelId: 'ft:gpt-4o-mini:org:12345',
        baseModel: 'gpt-4o-mini-2024-07-18',
        trainingJobId: 'job-1',
        method: 'sft',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await storage.dangerouslyClearAll();

      const { jobs } = await storage.listTrainingJobs();
      const { models } = await storage.listTrainedModels();

      expect(jobs).toHaveLength(0);
      expect(models).toHaveLength(0);
    });
  });
});
