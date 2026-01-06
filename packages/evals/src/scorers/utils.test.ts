import type { MastraDBMessage } from '@mastra/core/agent';
import { createScorer } from '@mastra/core/evals';
import type { ScorerRunOutputForAgent, ScorerRunInputForAgent } from '@mastra/core/evals';
import { describe, it, expect } from 'vitest';
import {
  getTextContentFromMastraDBMessage,
  getAssistantMessageFromRunOutput,
  getReasoningFromRunOutput,
  createTestMessage,
} from './utils';

describe('Scorer Utils', () => {
  describe('getTextContentFromMastraDBMessage', () => {
    it('should extract text content from content.content string', () => {
      const message = createTestMessage({
        content: 'Hello world',
        role: 'assistant',
      });
      const result = getTextContentFromMastraDBMessage(message);
      expect(result).toBe('Hello world');
    });

    it('should extract text content from parts array', () => {
      const message: MastraDBMessage = {
        id: 'test-1',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Hello from parts' }],
        },
      };
      const result = getTextContentFromMastraDBMessage(message);
      expect(result).toBe('Hello from parts');
    });
  });

  describe('getAssistantMessageFromRunOutput', () => {
    it('should extract assistant text content from output', () => {
      const output: ScorerRunOutputForAgent = [
        createTestMessage({ content: 'User message', role: 'user' }),
        createTestMessage({ content: 'Assistant response', role: 'assistant' }),
      ];
      const result = getAssistantMessageFromRunOutput(output);
      expect(result).toBe('Assistant response');
    });
  });

  /**
   * When using a reasoning model, the reasoning text
   * should be available in the scorer's preprocess function. Currently, there's
   * no utility function to extract reasoning text from the run output.
   */
  describe('Reasoning text extraction', () => {
    it('should extract reasoning from content.reasoning field', () => {
      const messageWithReasoning: MastraDBMessage = {
        id: 'test-reasoning-1',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'The answer is 42.' }],
          content: 'The answer is 42.',
          reasoning: 'Let me think about this step by step...', // reasoning string field
        },
      };

      const output: ScorerRunOutputForAgent = [messageWithReasoning];

      // Currently there's no function to get reasoning - this test documents the missing functionality
      // We need a getReasoningFromRunOutput function similar to getAssistantMessageFromRunOutput
      const reasoning = getReasoningFromRunOutput(output);

      expect(reasoning).toBe('Let me think about this step by step...');
    });

    it('should extract reasoning from parts with type "reasoning"', () => {
      // This is how reasoning is stored when using models like deepseek-reasoner
      // The reasoning is in content.parts as { type: 'reasoning', details: [{ type: 'text', text: '...' }] }
      const messageWithReasoningParts: MastraDBMessage = {
        id: 'test-reasoning-2',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            {
              type: 'reasoning',
              reasoning: '', // This is often blank, the actual text is in details
              details: [{ type: 'text', text: 'First, I need to consider the problem carefully...' }],
            } as any,
            { type: 'text', text: 'The final answer is 42.' },
          ],
          content: 'The final answer is 42.',
        },
      };

      const output: ScorerRunOutputForAgent = [messageWithReasoningParts];

      const reasoning = getReasoningFromRunOutput(output);

      expect(reasoning).toBe('First, I need to consider the problem carefully...');
    });

    it('should return undefined when no reasoning is present', () => {
      const messageWithoutReasoning: MastraDBMessage = {
        id: 'test-no-reasoning',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Just a regular response.' }],
          content: 'Just a regular response.',
        },
      };

      const output: ScorerRunOutputForAgent = [messageWithoutReasoning];

      const reasoning = getReasoningFromRunOutput(output);

      expect(reasoning).toBeUndefined();
    });

    it('should handle multiple reasoning parts', () => {
      const messageWithMultipleReasoningParts: MastraDBMessage = {
        id: 'test-multi-reasoning',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            {
              type: 'reasoning',
              reasoning: '',
              details: [{ type: 'text', text: 'Step 1: Analyze the question.' }],
            } as any,
            {
              type: 'reasoning',
              reasoning: '',
              details: [{ type: 'text', text: 'Step 2: Consider the options.' }],
            } as any,
            { type: 'text', text: 'The answer is B.' },
          ],
          content: 'The answer is B.',
        },
      };

      const output: ScorerRunOutputForAgent = [messageWithMultipleReasoningParts];

      const reasoning = getReasoningFromRunOutput(output);

      expect(reasoning).toContain('Step 1: Analyze the question.');
      expect(reasoning).toContain('Step 2: Consider the options.');
    });
  });

  /**
   * Integration test: Proves reasoning text is available in scorer preprocess function
   * This directly addresses GitHub Issue #9911
   */
  describe('Reasoning available in scorer preprocess - Issue #9911 Integration Test', () => {
    it('should make reasoning text available in scorer preprocess function', async () => {
      // Create a scorer that extracts reasoning in preprocess
      const reasoningScorer = createScorer({
        id: 'reasoning-test-scorer',
        name: 'Reasoning Test Scorer',
        description: 'Tests that reasoning text is available in preprocess',
        type: 'agent',
      })
        .preprocess(({ run }) => {
          // This is exactly what users want to do - access reasoning in preprocess
          const reasoning = getReasoningFromRunOutput(run.output);
          const response = getAssistantMessageFromRunOutput(run.output);
          return { reasoning, response };
        })
        .generateScore(({ results }) => {
          // Score based on whether reasoning was available
          return results.preprocessStepResult?.reasoning ? 1 : 0;
        });

      // Simulate a run with reasoning model output (like deepseek-reasoner)
      const inputMessages: ScorerRunInputForAgent['inputMessages'] = [
        {
          id: 'user-msg-1',
          role: 'user',
          createdAt: new Date(),
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'What is the capital of France?' }],
            content: 'What is the capital of France?',
          },
        },
      ];

      const outputWithReasoning: ScorerRunOutputForAgent = [
        {
          id: 'assistant-msg-1',
          role: 'assistant',
          createdAt: new Date(),
          content: {
            format: 2,
            parts: [
              {
                type: 'reasoning',
                reasoning: '',
                details: [
                  {
                    type: 'text',
                    text: 'The user is asking about geography. France is a country in Western Europe. Its capital city is Paris, which has been the capital since the 10th century.',
                  },
                ],
              } as any,
              { type: 'text', text: 'The capital of France is Paris.' },
            ],
            content: 'The capital of France is Paris.',
          },
        },
      ];

      // Run the scorer
      const result = await reasoningScorer.run({
        input: {
          inputMessages,
          rememberedMessages: [],
          systemMessages: [],
          taggedSystemMessages: {},
        },
        output: outputWithReasoning,
      });

      // Verify reasoning was extracted in preprocess
      expect(result.preprocessStepResult).toBeDefined();
      expect(result.preprocessStepResult?.reasoning).toBe(
        'The user is asking about geography. France is a country in Western Europe. Its capital city is Paris, which has been the capital since the 10th century.',
      );
      expect(result.preprocessStepResult?.response).toBe('The capital of France is Paris.');

      // Score should be 1 because reasoning was available
      expect(result.score).toBe(1);
    });

    it('should handle run output without reasoning gracefully', async () => {
      const reasoningScorer = createScorer({
        id: 'reasoning-test-scorer-2',
        name: 'Reasoning Test Scorer 2',
        description: 'Tests handling of missing reasoning',
        type: 'agent',
      })
        .preprocess(({ run }) => {
          const reasoning = getReasoningFromRunOutput(run.output);
          const response = getAssistantMessageFromRunOutput(run.output);
          return { reasoning, response };
        })
        .generateScore(({ results }) => {
          return results.preprocessStepResult?.reasoning ? 1 : 0;
        });

      const inputMessages: ScorerRunInputForAgent['inputMessages'] = [
        {
          id: 'user-msg-1',
          role: 'user',
          createdAt: new Date(),
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'Hello' }],
            content: 'Hello',
          },
        },
      ];

      // Output without reasoning (regular model)
      const outputWithoutReasoning: ScorerRunOutputForAgent = [
        {
          id: 'assistant-msg-1',
          role: 'assistant',
          createdAt: new Date(),
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'Hello! How can I help you today?' }],
            content: 'Hello! How can I help you today?',
          },
        },
      ];

      const result = await reasoningScorer.run({
        input: {
          inputMessages,
          rememberedMessages: [],
          systemMessages: [],
          taggedSystemMessages: {},
        },
        output: outputWithoutReasoning,
      });

      // Reasoning should be undefined
      expect(result.preprocessStepResult?.reasoning).toBeUndefined();
      expect(result.preprocessStepResult?.response).toBe('Hello! How can I help you today?');

      // Score should be 0 because no reasoning was available
      expect(result.score).toBe(0);
    });
  });
});
