import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrepareCommand } from '../prepare';
import { rm, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { LongMemEvalQuestion } from '../../data/types';
import { createMockEmbedding } from '../../test-utils/mock-embeddings';

// Mock OpenAI embeddings with fixture embeddings
vi.mock('@ai-sdk/openai', () => ({
  openai: {
    embedding: vi.fn(() => createMockEmbedding()),
  },
}));

// Mock the DatasetLoader
vi.mock('../../data/loader', () => ({
  DatasetLoader: vi.fn().mockImplementation(() => ({
    loadDataset: vi.fn().mockResolvedValue([
      {
        question_id: 'test-q1',
        question_type: 'single-session-user',
        question: 'What is my favorite color?',
        answer: 'Blue',
        question_date: '2024-01-01',
        haystack_session_ids: ['session-1'],
        haystack_dates: ['2024-01-01'],
        haystack_sessions: [
          [
            { role: 'user', content: 'My favorite color is blue', has_answer: true },
            { role: 'assistant', content: 'I understand your favorite color is blue.' },
          ],
        ],
        answer_session_ids: ['session-1'],
      },
      {
        question_id: 'test-q2',
        question_type: 'multi-session',
        question: 'What did I say about my pet?',
        answer: 'You have a cat named Fluffy',
        question_date: '2024-01-02',
        haystack_session_ids: ['session-2', 'session-3'],
        haystack_dates: ['2024-01-01', '2024-01-02'],
        haystack_sessions: [
          [
            { role: 'user', content: 'I have a pet', has_answer: false },
            { role: 'assistant', content: 'What kind of pet do you have?' },
          ],
          [
            { role: 'user', content: 'It is a cat named Fluffy', has_answer: true },
            { role: 'assistant', content: 'Fluffy is a lovely name for a cat!' },
          ],
        ],
        answer_session_ids: ['session-3'],
      },
    ] as LongMemEvalQuestion[]),
  })),
}));

// Mock chalk and ora to avoid console output in tests
vi.mock('chalk', () => ({
  default: {
    blue: (str: string) => str,
    yellow: (str: string) => str,
    green: (str: string) => str,
    gray: (str: string) => str,
  },
}));

vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
  }),
}));

describe('PrepareCommand', () => {
  let command: PrepareCommand;
  let testDir: string;

  beforeEach(() => {
    command = new PrepareCommand();
    testDir = join(tmpdir(), `prepare-test-${Date.now()}`);
    // Override the base directory
    (command as any).baseDir = testDir;
  });

  afterEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true });
    }
  });

  describe('run', () => {
    it('should process questions and save prepared data', async () => {
      await command.run({
        dataset: 'longmemeval_s',
        memoryConfig: 'full-history',
      });

      // Check that directories were created
      const q1Dir = join(testDir, 'longmemeval_s', 'full-history', 'test-q1');
      const q2Dir = join(testDir, 'longmemeval_s', 'full-history', 'test-q2');

      expect(existsSync(q1Dir)).toBe(true);
      expect(existsSync(q2Dir)).toBe(true);

      // Check that files were created
      expect(existsSync(join(q1Dir, 'db.json'))).toBe(true);
      expect(existsSync(join(q1Dir, 'meta.json'))).toBe(true);
      expect(existsSync(join(q2Dir, 'db.json'))).toBe(true);
      expect(existsSync(join(q2Dir, 'meta.json'))).toBe(true);

      // Check metadata content
      const meta1 = JSON.parse(await readFile(join(q1Dir, 'meta.json'), 'utf-8'));
      expect(meta1.questionId).toBe('test-q1');
      expect(meta1.questionType).toBe('single-session-user');
      expect(meta1.question).toBe('What is my favorite color?');
      expect(meta1.answer).toBe('Blue');
      expect(meta1.resourceId).toBe('resource_test-q1');
      expect(meta1.threadIds).toEqual(['session-1']);
      expect(meta1.memoryConfig).toBe('full-history');

      const meta2 = JSON.parse(await readFile(join(q2Dir, 'meta.json'), 'utf-8'));
      expect(meta2.questionId).toBe('test-q2');
      expect(meta2.question).toBe('What did I say about my pet?');
      expect(meta2.answer).toBe('You have a cat named Fluffy');
      expect(meta2.threadIds).toEqual(['session-2', 'session-3']);
    });

    it('should create vector store files for semantic-recall config', async () => {
      await command.run({
        dataset: 'longmemeval_s',
        memoryConfig: 'semantic-recall',
      });

      const q1Dir = join(testDir, 'longmemeval_s', 'semantic-recall', 'test-q1');

      // Should have both db.json and vector.json
      expect(existsSync(join(q1Dir, 'db.json'))).toBe(true);
      expect(existsSync(join(q1Dir, 'vector.json'))).toBe(true);
      expect(existsSync(join(q1Dir, 'meta.json'))).toBe(true);
    });

    it('should process subset of questions when specified', async () => {
      await command.run({
        dataset: 'longmemeval_s',
        memoryConfig: 'last-k',
        subset: 1,
      });

      const q1Dir = join(testDir, 'longmemeval_s', 'last-k', 'test-q1');
      const q2Dir = join(testDir, 'longmemeval_s', 'last-k', 'test-q2');

      // Only first question should be processed
      expect(existsSync(q1Dir)).toBe(true);
      expect(existsSync(q2Dir)).toBe(false);
    });

    it('should use custom output directory when specified', async () => {
      const customDir = join(tmpdir(), `custom-prepare-${Date.now()}`);

      await command.run({
        dataset: 'longmemeval_s',
        memoryConfig: 'working-memory',
        outputDir: customDir,
        subset: 1,
      });

      const questionDir = join(customDir, 'longmemeval_s', 'working-memory', 'test-q1');
      expect(existsSync(questionDir)).toBe(true);

      // Clean up
      await rm(customDir, { recursive: true });
    });

    it('should handle combined memory config with vector store', async () => {
      await command.run({
        dataset: 'longmemeval_s',
        memoryConfig: 'combined',
        subset: 1,
      });

      const q1Dir = join(testDir, 'longmemeval_s', 'combined', 'test-q1');

      // Combined config should have vector store
      expect(existsSync(join(q1Dir, 'db.json'))).toBe(true);
      expect(existsSync(join(q1Dir, 'vector.json'))).toBe(true);
      expect(existsSync(join(q1Dir, 'meta.json'))).toBe(true);
    });
  });

  describe('getMemoryOptions', () => {
    it('should return correct options for each memory config', () => {
      const fullHistory = (command as any).getMemoryOptions('full-history');
      expect(fullHistory.type).toBe('full-history');
      expect(fullHistory.options.lastMessages).toBe(999999);
      expect(fullHistory.options.semanticRecall).toBe(false);

      const lastK = (command as any).getMemoryOptions('last-k');
      expect(lastK.type).toBe('last-k');
      expect(lastK.options.lastMessages).toBe(50);

      const semanticRecall = (command as any).getMemoryOptions('semantic-recall');
      expect(semanticRecall.type).toBe('semantic-recall');
      expect(semanticRecall.options.semanticRecall).toEqual({
        topK: 10,
        messageRange: 2,
        scope: 'resource',
      });

      const workingMemory = (command as any).getMemoryOptions('working-memory');
      expect(workingMemory.type).toBe('working-memory');
      expect(workingMemory.options.workingMemory.enabled).toBe(true);
      expect(workingMemory.options.workingMemory.template).toContain('User Context');

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
