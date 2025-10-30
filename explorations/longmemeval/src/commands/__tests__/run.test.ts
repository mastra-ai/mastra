import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RunCommand } from '../run';
import { rm, mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createMockEmbedding } from '../../test-utils/mock-embeddings';

// Mock OpenAI using vi.hoisted to avoid initialization issues
const { openaiModel } = vi.hoisted(() => {
  const openaiModel = vi.fn((modelName: string) => ({
    doGenerate: vi.fn().mockResolvedValue({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 20 },
      text: 'Blue',
    }),
  }));

  // Add embedding as a property using fixture embeddings
  openaiModel.embedding = vi.fn(() => createMockEmbedding());

  return { openaiModel };
});

vi.mock('@ai-sdk/openai', () => ({
  openai: openaiModel,
}));

// Mock the LongMemEvalMetric
vi.mock('../../evaluation/longmemeval-metric', () => ({
  LongMemEvalMetric: vi.fn().mockImplementation(() => ({
    measure: vi.fn().mockResolvedValue({ score: 1 }), // Always returns correct
  })),
}));

// Mock chalk and ora
vi.mock('chalk', () => ({
  default: {
    blue: (str: string) => str,
    yellow: (str: string) => str,
    green: (str: string) => str,
    gray: (str: string) => str,
    red: (str: string) => str,
    bold: (str: string) => str,
  },
}));

vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: '',
  }),
}));

