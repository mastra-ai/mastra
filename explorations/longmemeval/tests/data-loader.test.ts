import { describe, it, expect, beforeAll } from 'vitest';
import { DatasetLoader } from '../src/data/loader';
import type { LongMemEvalQuestion } from '../src/data/types';
import { join } from 'path';

describe('DatasetLoader', () => {
  let loader: DatasetLoader;
  let testLoader: DatasetLoader;

  beforeAll(() => {
    loader = new DatasetLoader();
    // Create a test loader that points to our fixtures directory
    testLoader = new DatasetLoader(join(process.cwd(), 'src', '__fixtures__'));
  });

  describe('validateDataset', () => {
    it('should validate correct dataset structure', () => {
      const validData: LongMemEvalQuestion[] = [
        {
          question_id: 'test_001',
          question_type: 'single-session-user',
          question: 'What is my favorite color?',
          answer: 'Blue',
          question_date: '2024-01-01',
          haystack_session_ids: ['session_1'],
          haystack_dates: ['2024-01-01'],
          haystack_sessions: [
            [
              { role: 'user', content: 'My favorite color is blue.' },
              { role: 'assistant', content: 'I understand your favorite color is blue.' },
            ],
          ],
          answer_session_ids: ['session_1'],
        },
      ];

      // Should not throw
      expect(() => {
        // Access private method through any type
        (loader as any).validateDataset(validData);
      }).not.toThrow();
    });

    it('should throw on invalid dataset structure', () => {
      const invalidData = [
        {
          question_id: 'test_001',
          // Missing required fields
        },
      ];

      expect(() => {
        (loader as any).validateDataset(invalidData);
      }).toThrow('Missing required field');
    });
  });

  describe('loadDataset', () => {
    it('should load and validate test dataset fixture', async () => {
      // Use the test-dataset from fixtures
      const questions = await testLoader.loadDataset('test-dataset' as any);

      expect(questions).toHaveLength(3);
      expect(questions[0].question_id).toBe('test-001');
      expect(questions[0].question_type).toBe('single-session-user');
      expect(questions[1].question_type).toBe('multi-session');

      // Verify the dataset structure
      expect(questions[0].haystack_sessions).toHaveLength(1);
      expect(questions[1].haystack_sessions).toHaveLength(2);

      // Check answers
      expect(questions[0].answer).toBe('Blue');
      expect(questions[1].answer).toBe('A golden retriever named Max');
    });

    it('should throw helpful error when dataset file not found', async () => {
      // Use the regular loader which points to the data directory
      await expect(loader.loadDataset('non-existent-dataset' as any)).rejects.toThrow('Dataset file not found');
    });
  });

  describe('getDatasetStats', () => {
    it('should calculate stats for test dataset', async () => {
      const stats = await testLoader.getDatasetStats('test-dataset' as any);

      expect(stats.totalQuestions).toBe(3);
      expect(stats.questionsByType['single-session-user']).toBe(2);
      expect(stats.questionsByType['multi-session']).toBe(1);
      expect(stats.avgSessionsPerQuestion).toBeCloseTo(1.33, 2);
      expect(stats.avgTurnsPerSession).toBe(2);
      expect(stats.totalTokensEstimate).toBeGreaterThan(0);
      expect(stats.abstentionQuestions).toBe(0); // None of our test questions are abstention questions
    });
  });
});
