import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Trainer, createTrainer } from '../trainer';
import { createArraySource } from '../dataset';
import type { AgentCase, AgentMessage, TrainerProvider, TrainingJob, StartJobArgs } from '../types';

// Mock Mastra instance
const mockMastra = {
  getStorage: vi.fn(),
  getScorerById: vi.fn(),
};

// Mock agent
const mockAgent = {
  id: 'test-agent',
  name: 'TestAgent',
  generate: vi.fn(),
};

// Mock scorer
const mockScorer = {
  name: 'helpfulness',
  run: vi.fn(),
};

// Mock provider
class MockProvider implements TrainerProvider {
  name = 'mock';
  uploadedFiles: Array<{ content: Uint8Array; filename: string; purpose: string }> = [];
  jobs: Map<string, TrainingJob> = new Map();
  startedJobs: StartJobArgs[] = [];

  async uploadFile(content: Uint8Array, filename: string, purpose: 'fine-tune' | 'batch') {
    this.uploadedFiles.push({ content, filename, purpose });
    return { fileId: `file-${Date.now()}` };
  }

  async startJob(args: StartJobArgs) {
    this.startedJobs.push(args);
    const jobId = `job-${Date.now()}`;
    const job: TrainingJob = {
      id: jobId,
      agentId: 'test-agent',
      agentName: 'TestAgent',
      method: args.method,
      status: 'running',
      baseModel: args.baseModel,
      trainingExamples: 10,
      config: {} as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.jobs.set(jobId, job);
    return { jobId };
  }

  async getJob(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    return job;
  }

  async cancelJob(jobId: string) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'cancelled';
    }
  }

  async listJobs(agentId?: string) {
    return Array.from(this.jobs.values()).filter(j => !agentId || j.agentId === agentId);
  }

  // Helper to simulate job completion
  completeJob(jobId: string, modelId: string) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'succeeded';
      job.fineTunedModelId = modelId;
      job.completedAt = new Date();
    }
  }

  failJob(jobId: string, error: string) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.error = error;
      job.completedAt = new Date();
    }
  }
}

// Test cases
function createTestCases(count: number): AgentCase[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `case-${i}`,
    messages: [{ role: 'user' as const, content: `Test question ${i}` }],
    metadata: { category: i % 2 === 0 ? 'A' : 'B' },
  }));
}

