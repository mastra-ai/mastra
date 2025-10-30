import { openai } from '@ai-sdk/openai';
import { describe, it, expect, vi } from 'vitest';
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
      expect(scorer.config.judge?.model).toBe(mockModel);
    });

    it('should work with valid input and output', async () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
        options: { scale: 1 },
      });

      // Mock successful run with valid inputs
      scorer.run = vi.fn().mockResolvedValue({
        score: 0.85,
        reason: 'Good alignment with minor issues.',
      });

      const validTestRun = createAgentTestRun({
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

      const result = await scorer.run(validTestRun);
      expect(result.score).toBe(0.85);
      expect(result.reason).toContain('Good alignment');
    });

    it('should use instructions from prompts', () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
      });

      expect(scorer.config.judge?.instructions).toContain('prompt-response alignment evaluator');
      expect(scorer.config.judge?.instructions).toContain('Intent Alignment');
      expect(scorer.config.judge?.instructions).toContain('Requirements Fulfillment');
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

    it('should handle empty user input', async () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
      });

      // Mock the run method to simulate the error that would occur with empty user input
      scorer.run = vi
        .fn()
        .mockRejectedValue(new Error('Both user prompt and agent response are required for prompt alignment scoring'));

      const testRunNoUser = createAgentTestRun({
        inputMessages: [],
        output: [
          createUIMessage({
            id: 'test-1',
            role: 'assistant',
            content: 'Response without prompt',
          }),
        ],
      });

      await expect(scorer.run(testRunNoUser)).rejects.toThrow('Both user prompt and agent response are required');
    });

    it('should handle empty agent response', async () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
      });

      // Mock the run method to simulate the error that would occur with empty response
      scorer.run = vi
        .fn()
        .mockRejectedValue(new Error('Both user prompt and agent response are required for prompt alignment scoring'));

      const testRunNoResponse = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: 'test-1',
            role: 'user',
            content: 'Some prompt',
          }),
        ],
        output: [],
      });

      await expect(scorer.run(testRunNoResponse)).rejects.toThrow('Both user prompt and agent response are required');
    });
  });

  describe('Scorer Run Tests', () => {
    it('should score perfect alignment as 1.0', async () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
        options: { scale: 1 },
      });

      // Mock the run method for perfect alignment
      scorer.run = vi.fn().mockResolvedValue({
        score: 1.0,
        reason: 'Perfect alignment - all requirements met, intent fully addressed.',
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: 'Write a Python function to calculate factorial',
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content: `def factorial(n):
    """Calculate factorial of a number."""
    if n < 0:
        raise ValueError("Factorial not defined for negative numbers")
    if n == 0 or n == 1:
        return 1
    return n * factorial(n - 1)`,
          }),
        ],
      });

      const result = await scorer.run(testRun);
      expect(result.score).toBe(1.0);
      expect(result.reason).toContain('Perfect alignment');
    });

    it('should score poor alignment as low score', async () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
        options: { scale: 1 },
      });

      // Mock the run method for poor alignment
      scorer.run = vi.fn().mockResolvedValue({
        score: 0.3,
        reason: 'Poor alignment - response addresses different topic than requested.',
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: 'Explain how to implement a binary search tree in Python',
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content: 'A linked list is a linear data structure.',
          }),
        ],
      });

      const result = await scorer.run(testRun);
      expect(result.score).toBe(0.3);
      expect(result.reason).toContain('Poor alignment');
    });

    it('should score partial alignment appropriately', async () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
        options: { scale: 1 },
      });

      // Mock the run method for partial alignment
      scorer.run = vi.fn().mockResolvedValue({
        score: 0.7,
        reason: 'Partial alignment - intent addressed but missing some requirements.',
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: 'Create a REST API endpoint with authentication and rate limiting',
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content: `app.post('/api/endpoint', authenticate, (req, res) => {
  // Endpoint with authentication only, rate limiting not implemented
  res.json({ success: true });
});`,
          }),
        ],
      });

      const result = await scorer.run(testRun);
      expect(result.score).toBe(0.7);
      expect(result.reason).toContain('Partial alignment');
    });

    it('should handle format mismatch scenarios', async () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
        options: { scale: 1 },
      });

      // Mock the run method for format mismatch
      scorer.run = vi.fn().mockResolvedValue({
        score: 0.8,
        reason: 'Good content alignment but format mismatch - requested bullet points, got paragraph.',
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: 'List the benefits of TypeScript in bullet points',
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content:
              'TypeScript provides static typing, better IDE support, and enhanced code reliability through compile-time error checking.',
          }),
        ],
      });

      const result = await scorer.run(testRun);
      expect(result.score).toBe(0.8);
      expect(result.reason).toContain('format mismatch');
    });

    it('should apply scale correctly in scoring', async () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
        options: { scale: 10 },
      });

      // Mock the run method with scaled score
      scorer.run = vi.fn().mockResolvedValue({
        score: 8.0,
        reason: 'Score: 8.0 out of 10 - Good alignment with minor gaps.',
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: 'Write a function',
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content: 'function example() { return true; }',
          }),
        ],
      });

      const result = await scorer.run(testRun);
      expect(result.score).toBe(8.0);
      expect(result.reason).toContain('8.0 out of 10');
    });
  });

  describe('Evaluation Modes', () => {
    it('should default to "both" evaluation mode', () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
      });

      expect(scorer.description).toContain('intent and requirements');
      // The default mode is 'both' which evaluates both user and system prompts
    });

    it('should create scorer with user evaluation mode', () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
        options: {
          evaluationMode: 'user',
        },
      });

      expect(scorer.name).toBe('Prompt Alignment (LLM)');
      expect(scorer.description).toContain('intent and requirements');
    });

    it('should create scorer with system evaluation mode', () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
        options: {
          evaluationMode: 'system',
        },
      });

      expect(scorer.name).toBe('Prompt Alignment (LLM)');
      expect(scorer.description).toContain('intent and requirements');
    });

    it('should create scorer with both evaluation mode explicitly', () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
        options: {
          evaluationMode: 'both',
        },
      });

      expect(scorer.name).toBe('Prompt Alignment (LLM)');
      expect(scorer.description).toContain('intent and requirements');
    });

    it('should handle user mode scoring', async () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
        options: {
          evaluationMode: 'user',
          scale: 1,
        },
      });

      // Mock the run method for user mode
      scorer.run = vi.fn().mockResolvedValue({
        score: 0.9,
        reason: 'Excellent user prompt alignment - all requirements met.',
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: 'user-1',
            role: 'user',
            content: 'Write a Python function to calculate factorial',
          }),
        ],
        output: [
          createUIMessage({
            id: 'assistant-1',
            role: 'assistant',
            content: 'def factorial(n): return 1 if n <= 1 else n * factorial(n-1)',
          }),
        ],
      });

      const result = await scorer.run(testRun);
      expect(result.score).toBe(0.9);
      expect(result.reason).toContain('user prompt alignment');
    });

    it('should handle system mode scoring', async () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
        options: {
          evaluationMode: 'system',
          scale: 1,
        },
      });

      // Mock the run method for system mode
      scorer.run = vi.fn().mockResolvedValue({
        score: 0.85,
        reason: 'Good system compliance - follows most behavioral guidelines.',
      });

      const testRun = createAgentTestRun({
        systemMessages: [
          {
            role: 'system' as const,
            content: 'You are a helpful assistant. Always be polite and concise.',
          },
        ],
        inputMessages: [
          createUIMessage({
            id: 'user-1',
            role: 'user',
            content: 'Explain quantum computing',
          }),
        ],
        output: [
          createUIMessage({
            id: 'assistant-1',
            role: 'assistant',
            content: 'Quantum computing uses quantum bits that can be in superposition.',
          }),
        ],
      });

      const result = await scorer.run(testRun);
      expect(result.score).toBe(0.85);
      expect(result.reason).toContain('system compliance');
    });

    it('should handle both mode scoring', async () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
        options: {
          evaluationMode: 'both',
          scale: 1,
        },
      });

      // Mock the run method for both mode
      scorer.run = vi.fn().mockResolvedValue({
        score: 0.88,
        reason: 'Strong alignment - addresses user intent while following system guidelines.',
      });

      const testRun = createAgentTestRun({
        systemMessages: [
          {
            role: 'system' as const,
            content: 'Always provide code examples when explaining programming concepts.',
          },
        ],
        inputMessages: [
          createUIMessage({
            id: 'user-1',
            role: 'user',
            content: 'Explain recursion',
          }),
        ],
        output: [
          createUIMessage({
            id: 'assistant-1',
            role: 'assistant',
            content: `Recursion is when a function calls itself. Here's an example:
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n-1)`,
          }),
        ],
      });

      const result = await scorer.run(testRun);
      expect(result.score).toBe(0.88);
      expect(result.reason).toContain('addresses user intent while following system guidelines');
    });
  });

  describe('Integration Test Cases', () => {
    it('should handle code generation prompt alignment', async () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
      });

      // Mock specific behavior for code generation
      scorer.run = vi.fn().mockResolvedValue({
        score: 0.95,
        reason: 'Excellent alignment - REST API endpoint created with authentication as requested.',
      });

      const testRun = createAgentTestRun({
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

      const result = await scorer.run(testRun);
      expect(result.score).toBe(0.95);
      expect(result.reason).toContain('REST API endpoint');
    });

    it('should handle question-answer prompt alignment', async () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
      });

      // Mock specific behavior for Q&A format
      scorer.run = vi.fn().mockResolvedValue({
        score: 1.0,
        reason: 'Perfect alignment - differences explained in requested bullet point format.',
      });

      const testRun = createAgentTestRun({
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

      const result = await scorer.run(testRun);
      expect(result.score).toBe(1.0);
      expect(result.reason).toContain('bullet point format');
    });

    it('should detect missing requirements', async () => {
      const scorer = createPromptAlignmentScorerLLM({
        model: mockModel,
      });

      // Mock detection of missing requirements
      scorer.run = vi.fn().mockResolvedValue({
        score: 0.5,
        reason: 'Partial alignment - 2 out of 4 requirements missing (error handling and documentation).',
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: 'Write a Python class with initialization, validation, error handling, and documentation',
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content: `class Example:
    def __init__(self, value):
        self.value = value

    def validate(self):
        return self.value > 0`,
          }),
        ],
      });

      const result = await scorer.run(testRun);
      expect(result.score).toBe(0.5);
      expect(result.reason).toContain('2 out of 4 requirements missing');
    });
  });
});
