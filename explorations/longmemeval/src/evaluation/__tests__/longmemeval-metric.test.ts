import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LongMemEvalMetric, createLongMemEvalMetric } from '../longmemeval-metric';
import { Agent } from '@mastra/core/agent';

// Mock Agent
const mockAgent = {
  generate: vi.fn().mockImplementation(async messages => {
    const content = messages[0].content;

    // Check if it's asking about correct response
    if (content.includes('Is the model response correct?')) {
      // If the model response contains the correct answer, return yes
      if (content.includes('Model Response: Blue') && content.includes('Correct Answer: Blue')) {
        return {
          text: 'yes',
        };
      }
      // If the response doesn't match, return no with reason
      return {
        text: 'no: the model did not provide the correct answer',
      };
    }

    // For abstention questions
    if (content.includes('Does the model correctly identify the question as unanswerable?')) {
      if (content.includes('cannot answer') || content.includes("don't have that information")) {
        return {
          text: 'yes',
        };
      }
      return {
        text: 'no: the model attempted to answer an unanswerable question',
      };
    }

    // Default response
    return {
      text: 'yes',
    };
  }),
} as unknown as Agent;

describe('LongMemEvalMetric', () => {
  describe('measure', () => {
    it('should return score 1 for correct answer', async () => {
      const metric = new LongMemEvalMetric({
        agent: mockAgent,
        questionType: 'single-session-user',
      });

      const input = JSON.stringify({
        question: 'What is my favorite color?',
        answer: 'Blue',
      });
      const output = 'Blue';

      const result = await metric.measure(input, output);

      expect(result.score).toBe(1);
      expect(result.info?.questionType).toBe('single-session-user');
      expect(result.info?.evaluatorResponse).toBe('yes');
    });

    it('should return score 0 for incorrect answer', async () => {
      const metric = new LongMemEvalMetric({
        agent: mockAgent,
        questionType: 'single-session-user',
      });

      const input = JSON.stringify({
        question: 'What is my favorite color?',
        answer: 'Blue',
      });
      const output = 'Red';

      const result = await metric.measure(input, output);

      expect(result.score).toBe(0);
      expect(result.info?.reason).toBe('the model did not provide the correct answer');
    });

    it('should handle abstention questions correctly', async () => {
      const metric = new LongMemEvalMetric({
        agent: mockAgent,
        questionType: 'single-session-user',
        isAbstention: true,
      });

      const input = JSON.stringify({
        question: 'What is my favorite food?',
        answer: 'This question cannot be answered based on the conversation history',
      });
      const output = 'I cannot answer that question based on our conversation history.';

      const result = await metric.measure(input, output);

      expect(result.score).toBe(1);
      expect(result.info?.isAbstention).toBe(true);
    });

    it('should handle different question types', async () => {
      const temporalMetric = createLongMemEvalMetric('temporal-reasoning', mockAgent);
      const knowledgeMetric = createLongMemEvalMetric('knowledge-update', mockAgent);
      const preferenceMetric = createLongMemEvalMetric('single-session-preference', mockAgent);

      // All should be instances of LongMemEvalMetric
      expect(temporalMetric).toBeInstanceOf(LongMemEvalMetric);
      expect(knowledgeMetric).toBeInstanceOf(LongMemEvalMetric);
      expect(preferenceMetric).toBeInstanceOf(LongMemEvalMetric);
    });

    it('should throw error for unknown question type', async () => {
      expect(() => {
        new LongMemEvalMetric({
          agent: mockAgent,
          questionType: 'invalid-type' as any,
        });
      }).not.toThrow(); // Constructor doesn't validate

      // The error would be thrown during measure when getting the prompt
      const metric = new LongMemEvalMetric({
        agent: mockAgent,
        questionType: 'invalid-type' as any,
      });

      const input = JSON.stringify({
        question: 'Test question',
        answer: 'Test answer',
      });

      await expect(metric.measure(input, 'Test output')).rejects.toThrow('Unknown question type: invalid-type');
    });

    it('should parse evaluator response correctly', async () => {
      const metric = new LongMemEvalMetric({
        agent: mockAgent,
        questionType: 'single-session-user',
      });

      const input = JSON.stringify({
        question: 'What is my name?',
        answer: 'John',
      });
      const output = "I don't know your name";

      const result = await metric.measure(input, output);

      expect(result.score).toBe(0);
      expect(result.info?.evaluatorResponse).toContain('no');
      expect(result.info?.reason).toBeTruthy();
    });
  });

  describe('createLongMemEvalMetric', () => {
    it('should create metric with correct configuration', () => {
      const metric = createLongMemEvalMetric('multi-session', mockAgent);

      expect(metric).toBeInstanceOf(LongMemEvalMetric);
    });

    it('should throw error when agent is not provided', () => {
      expect(() => {
        new LongMemEvalMetric({
          questionType: 'single-session-user',
        } as any);
      }).toThrow('Agent instance is required for LongMemEvalMetric');
    });
  });
});