describe('RunCommand', () => {
  let command: RunCommand;
  let testDir: string;
  let preparedDataDir: string;
  let outputDir: string;

  beforeEach(async () => {
    command = new RunCommand();
    testDir = join(tmpdir(), `run-test-${Date.now()}`);
    preparedDataDir = join(testDir, 'prepared-data');
    outputDir = join(testDir, 'results');

    // Override the directories
    (command as any).preparedDataDir = preparedDataDir;
    (command as any).outputDir = outputDir;

    // Create prepared test data
    await createPreparedData(preparedDataDir);
  });

  afterEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true });
    }
  });

  async function createPreparedData(baseDir: string) {
    // Create directory structure
    const dataDir = join(baseDir, 'longmemeval_s', 'full-history');
    await mkdir(dataDir, { recursive: true });

    // Question 1
    const q1Dir = join(dataDir, 'test-q1');
    await mkdir(q1Dir, { recursive: true });

    await writeFile(
      join(q1Dir, 'meta.json'),
      JSON.stringify({
        questionId: 'test-q1',
        questionType: 'single-session-user',
        resourceId: 'resource_test-q1',
        threadIds: ['session-1'],
        memoryConfig: 'full-history',
        question: 'What is my favorite color?',
        answer: 'Blue',
      }),
    );

    await writeFile(
      join(q1Dir, 'db.json'),
      JSON.stringify({
        mastra_messages: [
          [
            'msg-1',
            {
              id: 'msg-1',
              threadId: 'session-1',
              resourceId: 'resource_test-q1',
              role: 'user',
              content: 'My favorite color is blue',
              createdAt: new Date().toISOString(),
              type: 'text',
            },
          ],
          [
            'msg-2',
            {
              id: 'msg-2',
              threadId: 'session-1',
              resourceId: 'resource_test-q1',
              role: 'assistant',
              content: 'I understand your favorite color is blue.',
              createdAt: new Date().toISOString(),
              type: 'text',
            },
          ],
        ],
        mastra_threads: [
          [
            'session-1',
            {
              id: 'session-1',
              resourceId: 'resource_test-q1',
              title: 'Session 1',
              metadata: {},
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        ],
        mastra_resources: [],
        mastra_workflow_snapshot: [],
        mastra_traces: [],
      }),
    );

    // Question 2
    const q2Dir = join(dataDir, 'test-q2');
    await mkdir(q2Dir, { recursive: true });

    await writeFile(
      join(q2Dir, 'meta.json'),
      JSON.stringify({
        questionId: 'test-q2',
        questionType: 'multi-session',
        resourceId: 'resource_test-q2',
        threadIds: ['session-2', 'session-3'],
        memoryConfig: 'full-history',
        question: 'What did I say about my pet?',
        answer: 'You have a cat named Fluffy',
      }),
    );

    await writeFile(
      join(q2Dir, 'db.json'),
      JSON.stringify({
        mastra_messages: [
          [
            'msg-1',
            {
              id: 'msg-1',
              threadId: 'session-2',
              resourceId: 'resource_test-q2',
              role: 'user',
              content: 'I have a pet',
              createdAt: new Date().toISOString(),
              type: 'text',
            },
          ],
          [
            'msg-2',
            {
              id: 'msg-2',
              threadId: 'session-3',
              resourceId: 'resource_test-q2',
              role: 'user',
              content: 'It is a cat named Fluffy',
              createdAt: new Date().toISOString(),
              type: 'text',
            },
          ],
        ],
        mastra_threads: [
          [
            'session-2',
            {
              id: 'session-2',
              resourceId: 'resource_test-q2',
              title: 'Session 2',
              metadata: {},
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
          [
            'session-3',
            {
              id: 'session-3',
              resourceId: 'resource_test-q2',
              title: 'Session 3',
              metadata: {},
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        ],
        mastra_resources: [],
        mastra_workflow_snapshot: [],
        mastra_traces: [],
      }),
    );
  }

  describe('run', () => {
    it('should evaluate questions from prepared data', async () => {
      const metrics = await command.run({
        dataset: 'longmemeval_s',
        memoryConfig: 'full-history',
        model: 'gpt-4o',
        preparedDataDir,
        outputDir,
      });

      expect(metrics.total_questions).toBe(2);
      expect(metrics.correct_answers).toBe(2);
      expect(metrics.overall_accuracy).toBe(1.0);

      // Check output files
      const runDirs = await Promise.resolve().then(() =>
        existsSync(outputDir) ? require('fs/promises').readdir(outputDir) : [],
      );
      expect(runDirs.length).toBeGreaterThan(0);

      const runDir = join(outputDir, runDirs[0]);
      expect(existsSync(join(runDir, 'results.jsonl'))).toBe(true);
      expect(existsSync(join(runDir, 'metrics.json'))).toBe(true);
    });

    it('should process subset of questions when specified', async () => {
      const metrics = await command.run({
        dataset: 'longmemeval_s',
        memoryConfig: 'full-history',
        model: 'gpt-4o',
        preparedDataDir,
        outputDir,
        subset: 1,
      });

      expect(metrics.total_questions).toBe(1);
    });

    it('should handle semantic-recall memory config with vector store', async () => {
      // Create semantic-recall prepared data
      const semanticDir = join(preparedDataDir, 'longmemeval_s', 'semantic-recall');
      await mkdir(semanticDir, { recursive: true });

      const q1Dir = join(semanticDir, 'test-q1');
      await mkdir(q1Dir, { recursive: true });

      await writeFile(
        join(q1Dir, 'meta.json'),
        JSON.stringify({
          questionId: 'test-q1',
          questionType: 'single-session-user',
          resourceId: 'resource_test-q1',
          threadIds: ['session-1'],
          memoryConfig: 'semantic-recall',
          question: 'What is my favorite color?',
          answer: 'Blue',
        }),
      );

      await writeFile(
        join(q1Dir, 'db.json'),
        JSON.stringify({
          mastra_messages: [
            [
              'msg-1',
              {
                id: 'msg-1',
                threadId: 'session-1',
                resourceId: 'resource_test-q1',
                role: 'user',
                content: 'My favorite color is blue',
                createdAt: new Date().toISOString(),
                type: 'text',
              },
            ],
          ],
          mastra_threads: [
            [
              'session-1',
              {
                id: 'session-1',
                resourceId: 'resource_test-q1',
                title: 'Session 1',
                metadata: {},
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          ],
          mastra_resources: [],
          mastra_workflow_snapshot: [],
          mastra_traces: [],
        }),
      );

      // Add vector store data in the correct format
      await writeFile(
        join(q1Dir, 'vector.json'),
        JSON.stringify({
          messages: {
            config: {
              dimension: 1536,
              metric: 'cosine',
            },
            documents: [
              {
                id: 'msg-1',
                vector: new Array(1536).fill(0).map(() => Math.random()),
                metadata: {
                  threadId: 'session-1',
                  resourceId: 'resource_test-q1',
                  content: 'My favorite color is blue',
                },
              },
            ],
          },
        }),
      );

      const metrics = await command.run({
        dataset: 'longmemeval_s',
        memoryConfig: 'semantic-recall',
        model: 'gpt-4o',
        preparedDataDir,
        outputDir,
        subset: 1,
      });

      expect(metrics.total_questions).toBe(1);
    });

    it('should throw error if prepared data does not exist', async () => {
      await expect(
        command.run({
          dataset: 'longmemeval_s',
          memoryConfig: 'working-memory',
          model: 'gpt-4o',
          preparedDataDir,
          outputDir,
        }),
      ).rejects.toThrow(/Prepared data not found/);
    });
  });

  describe('getMemoryOptions', () => {
    it('should return correct options for each memory config', () => {
      const fullHistory = (command as any).getMemoryOptions('full-history');
      expect(fullHistory.type).toBe('full-history');
      expect(fullHistory.options.lastMessages).toBe(999999);

      const semanticRecall = (command as any).getMemoryOptions('semantic-recall');
      expect(semanticRecall.type).toBe('semantic-recall');
      expect(semanticRecall.options.semanticRecall.scope).toBe('resource');

      const workingMemory = (command as any).getMemoryOptions('working-memory');
      expect(workingMemory.type).toBe('working-memory');
      expect(workingMemory.options.workingMemory.enabled).toBe(true);

      const combined = (command as any).getMemoryOptions('combined');
      expect(combined.type).toBe('combined');
      expect(combined.options.semanticRecall).toBeTruthy();
      expect(combined.options.workingMemory.enabled).toBe(true);
    });

    it('should throw error for unknown memory config', () => {
      expect(() => (command as any).getMemoryOptions('invalid')).toThrow('Unknown memory config: invalid');
    });
  });
});
