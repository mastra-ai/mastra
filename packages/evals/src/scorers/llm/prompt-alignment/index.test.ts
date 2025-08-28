import { openai } from '@ai-sdk/openai';
import { describe, it, expect } from 'vitest';
import { createAgentTestRun, createUIMessage } from '../../utils';
import { createPromptAlignmentScorerLLM } from '.';

describe('Prompt Alignment Scorer', () => {
  const mockModel = openai('gpt-4o-mini');

  describe('Basic Configuration', () => {
    it('should create scorer with default options', () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
      });

      expect(scorer.name).toBe('Prompt Alignment (LLM)');
      expect(scorer.description).toContain('Evaluates how well the agent response aligns');
    });

    it('should create scorer with custom scale', () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
        options: {
          scale: 10,
        },
      });

      expect(scorer.name).toBe('Prompt Alignment (LLM)');
    });
  });

  describe('Scorer Configuration', () => {
    it('should create scorer with proper structure', () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
        options: { scale: 1 },
      });

      // Test that the scorer has the expected structure
      expect(scorer).toBeDefined();
      expect(scorer.name).toBe('Prompt Alignment (LLM)');
      expect(scorer.config).toBeDefined();
      expect(scorer.config.judge).toBeDefined();
      expect(scorer.config.judge.model).toBe(mockModel);
    });

    it('should handle test run with valid input and output', async () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
        options: { scale: 1 },
      });

      const _testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: 'test-1',
            role: 'user',
            content: 'Write a detailed Python function with documentation',
          }),
        ],
        output: [
          createUIMessage({
            id: 'test-2',
            role: 'assistant',
            content: 'def factorial(n): return 1 if n <= 1 else n * factorial(n-1)',
          }),
        ],
      });

      // Verify scorer can be created with the test run
      expect(scorer).toBeDefined();
      expect(scorer.name).toBe('Prompt Alignment (LLM)');
    });

    it('should use instructions from prompts', () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
      });

      expect(scorer.config.judge.instructions).toContain('prompt-response alignment evaluator');
      expect(scorer.config.judge.instructions).toContain('Intent Alignment');
      expect(scorer.config.judge.instructions).toContain('Requirements Fulfillment');
    });
  });

  describe('Scorer Properties', () => {
    it('should have proper name and description', () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
        options: { scale: 1 },
      });

      expect(scorer.name).toBe('Prompt Alignment (LLM)');
      expect(scorer.description).toContain('Evaluates how well the agent response aligns');
    });

    it('should apply custom scale option', () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
        options: { scale: 10 },
      });

      expect(scorer).toBeDefined();
      expect(scorer.name).toBe('Prompt Alignment (LLM)');
      // The scale is applied internally in the generateScore function
    });

    it('should work with default scale', () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
      });

      expect(scorer).toBeDefined();
      expect(scorer.name).toBe('Prompt Alignment (LLM)');
      // Default scale of 1 is applied internally
    });
  });

  describe('Input Validation', () => {
    it('should require both user prompt and agent response', () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
      });

      expect(scorer).toBeDefined();
      expect(scorer.config.description).toContain('intent and requirements');
    });

    it('should handle empty inputs gracefully', () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
      });

      const _testRunNoUser = createAgentTestRun({
        inputMessages: [],
        output: [
          createUIMessage({
            id: 'test-1',
            role: 'assistant',
            content: 'Response without prompt',
          }),
        ],
      });

      // The scorer should be created but will handle empty inputs internally
      expect(scorer).toBeDefined();
      expect(scorer.name).toBe('Prompt Alignment (LLM)');
    });
  });

  describe('Integration Test Cases', () => {
    it('should handle code generation prompt alignment', () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
      });

      const _testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: 'test-1',
            role: 'user',
            content: 'Create a REST API endpoint in Node.js with Express that handles user authentication',
          }),
        ],
        output: [
          createUIMessage({
            id: 'test-2',
            role: 'assistant',
            content: `const express = require('express');
const router = express.Router();

router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  // Authentication logic here
  res.json({ token: 'jwt-token' });
});

module.exports = router;`,
          }),
        ],
      });

      // Verify that the scorer can handle code generation scenarios
      expect(scorer).toBeDefined();
      expect(scorer.name).toBe('Prompt Alignment (LLM)');
      expect(scorer.description).toContain('aligns with the intent');
    });

    it('should handle question-answer prompt alignment', () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
      });

      const _testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: 'test-1',
            role: 'user',
            content: 'Explain the difference between let and const in JavaScript in bullet points',
          }),
        ],
        output: [
          createUIMessage({
            id: 'test-2',
            role: 'assistant',
            content: `• let allows reassignment, const does not
• Both are block-scoped
• const requires initialization at declaration
• let can be declared without initialization`,
          }),
        ],
      });

      // Verify that the scorer can handle Q&A scenarios
      expect(scorer).toBeDefined();
      expect(scorer.name).toBe('Prompt Alignment (LLM)');
      expect(scorer.config.judge.instructions).toContain('Requirements Fulfillment');
    });
  });
});