describe('Trainer Integration Tests', () => {
  let trainer: Trainer;
  let provider: MockProvider;

  beforeEach(() => {
    vi.clearAllMocks();

    provider = new MockProvider();

    // Setup mock scorer
    mockScorer.run.mockResolvedValue({ score: 0.8, reason: 'Good response' });
    mockMastra.getScorerById.mockReturnValue(mockScorer);
    mockMastra.getStorage.mockReturnValue(undefined);

    // Setup mock agent
    mockAgent.generate.mockResolvedValue({
      text: 'This is a test response.',
      toolCalls: [],
    });

    trainer = createTrainer({
      mastra: mockMastra as any,
      provider,
    });
  });

  describe('fitAgent', () => {
    it('should run a complete SFT training workflow', async () => {
      const cases = createTestCases(10);

      const result = await trainer.fitAgent(mockAgent as any, {
        method: 'sft',
        data: {
          source: 'dataset',
          cases,
        },
        scoring: {
          composite: {
            helpfulness: 1.0,
          },
        },
        provider: {
          kind: 'openai',
          baseModel: 'gpt-4o-mini-2024-07-18',
        },
      });

      // Verify result
      expect(result.jobId).toBeDefined();
      expect(result.status).toBe('running');

      // Verify file was uploaded
      expect(provider.uploadedFiles).toHaveLength(1);
      expect(provider.uploadedFiles[0]!.filename).toContain('sft-train');
      expect(provider.uploadedFiles[0]!.purpose).toBe('fine-tune');

      // Verify job was started
      expect(provider.startedJobs).toHaveLength(1);
      expect(provider.startedJobs[0]!.method).toBe('sft');
      expect(provider.startedJobs[0]!.baseModel).toBe('gpt-4o-mini-2024-07-18');

      // Verify agent was called for each case
      expect(mockAgent.generate).toHaveBeenCalledTimes(10);

      // Verify scorer was called for each run
      expect(mockScorer.run).toHaveBeenCalledTimes(10);
    });

    it('should filter examples by gate threshold', async () => {
      const cases = createTestCases(10);

      // Make scorer return low scores for some cases
      mockScorer.run
        .mockResolvedValueOnce({ score: 0.2 })
        .mockResolvedValueOnce({ score: 0.3 })
        .mockResolvedValueOnce({ score: 0.9 })
        .mockResolvedValueOnce({ score: 0.8 })
        .mockResolvedValueOnce({ score: 0.1 })
        .mockResolvedValueOnce({ score: 0.95 })
        .mockResolvedValueOnce({ score: 0.85 })
        .mockResolvedValueOnce({ score: 0.4 })
        .mockResolvedValueOnce({ score: 0.7 })
        .mockResolvedValueOnce({ score: 0.6 });

      await trainer.fitAgent(mockAgent as any, {
        method: 'sft',
        data: {
          source: 'dataset',
          cases,
        },
        scoring: {
          composite: { helpfulness: 1.0 },
          gates: [{ scorerId: 'helpfulness', operator: 'gte', threshold: 0.7 }],
        },
        provider: {
          kind: 'openai',
          baseModel: 'gpt-4o-mini-2024-07-18',
        },
      });

      // Verify file was uploaded (only passing examples)
      expect(provider.uploadedFiles).toHaveLength(1);

      // Parse uploaded content to verify filtering
      const content = new TextDecoder().decode(provider.uploadedFiles[0]!.content);
      const lines = content.trim().split('\n');

      // Should only have 5 examples (scores >= 0.7)
      expect(lines.length).toBe(5);
    });

    it('should create validation split with holdout', async () => {
      const cases = createTestCases(100);

      await trainer.fitAgent(mockAgent as any, {
        method: 'sft',
        data: {
          source: 'dataset',
          cases,
        },
        scoring: {
          composite: { helpfulness: 1.0 },
        },
        selection: {
          holdoutRatio: 0.2,
        },
        provider: {
          kind: 'openai',
          baseModel: 'gpt-4o-mini-2024-07-18',
        },
      });

      // Should have uploaded training and validation files
      expect(provider.uploadedFiles).toHaveLength(2);

      const trainingFile = provider.uploadedFiles.find(f => f.filename.includes('train'));
      const validationFile = provider.uploadedFiles.find(f => f.filename.includes('val'));

      expect(trainingFile).toBeDefined();
      expect(validationFile).toBeDefined();

      // Parse and check split
      const trainingContent = new TextDecoder().decode(trainingFile!.content);
      const validationContent = new TextDecoder().decode(validationFile!.content);

      const trainingLines = trainingContent.trim().split('\n');
      const validationLines = validationContent.trim().split('\n');

      // Approximately 80/20 split
      expect(trainingLines.length).toBeGreaterThan(70);
      expect(validationLines.length).toBeGreaterThan(10);
    });

    it('should handle empty dataset', async () => {
      await expect(
        trainer.fitAgent(mockAgent as any, {
          method: 'sft',
          data: {
            source: 'dataset',
            cases: [],
          },
          scoring: {
            composite: { helpfulness: 1.0 },
          },
          provider: {
            kind: 'openai',
            baseModel: 'gpt-4o-mini-2024-07-18',
          },
        }),
      ).rejects.toThrow('No training cases found');
    });

    it('should handle all examples failing gates', async () => {
      const cases = createTestCases(5);

      // All low scores
      mockScorer.run.mockResolvedValue({ score: 0.1 });

      await expect(
        trainer.fitAgent(mockAgent as any, {
          method: 'sft',
          data: {
            source: 'dataset',
            cases,
          },
          scoring: {
            composite: { helpfulness: 1.0 },
            gates: [{ scorerId: 'helpfulness', operator: 'gte', threshold: 0.9 }],
          },
          provider: {
            kind: 'openai',
            baseModel: 'gpt-4o-mini-2024-07-18',
          },
        }),
      ).rejects.toThrow('No examples passed selection criteria');
    });
  });

  describe('getJob', () => {
    it('should retrieve job status', async () => {
      // Start a job
      const cases = createTestCases(5);
      const result = await trainer.fitAgent(mockAgent as any, {
        method: 'sft',
        data: { source: 'dataset', cases },
        scoring: { composite: { helpfulness: 1.0 } },
        provider: { kind: 'openai', baseModel: 'gpt-4o-mini-2024-07-18' },
      });

      // Get job
      const job = await trainer.getJob(result.jobId);
      expect(job.id).toBe(result.jobId);
      expect(job.status).toBe('running');
    });
  });

  describe('listJobs', () => {
    it('should list jobs for an agent', async () => {
      // Start multiple jobs
      const cases = createTestCases(5);

      await trainer.fitAgent(mockAgent as any, {
        method: 'sft',
        data: { source: 'dataset', cases },
        scoring: { composite: { helpfulness: 1.0 } },
        provider: { kind: 'openai', baseModel: 'gpt-4o-mini-2024-07-18' },
      });

      await trainer.fitAgent(mockAgent as any, {
        method: 'sft',
        data: { source: 'dataset', cases },
        scoring: { composite: { helpfulness: 1.0 } },
        provider: { kind: 'openai', baseModel: 'gpt-4o-mini-2024-07-18' },
      });

      const jobs = await trainer.listJobs('test-agent');
      expect(jobs.length).toBe(2);
    });
  });

  describe('cancelJob', () => {
    it('should cancel a running job', async () => {
      const cases = createTestCases(5);
      const result = await trainer.fitAgent(mockAgent as any, {
        method: 'sft',
        data: { source: 'dataset', cases },
        scoring: { composite: { helpfulness: 1.0 } },
        provider: { kind: 'openai', baseModel: 'gpt-4o-mini-2024-07-18' },
      });

      await trainer.cancelJob(result.jobId);

      const job = await trainer.getJob(result.jobId);
      expect(job.status).toBe('cancelled');
    });
  });

  describe('waitForJob', () => {
    it('should wait for job completion', async () => {
      const cases = createTestCases(5);
      const result = await trainer.fitAgent(mockAgent as any, {
        method: 'sft',
        data: { source: 'dataset', cases },
        scoring: { composite: { helpfulness: 1.0 } },
        provider: { kind: 'openai', baseModel: 'gpt-4o-mini-2024-07-18' },
      });

      // Simulate job completion after a short delay
      setTimeout(() => {
        provider.completeJob(result.jobId, 'ft:gpt-4o-mini:mastra:12345');
      }, 100);

      const progressUpdates: TrainingJob[] = [];
      const finalJob = await trainer.waitForJob(result.jobId, job => {
        progressUpdates.push(job);
      });

      expect(finalJob.status).toBe('succeeded');
      expect(finalJob.fineTunedModelId).toBe('ft:gpt-4o-mini:mastra:12345');
      expect(progressUpdates.length).toBeGreaterThan(0);
    });
  });
});

describe('Dataset Sources', () => {
  describe('ArraySource', () => {
    it('should yield all cases from array', async () => {
      const cases = createTestCases(10);
      const source = createArraySource(cases);
      const result = await source.getCases();

      expect(result).toHaveLength(10);
      expect(result[0]!.id).toBe('case-0');
    });
  });
});
