import type { MastraDBMessage } from '@mastra/core/agent';
import { createScorer } from '@mastra/core/evals';
import type {
  Trajectory,
  ScorerRunOutputForAgent,
  ScorerRunInputForAgent,
  TrajectoryStepType,
  ToolCallStep,
  ExpectedStep,
} from '@mastra/core/evals';
import { describe, it, expect } from 'vitest';
import {
  getTextContentFromMastraDBMessage,
  getUserMessageFromRunInput,
  getCombinedSystemPrompt,
  getAssistantMessageFromRunOutput,
  getReasoningFromRunOutput,
  isScorerRunOutputForAgent,
  createTestMessage,
  createToolInvocation,
  extractToolResults,
  extractTrajectory,
  compareTrajectories,
  checkTrajectoryEfficiency,
  checkTrajectoryBlacklist,
  analyzeToolFailures,
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

    it('should extract assistant text from workflow-style output', () => {
      expect(getAssistantMessageFromRunOutput({ text: 'Workflow response' })).toBe('Workflow response');
      expect(getAssistantMessageFromRunOutput({ content: 'Task response' })).toBe('Task response');
      expect(getAssistantMessageFromRunOutput('String response')).toBe('String response');
    });

    it('should not extract non-assistant role text from single message output', () => {
      expect(getAssistantMessageFromRunOutput({ role: 'user', text: 'User text' })).toBeUndefined();
      expect(getAssistantMessageFromRunOutput({ role: 'user', content: 'User content' })).toBeUndefined();
    });

    it('should extract assistant text from nested content output', () => {
      expect(
        getAssistantMessageFromRunOutput({
          content: { parts: [{ type: 'text', text: 'Nested task response' }] },
        }),
      ).toBe('Nested task response');

      expect(
        getAssistantMessageFromRunOutput({
          content: { content: { parts: [{ type: 'text', text: 'Nested message response' }] } },
        }),
      ).toBe('Nested message response');
    });

    it('should extract assistant text from model messages', () => {
      const output = [
        { role: 'user', content: 'Question' },
        { role: 'assistant', content: [{ type: 'text', text: 'Model response' }] },
      ];

      expect(getAssistantMessageFromRunOutput(output)).toBe('Model response');
    });
  });

  describe('isScorerRunOutputForAgent', () => {
    it('should only match arrays of message-like objects', () => {
      expect(isScorerRunOutputForAgent([createTestMessage({ role: 'assistant', content: 'Assistant response' })])).toBe(
        true,
      );
      expect(isScorerRunOutputForAgent(['Assistant response'])).toBe(false);
      expect(isScorerRunOutputForAgent([{ role: 'assistant', content: 'Assistant response' }])).toBe(false);
      expect(isScorerRunOutputForAgent({ text: 'Workflow response' })).toBe(false);
    });
  });

  describe('getUserMessageFromRunInput', () => {
    it('should extract user text content from agent input', () => {
      const input: ScorerRunInputForAgent = {
        inputMessages: [
          createTestMessage({ content: 'User question', role: 'user' }),
          createTestMessage({ content: 'Assistant response', role: 'assistant' }),
        ],
        rememberedMessages: [],
        systemMessages: [],
        taggedSystemMessages: {},
      };

      const result = getUserMessageFromRunInput(input);
      expect(result).toBe('User question');
    });

    it('should extract user text from workflow-style input', () => {
      expect(getUserMessageFromRunInput({ prompt: 'Workflow question' })).toBe('Workflow question');
      expect(getUserMessageFromRunInput('String question')).toBe('String question');
    });

    it('should extract user text from common non-agent input fields', () => {
      expect(getUserMessageFromRunInput({ text: 'Text question' })).toBe('Text question');
      expect(getUserMessageFromRunInput({ content: 'Content question' })).toBe('Content question');
      expect(getUserMessageFromRunInput({ input: { text: 'Input question' } })).toBe('Input question');
      expect(getUserMessageFromRunInput({ user: { body: 'User question' } })).toBe('User question');
    });

    it('should extract user text from model messages', () => {
      const input = {
        messages: [
          { role: 'system', content: 'System prompt' },
          { role: 'user', content: [{ type: 'text', text: 'Model question' }] },
        ],
      };

      expect(getUserMessageFromRunInput(input)).toBe('Model question');
    });

    it('should extract user text from message text and body fields', () => {
      expect(getUserMessageFromRunInput({ messages: [{ role: 'user', text: 'Text message question' }] })).toBe(
        'Text message question',
      );
      expect(getUserMessageFromRunInput({ inputMessages: [{ role: 'user', body: 'Body message question' }] })).toBe(
        'Body message question',
      );
    });
  });

  describe('getCombinedSystemPrompt', () => {
    it('should include system messages from non-agent message arrays', () => {
      expect(
        getCombinedSystemPrompt({
          messages: [
            { role: 'system', content: 'System message' },
            { role: 'user', content: 'User question' },
          ],
          inputMessages: [{ role: 'system', text: 'Input system message' }],
        }),
      ).toBe('Input system message\n\nSystem message');
    });
  });

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

  describe('extractToolResults', () => {
    it('should extract tool results from output with tool invocations', () => {
      const output: ScorerRunOutputForAgent = [
        createTestMessage({
          content: 'Let me check the weather.',
          role: 'assistant',
          toolInvocations: [
            createToolInvocation({
              toolCallId: 'call-1',
              toolName: 'weatherTool',
              args: { location: 'London' },
              result: { temperature: 20, condition: 'sunny' },
              state: 'result',
            }),
          ],
        }),
      ];

      const results = extractToolResults(output);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        toolName: 'weatherTool',
        toolCallId: 'call-1',
        args: { location: 'London' },
        result: { temperature: 20, condition: 'sunny' },
      });
    });

    it('should return empty array for output without tool invocations', () => {
      const output: ScorerRunOutputForAgent = [
        createTestMessage({
          content: 'Hello, how can I help?',
          role: 'assistant',
        }),
      ];

      const results = extractToolResults(output);

      expect(results).toHaveLength(0);
    });

    it('should extract multiple tool results from multiple messages', () => {
      const output: ScorerRunOutputForAgent = [
        createTestMessage({
          content: 'Checking weather...',
          role: 'assistant',
          toolInvocations: [
            createToolInvocation({
              toolCallId: 'call-1',
              toolName: 'weatherTool',
              args: { location: 'London' },
              result: { temperature: 20 },
              state: 'result',
            }),
          ],
        }),
        createTestMessage({
          content: 'Now checking stocks...',
          role: 'assistant',
          toolInvocations: [
            createToolInvocation({
              toolCallId: 'call-2',
              toolName: 'stockTool',
              args: { symbol: 'AAPL' },
              result: { price: 150.5 },
              state: 'result',
            }),
          ],
        }),
      ];

      const results = extractToolResults(output);

      expect(results).toHaveLength(2);
      expect(results[0]?.toolName).toBe('weatherTool');
      expect(results[1]?.toolName).toBe('stockTool');
    });

    it('should only include tool invocations with state "result"', () => {
      const output: ScorerRunOutputForAgent = [
        createTestMessage({
          content: 'Processing...',
          role: 'assistant',
          toolInvocations: [
            createToolInvocation({
              toolCallId: 'call-1',
              toolName: 'pendingTool',
              args: {},
              result: {},
              state: 'call', // Not a result yet
            }),
            createToolInvocation({
              toolCallId: 'call-2',
              toolName: 'completedTool',
              args: { query: 'test' },
              result: { data: 'success' },
              state: 'result',
            }),
          ],
        }),
      ];

      const results = extractToolResults(output);

      expect(results).toHaveLength(1);
      expect(results[0]?.toolName).toBe('completedTool');
    });

    it('should handle tool invocations with undefined result', () => {
      const output: ScorerRunOutputForAgent = [
        createTestMessage({
          content: 'Processing...',
          role: 'assistant',
          toolInvocations: [
            {
              toolCallId: 'call-1',
              toolName: 'noResultTool',
              args: {},
              result: undefined as any,
              state: 'result',
            },
            createToolInvocation({
              toolCallId: 'call-2',
              toolName: 'hasResultTool',
              args: {},
              result: { value: 42 },
              state: 'result',
            }),
          ],
        }),
      ];

      const results = extractToolResults(output);

      expect(results).toHaveLength(1);
      expect(results[0]?.toolName).toBe('hasResultTool');
    });
  });

  describe('extractTrajectory', () => {
    it('should extract tool calls with state "result" including input and output', () => {
      const output: ScorerRunOutputForAgent = [
        createTestMessage({
          content: 'Working on it.',
          role: 'assistant',
          id: 'msg-1',
          toolInvocations: [
            createToolInvocation({
              toolCallId: 'call-1',
              toolName: 'search',
              args: { query: 'hello' },
              result: { results: [] },
              state: 'result',
            }),
            createToolInvocation({
              toolCallId: 'call-2',
              toolName: 'summarize',
              args: { text: 'content' },
              result: { summary: 'short' },
              state: 'result',
            }),
          ],
        }),
      ];

      const trajectory = extractTrajectory(output);

      expect(trajectory.steps).toHaveLength(2);
      expect(trajectory.steps[0]?.name).toBe('search');
      expect(trajectory.steps[0]?.stepType).toBe('tool_call');
      const step0 = trajectory.steps[0] as ToolCallStep;
      expect(step0?.toolArgs).toEqual({ query: 'hello' });
      expect(step0?.toolResult).toEqual({ results: [] });
      expect(step0?.success).toBe(true);
      expect(trajectory.steps[1]?.name).toBe('summarize');
      const step1 = trajectory.steps[1] as ToolCallStep;
      expect(step1?.toolArgs).toEqual({ text: 'content' });
      expect(step1?.toolResult).toEqual({ summary: 'short' });
    });

    it('should extract tool calls with state "call" without output', () => {
      const output: ScorerRunOutputForAgent = [
        createTestMessage({
          content: 'Calling tool.',
          role: 'assistant',
          id: 'msg-1',
          toolInvocations: [
            createToolInvocation({
              toolCallId: 'call-1',
              toolName: 'search',
              args: { query: 'hello' },
              result: {},
              state: 'call',
            }),
          ],
        }),
      ];

      const trajectory = extractTrajectory(output);

      expect(trajectory.steps).toHaveLength(1);
      expect(trajectory.steps[0]?.name).toBe('search');
      expect(trajectory.steps[0]?.stepType).toBe('tool_call');
      const callStep = trajectory.steps[0] as ToolCallStep;
      expect(callStep.toolArgs).toEqual({ query: 'hello' });
      expect(callStep.toolResult).toBeUndefined();
      expect(callStep.success).toBe(false);
    });

    it('should skip invocations with state "partial-call"', () => {
      const output: ScorerRunOutputForAgent = [
        createTestMessage({
          content: 'Partial call.',
          role: 'assistant',
          id: 'msg-1',
          toolInvocations: [
            createToolInvocation({
              toolCallId: 'call-1',
              toolName: 'search',
              args: { query: 'hello' },
              result: {},
              state: 'partial-call',
            }),
          ],
        }),
      ];

      const trajectory = extractTrajectory(output);

      expect(trajectory.steps).toHaveLength(0);
    });

    it('should return empty trajectory when no tool calls are present', () => {
      const output: ScorerRunOutputForAgent = [
        createTestMessage({
          content: 'No tools needed.',
          role: 'assistant',
          id: 'msg-1',
        }),
      ];

      const trajectory = extractTrajectory(output);

      expect(trajectory.steps).toHaveLength(0);
    });

    it('should skip messages without toolInvocations and extract from those that have them', () => {
      const output: ScorerRunOutputForAgent = [
        createTestMessage({
          content: 'User question.',
          role: 'user',
          id: 'msg-0',
        }),
        createTestMessage({
          content: 'Let me search.',
          role: 'assistant',
          id: 'msg-1',
          toolInvocations: [
            createToolInvocation({
              toolCallId: 'call-1',
              toolName: 'search',
              args: { q: 'test' },
              result: { found: true },
              state: 'result',
            }),
          ],
        }),
        createTestMessage({
          content: 'Here is the answer.',
          role: 'assistant',
          id: 'msg-2',
        }),
      ];

      const trajectory = extractTrajectory(output);

      expect(trajectory.steps).toHaveLength(1);
      expect(trajectory.steps[0]?.name).toBe('search');
    });

    it('should extract across multiple messages preserving order', () => {
      const output: ScorerRunOutputForAgent = [
        createTestMessage({
          content: 'First step.',
          role: 'assistant',
          id: 'msg-1',
          toolInvocations: [
            createToolInvocation({
              toolCallId: 'call-1',
              toolName: 'search',
              args: { q: 'a' },
              result: { r: 1 },
              state: 'result',
            }),
          ],
        }),
        createTestMessage({
          content: 'Second step.',
          role: 'assistant',
          id: 'msg-2',
          toolInvocations: [
            createToolInvocation({
              toolCallId: 'call-2',
              toolName: 'format',
              args: { style: 'md' },
              result: { formatted: true },
              state: 'result',
            }),
          ],
        }),
      ];

      const trajectory = extractTrajectory(output);

      expect(trajectory.steps).toHaveLength(2);
      expect(trajectory.steps[0]?.name).toBe('search');
      expect(trajectory.steps[1]?.name).toBe('format');
    });

    it('should produce toolArgs/toolResult as plain objects (Record<string, unknown>)', () => {
      const output: ScorerRunOutputForAgent = [
        createTestMessage({
          content: 'Tool result.',
          role: 'assistant',
          id: 'msg-1',
          toolInvocations: [
            createToolInvocation({
              toolCallId: 'call-1',
              toolName: 'compute',
              args: { x: 1, y: 2 },
              result: { sum: 3 },
              state: 'result',
            }),
          ],
        }),
      ];

      const trajectory = extractTrajectory(output);
      const step = trajectory.steps[0] as ToolCallStep;

      expect(typeof step.toolArgs).toBe('object');
      expect(step.toolArgs).not.toBeNull();
      expect(Array.isArray(step.toolArgs)).toBe(false);
      expect(typeof step.toolResult).toBe('object');
      expect(step.toolResult).not.toBeNull();
      expect(Array.isArray(step.toolResult)).toBe(false);
    });

    it('should preserve rawOutput for LLM scorers that need text context', () => {
      const output: ScorerRunOutputForAgent = [
        createTestMessage({
          content: 'Here is the result.',
          role: 'assistant',
          id: 'msg-1',
          toolInvocations: [
            createToolInvocation({
              toolCallId: 'call-1',
              toolName: 'search',
              args: { q: 'test' },
              result: { found: true },
              state: 'result',
            }),
          ],
        }),
      ];

      const trajectory = extractTrajectory(output);

      expect(trajectory.rawOutput).toBe(output);
    });
  });

  describe('compareTrajectories', () => {
    const step = (name: string, type = 'tool_call', extra?: Record<string, unknown>) => ({
      stepType: type as TrajectoryStepType,
      name,
      ...extra,
    });

    describe('relaxed mode (default)', () => {
      it('should return score 1 for identical trajectories with complete result shape', () => {
        const a = { steps: [step('search'), step('summarize')] };
        const b = { steps: [step('search'), step('summarize')] };

        const result = compareTrajectories(a, b);

        expect(result).toEqual({
          score: 1,
          matchedSteps: 2,
          totalExpectedSteps: 2,
          totalActualSteps: 2,
          missingSteps: [],
          extraSteps: [],
          outOfOrderSteps: [],
          repeatedSteps: [],
        });
      });

      it('should return 1 when expected steps are present with extra steps in between', () => {
        const actual = { steps: [step('search'), step('validate'), step('summarize')] };
        const expected = { steps: [step('search'), step('summarize')] };

        const result = compareTrajectories(actual, expected);

        expect(result.score).toBe(1);
        expect(result.matchedSteps).toBe(2);
        expect(result.extraSteps).toEqual(['validate']);
      });

      it('should return 0 when trajectories are completely different', () => {
        const actual = { steps: [step('translate')] };
        const expected = { steps: [step('search'), step('summarize')] };

        const result = compareTrajectories(actual, expected);

        expect(result.score).toBe(0);
        expect(result.missingSteps).toEqual(['search', 'summarize']);
        expect(result.extraSteps).toEqual(['translate']);
      });

      it('should detect out-of-order steps and report the specific step', () => {
        const actual = { steps: [step('summarize'), step('search')] };
        const expected = { steps: [step('search'), step('summarize')] };

        const result = compareTrajectories(actual, expected);

        // search found at index 1, then summarize searched from index 2 -> not found after
        // summarize exists at index 0 but is before lastMatchedIndex+1=2, so out of order
        expect(result.score).toBe(0.5);
        expect(result.matchedSteps).toBe(1);
        expect(result.outOfOrderSteps).toContain('summarize');
      });

      it('should return 0 when actual is empty but expected is not', () => {
        const result = compareTrajectories({ steps: [] }, { steps: [step('search')] });

        expect(result.score).toBe(0);
        expect(result.missingSteps).toEqual(['search']);
        expect(result.totalActualSteps).toBe(0);
      });

      it('should penalize repeated steps when allowRepeatedSteps is false', () => {
        const actual = { steps: [step('search'), step('search'), step('summarize')] };
        const expected = { steps: [step('search'), step('summarize')] };

        const result = compareTrajectories(actual, expected, { allowRepeatedSteps: false });

        // 2 matched / 2 expected = 1.0, penalty for 1 repeated step = 0.1, score = 0.9
        expect(result.score).toBe(0.9);
        expect(result.repeatedSteps).toEqual(['search']);
      });

      it('should allow repeated steps by default without penalty', () => {
        const actual = { steps: [step('search'), step('search'), step('summarize')] };
        const expected = { steps: [step('search'), step('summarize')] };

        const result = compareTrajectories(actual, expected);

        expect(result.score).toBe(1);
        expect(result.repeatedSteps).toEqual(['search']);
      });

      it('should work with different step types (not just tool_call)', () => {
        const actual = {
          steps: [
            step('gpt-4', 'model_generation'),
            step('search', 'tool_call'),
            step('process-data', 'workflow_step'),
          ],
        };
        const expected = {
          steps: [
            step('gpt-4', 'model_generation'),
            step('search', 'tool_call'),
            step('process-data', 'workflow_step'),
          ],
        };

        const result = compareTrajectories(actual, expected);

        expect(result.score).toBe(1);
        expect(result.matchedSteps).toBe(3);
      });
    });

    describe('empty trajectory edge cases', () => {
      it('should return 1 when both actual and expected are empty', () => {
        const result = compareTrajectories({ steps: [] }, { steps: [] });

        expect(result.score).toBe(1);
        expect(result.matchedSteps).toBe(0);
        expect(result.totalExpectedSteps).toBe(0);
        expect(result.totalActualSteps).toBe(0);
      });

      it('should return 0 when actual has steps but expected is empty', () => {
        const actual = { steps: [step('search')] };

        const result = compareTrajectories(actual, { steps: [] });

        expect(result.score).toBe(0);
        expect(result.extraSteps).toEqual(['search']);
      });
    });

    describe('strict mode', () => {
      it('should return 1 for exact position match', () => {
        const a = { steps: [step('search'), step('summarize')] };
        const b = { steps: [step('search'), step('summarize')] };

        const result = compareTrajectories(a, b, { ordering: 'strict' });

        expect(result.score).toBe(1);
      });

      it('should return 0 for reversed order and report out-of-order steps', () => {
        const a = { steps: [step('summarize'), step('search')] };
        const b = { steps: [step('search'), step('summarize')] };

        const result = compareTrajectories(a, b, { ordering: 'strict' });

        expect(result.score).toBe(0);
        expect(result.outOfOrderSteps).toContain('summarize');
        expect(result.outOfOrderSteps).toContain('search');
      });

      it('should penalize extra steps with calculated penalty', () => {
        const actual = { steps: [step('search'), step('summarize'), step('format')] };
        const expected = { steps: [step('search'), step('summarize')] };

        const result = compareTrajectories(actual, expected, { ordering: 'strict' });

        // 2 matched / 2 expected = 1.0, extra penalty: (1/2) * 0.5 = 0.25, score = 0.75
        expect(result.score).toBe(0.75);
        expect(result.extraSteps).toEqual(['format']);
      });

      it('should report missing steps when actual is a subset of expected', () => {
        const actual = { steps: [step('search')] };
        const expected = { steps: [step('search'), step('summarize'), step('format')] };

        const result = compareTrajectories(actual, expected, { ordering: 'strict' });

        // Position 0: match. Positions 1,2: actual is undefined -> no match
        expect(result.matchedSteps).toBe(1);
        expect(result.missingSteps).toEqual(['summarize', 'format']);
        // 1/3 = 0.33
        expect(result.score).toBe(0.33);
      });

      it('should penalize repeated steps when not allowed', () => {
        const actual = { steps: [step('search'), step('search'), step('summarize')] };
        const expected = { steps: [step('search'), step('summarize')] };

        const result = compareTrajectories(actual, expected, { ordering: 'strict', allowRepeatedSteps: false });

        expect(result.repeatedSteps).toEqual(['search']);
        // Position 0: match. Position 1: search vs summarize -> no match.
        // 1 matched / 2 expected = 0.5, extra penalty (1/2)*0.5=0.25, repeated penalty 0.1
        // 0.5 - 0.25 - 0.1 = 0.15
        expect(result.score).toBe(0.15);
      });
    });

    describe('step data comparison (auto-detected from expected fields)', () => {
      it('should match steps with same toolArgs', () => {
        const a = { steps: [{ stepType: 'tool_call' as const, name: 'search', toolArgs: { q: 'hello' } }] };
        const b = { steps: [{ stepType: 'tool_call' as const, name: 'search', toolArgs: { q: 'hello' } }] };

        const result = compareTrajectories(a, b);

        expect(result.score).toBe(1);
        expect(result.matchedSteps).toBe(1);
      });

      it('should not match steps with different toolArgs', () => {
        const a = { steps: [{ stepType: 'tool_call' as const, name: 'search', toolArgs: { q: 'hello' } }] };
        const b = { steps: [{ stepType: 'tool_call' as const, name: 'search', toolArgs: { q: 'world' } }] };

        const result = compareTrajectories(a, b);

        expect(result.score).toBe(0);
      });

      it('should not match steps with different toolResult', () => {
        const a = { steps: [{ stepType: 'tool_call' as const, name: 'search', toolResult: { count: 5 } }] };
        const b = { steps: [{ stepType: 'tool_call' as const, name: 'search', toolResult: { count: 10 } }] };

        const result = compareTrajectories(a, b);

        expect(result.score).toBe(0);
      });

      it('should not match steps with different stepType even if names match', () => {
        const a = { steps: [{ stepType: 'tool_call' as const, name: 'process' }] };
        const b = { steps: [{ stepType: 'workflow_step' as const, name: 'process' }] };

        const result = compareTrajectories(a, b);

        expect(result.score).toBe(0);
        expect(result.matchedSteps).toBe(0);
      });

      it('should match when expected step has no data-specific fields defined', () => {
        const a = {
          steps: [
            {
              stepType: 'tool_call' as const,
              name: 'search',
              toolArgs: { query: 'anything' },
              toolResult: { results: [] },
            },
          ],
        };
        // Expected step only specifies stepType, no toolArgs/toolResult → matches by name+type only
        const b = { steps: [{ stepType: 'tool_call' as const, name: 'search' }] };

        const result = compareTrajectories(a, b);

        expect(result.score).toBe(1);
      });

      it('should auto-compare data fields in strict mode', () => {
        const a = {
          steps: [
            { stepType: 'tool_call' as const, name: 'search', toolArgs: { q: 'a' } },
            { stepType: 'tool_call' as const, name: 'summarize', toolArgs: { maxLen: 100 } },
          ],
        };
        const b = {
          steps: [
            { stepType: 'tool_call' as const, name: 'search', toolArgs: { q: 'a' } },
            { stepType: 'tool_call' as const, name: 'summarize', toolArgs: { maxLen: 200 } },
          ],
        };

        const result = compareTrajectories(a, b, { ordering: 'strict' });

        // Position 0 matches, position 1 name matches but data doesn't -> not matched
        expect(result.matchedSteps).toBe(1);
        expect(result.score).toBe(0.5);
      });
    });

    describe('unordered mode', () => {
      it('should match steps regardless of order', () => {
        const a: Trajectory = {
          steps: [
            { stepType: 'tool_call' as const, name: 'summarize' },
            { stepType: 'tool_call' as const, name: 'search' },
          ],
        };
        const b: Trajectory = {
          steps: [
            { stepType: 'tool_call' as const, name: 'search' },
            { stepType: 'tool_call' as const, name: 'summarize' },
          ],
        };
        const result = compareTrajectories(a, b, { ordering: 'unordered' });
        expect(result.score).toBe(1);
        expect(result.matchedSteps).toBe(2);
        expect(result.outOfOrderSteps).toEqual([]);
      });

      it('should detect missing steps', () => {
        const a: Trajectory = { steps: [{ stepType: 'tool_call' as const, name: 'search' }] };
        const b: Trajectory = {
          steps: [
            { stepType: 'tool_call' as const, name: 'search' },
            { stepType: 'tool_call' as const, name: 'summarize' },
          ],
        };
        const result = compareTrajectories(a, b, { ordering: 'unordered' });
        expect(result.score).toBe(0.5);
        expect(result.missingSteps).toEqual(['summarize']);
      });

      it('should detect extra steps', () => {
        const a: Trajectory = {
          steps: [
            { stepType: 'tool_call' as const, name: 'search' },
            { stepType: 'tool_call' as const, name: 'extra' },
          ],
        };
        const b: Trajectory = { steps: [{ stepType: 'tool_call' as const, name: 'search' }] };
        const result = compareTrajectories(a, b, { ordering: 'unordered' });
        expect(result.score).toBe(1);
        expect(result.extraSteps).toEqual(['extra']);
      });
    });

    describe('ExpectedStep matching', () => {
      it('should match ExpectedStep by name only (no stepType)', () => {
        const actual: Trajectory = {
          steps: [
            { stepType: 'tool_call', name: 'search' },
            { stepType: 'model_generation', name: 'generate' },
          ],
        };
        const expected: { steps: ExpectedStep[] } = {
          steps: [{ name: 'search' }, { name: 'generate' }],
        };

        const result = compareTrajectories(actual, expected);
        expect(result.score).toBe(1);
        expect(result.matchedSteps).toBe(2);
      });

      it('should match ExpectedStep by name + stepType', () => {
        const actual: Trajectory = {
          steps: [
            { stepType: 'tool_call', name: 'search' },
            { stepType: 'mcp_tool_call', name: 'search' },
          ],
        };
        const expected: { steps: ExpectedStep[] } = {
          steps: [{ name: 'search', stepType: 'mcp_tool_call' }],
        };

        const result = compareTrajectories(actual, expected);
        expect(result.matchedSteps).toBe(1);
        expect(result.missingSteps).toEqual([]);
      });

      it('should fail to match when stepType does not match', () => {
        const actual: Trajectory = {
          steps: [{ stepType: 'tool_call', name: 'search' }],
        };
        const expected: { steps: ExpectedStep[] } = {
          steps: [{ name: 'search', stepType: 'mcp_tool_call' }],
        };

        const result = compareTrajectories(actual, expected);
        expect(result.matchedSteps).toBe(0);
        expect(result.missingSteps).toEqual(['search']);
      });

      it('should match ExpectedStep when toolArgs match', () => {
        const actual: Trajectory = {
          steps: [{ stepType: 'tool_call', name: 'search', toolArgs: { query: 'hello' } }],
        };
        const expected: { steps: ExpectedStep[] } = {
          steps: [{ name: 'search', stepType: 'tool_call', toolArgs: { query: 'hello' } }],
        };

        const result = compareTrajectories(actual, expected);
        expect(result.score).toBe(1);
        expect(result.matchedSteps).toBe(1);
      });

      it('should fail when expected toolArgs differ from actual', () => {
        const actual: Trajectory = {
          steps: [{ stepType: 'tool_call', name: 'search', toolArgs: { query: 'different' } }],
        };
        const expected: { steps: ExpectedStep[] } = {
          steps: [{ name: 'search', stepType: 'tool_call', toolArgs: { query: 'hello' } }],
        };

        const result = compareTrajectories(actual, expected);
        expect(result.score).toBe(0);
        expect(result.matchedSteps).toBe(0);
      });

      it('should match by name+type only when no data fields are specified', () => {
        const actual: Trajectory = {
          steps: [{ stepType: 'tool_call', name: 'search', toolArgs: { query: 'anything' } }],
        };
        const expected: { steps: ExpectedStep[] } = {
          // No toolArgs specified → data comparison skipped, matches by name+type
          steps: [{ name: 'search', stepType: 'tool_call' }],
        };

        const result = compareTrajectories(actual, expected);
        expect(result.score).toBe(1);
        expect(result.matchedSteps).toBe(1);
      });

      it('should work with unordered mode and ExpectedStep', () => {
        const actual: Trajectory = {
          steps: [
            { stepType: 'tool_call', name: 'summarize' },
            { stepType: 'tool_call', name: 'search' },
          ],
        };
        const expected: { steps: ExpectedStep[] } = {
          steps: [{ name: 'search' }, { name: 'summarize' }],
        };

        const result = compareTrajectories(actual, expected, { ordering: 'unordered' });
        expect(result.score).toBe(1);
        expect(result.matchedSteps).toBe(2);
      });

      it('should work with strict mode and ExpectedStep', () => {
        const actual: Trajectory = {
          steps: [
            { stepType: 'tool_call', name: 'search' },
            { stepType: 'tool_call', name: 'summarize' },
          ],
        };
        const expected: { steps: ExpectedStep[] } = {
          steps: [{ name: 'search' }, { name: 'summarize' }],
        };

        const result = compareTrajectories(actual, expected, { ordering: 'strict' });
        expect(result.score).toBe(1);
      });

      it('should handle mixed Trajectory (auto-normalized) and ExpectedStep inputs', () => {
        // When a Trajectory is passed as expected, it should be auto-normalized
        const actual: Trajectory = {
          steps: [{ stepType: 'tool_call', name: 'search', toolArgs: { q: 'test' } }],
        };
        const expectedAsTrajectory: Trajectory = {
          steps: [{ stepType: 'tool_call', name: 'search', toolArgs: { q: 'test' } }],
        };

        const result = compareTrajectories(actual, expectedAsTrajectory);
        expect(result.score).toBe(1);
        expect(result.matchedSteps).toBe(1);
      });
    });
  });

  describe('checkTrajectoryEfficiency', () => {
    it('should return score 1.0 when all budgets are met and no redundancy', () => {
      const trajectory: Trajectory = {
        steps: [
          { stepType: 'tool_call' as const, name: 'search' },
          { stepType: 'tool_call' as const, name: 'summarize' },
        ],
      };
      const result = checkTrajectoryEfficiency(trajectory, { maxSteps: 5 });
      expect(result.score).toBe(1);
      expect(result.overStepBudget).toBe(false);
      expect(result.redundantCalls).toEqual([]);
    });

    it('should penalize when step budget is exceeded', () => {
      const trajectory: Trajectory = {
        steps: [
          { stepType: 'tool_call' as const, name: 'a' },
          { stepType: 'tool_call' as const, name: 'b' },
          { stepType: 'tool_call' as const, name: 'c' },
        ],
      };
      const result = checkTrajectoryEfficiency(trajectory, { maxSteps: 2 });
      expect(result.overStepBudget).toBe(true);
      expect(result.score).toBeLessThan(1);
    });

    it('should detect redundant consecutive tool calls with same args', () => {
      const trajectory: Trajectory = {
        steps: [
          { stepType: 'tool_call' as const, name: 'search', toolArgs: { q: 'test' } },
          { stepType: 'tool_call' as const, name: 'search', toolArgs: { q: 'test' } },
          { stepType: 'tool_call' as const, name: 'summarize' },
        ],
      };
      const result = checkTrajectoryEfficiency(trajectory, { noRedundantCalls: true });
      expect(result.redundantCalls).toHaveLength(1);
      expect(result.redundantCalls[0]!.name).toBe('search');
      expect(result.score).toBeLessThan(1);
    });

    it('should not flag different consecutive tool calls as redundant', () => {
      const trajectory: Trajectory = {
        steps: [
          { stepType: 'tool_call' as const, name: 'search', toolArgs: { q: 'foo' } },
          { stepType: 'tool_call' as const, name: 'search', toolArgs: { q: 'bar' } },
        ],
      };
      const result = checkTrajectoryEfficiency(trajectory, { noRedundantCalls: true });
      expect(result.redundantCalls).toEqual([]);
      expect(result.score).toBe(1);
    });

    it('should check token budget from model_generation steps', () => {
      const trajectory: Trajectory = {
        steps: [
          { stepType: 'model_generation' as const, name: 'gen1', promptTokens: 100, completionTokens: 50 },
          { stepType: 'model_generation' as const, name: 'gen2', promptTokens: 200, completionTokens: 100 },
        ],
      };
      const result = checkTrajectoryEfficiency(trajectory, { maxTotalTokens: 300 });
      expect(result.totalTokens).toBe(450);
      expect(result.overTokenBudget).toBe(true);
      expect(result.score).toBeLessThan(1);
    });

    it('should check duration budget', () => {
      const trajectory: Trajectory = {
        steps: [
          { stepType: 'tool_call' as const, name: 'a', durationMs: 500 },
          { stepType: 'tool_call' as const, name: 'b', durationMs: 700 },
        ],
        totalDurationMs: 1200,
      };
      const result = checkTrajectoryEfficiency(trajectory, { maxTotalDurationMs: 1000 });
      expect(result.totalDurationMs).toBe(1200);
      expect(result.overDurationBudget).toBe(true);
      expect(result.score).toBeLessThan(1);
    });

    it('should return score 1.0 when no budgets are configured and no redundancy', () => {
      const trajectory: Trajectory = { steps: [{ stepType: 'tool_call' as const, name: 'a' }] };
      const result = checkTrajectoryEfficiency(trajectory, {});
      expect(result.score).toBe(1);
    });
  });

  describe('checkTrajectoryBlacklist', () => {
    it('should return score 1.0 when no violations are found', () => {
      const trajectory: Trajectory = {
        steps: [
          { stepType: 'tool_call' as const, name: 'search' },
          { stepType: 'tool_call' as const, name: 'summarize' },
        ],
      };
      const result = checkTrajectoryBlacklist(trajectory, {
        blacklistedTools: ['deleteAll', 'dropTable'],
      });
      expect(result.score).toBe(1);
      expect(result.violatedTools).toEqual([]);
    });

    it('should return score 0 when a blacklisted tool is found', () => {
      const trajectory: Trajectory = {
        steps: [
          { stepType: 'tool_call' as const, name: 'search' },
          { stepType: 'tool_call' as const, name: 'deleteAll' },
        ],
      };
      const result = checkTrajectoryBlacklist(trajectory, {
        blacklistedTools: ['deleteAll'],
      });
      expect(result.score).toBe(0);
      expect(result.violatedTools).toEqual(['deleteAll']);
    });

    it('should detect blacklisted sequences', () => {
      const trajectory: Trajectory = {
        steps: [
          { stepType: 'tool_call' as const, name: 'auth' },
          { stepType: 'tool_call' as const, name: 'escalate' },
          { stepType: 'tool_call' as const, name: 'admin' },
        ],
      };
      const result = checkTrajectoryBlacklist(trajectory, {
        blacklistedSequences: [['escalate', 'admin']],
      });
      expect(result.score).toBe(0);
      expect(result.violatedSequences).toEqual([['escalate', 'admin']]);
    });

    it('should not flag non-contiguous sequence matches', () => {
      const trajectory: Trajectory = {
        steps: [
          { stepType: 'tool_call' as const, name: 'escalate' },
          { stepType: 'tool_call' as const, name: 'search' },
          { stepType: 'tool_call' as const, name: 'admin' },
        ],
      };
      const result = checkTrajectoryBlacklist(trajectory, {
        blacklistedSequences: [['escalate', 'admin']],
      });
      expect(result.score).toBe(1);
      expect(result.violatedSequences).toEqual([]);
    });

    it('should report both tool and sequence violations', () => {
      const trajectory: Trajectory = {
        steps: [
          { stepType: 'tool_call' as const, name: 'deleteAll' },
          { stepType: 'tool_call' as const, name: 'escalate' },
          { stepType: 'tool_call' as const, name: 'admin' },
        ],
      };
      const result = checkTrajectoryBlacklist(trajectory, {
        blacklistedTools: ['deleteAll'],
        blacklistedSequences: [['escalate', 'admin']],
      });
      expect(result.score).toBe(0);
      expect(result.violatedTools).toEqual(['deleteAll']);
      expect(result.violatedSequences).toEqual([['escalate', 'admin']]);
    });
  });

  describe('analyzeToolFailures', () => {
    it('should return score 1.0 and no patterns for clean trajectory', () => {
      const trajectory: Trajectory = {
        steps: [
          { stepType: 'tool_call' as const, name: 'search', success: true },
          { stepType: 'tool_call' as const, name: 'summarize', success: true },
        ],
      };
      const result = analyzeToolFailures(trajectory);
      expect(result.score).toBe(1);
      expect(result.patterns).toEqual([]);
      expect(result.totalRetries).toBe(0);
    });

    it('should detect retry patterns when tool fails and is called again', () => {
      const trajectory: Trajectory = {
        steps: [
          { stepType: 'tool_call' as const, name: 'search', success: false },
          { stepType: 'tool_call' as const, name: 'search', success: true },
        ],
      };
      const result = analyzeToolFailures(trajectory);
      expect(result.patterns).toHaveLength(1);
      expect(result.patterns[0]!.toolName).toBe('search');
      expect(result.patterns[0]!.retryCount).toBe(1);
      expect(result.patterns[0]!.eventuallySucceeded).toBe(true);
      expect(result.totalRetries).toBe(1);
    });

    it('should penalize excessive retries beyond threshold', () => {
      const trajectory: Trajectory = {
        steps: [
          { stepType: 'tool_call' as const, name: 'search', success: false },
          { stepType: 'tool_call' as const, name: 'search', success: false },
          { stepType: 'tool_call' as const, name: 'search', success: false },
          { stepType: 'tool_call' as const, name: 'search', success: true },
        ],
      };
      const result = analyzeToolFailures(trajectory, { maxRetriesPerTool: 2 });
      expect(result.excessiveRetryTools).toEqual(['search']);
      expect(result.score).toBeLessThan(1);
    });

    it('should detect fallback to alternative tool', () => {
      const trajectory: Trajectory = {
        steps: [
          { stepType: 'tool_call' as const, name: 'primarySearch', success: false },
          { stepType: 'tool_call' as const, name: 'primarySearch', success: false },
          { stepType: 'tool_call' as const, name: 'fallbackSearch', success: true },
        ],
      };
      const result = analyzeToolFailures(trajectory);
      expect(result.patterns).toHaveLength(1);
      expect(result.patterns[0]!.fellBackToAlternative).toBe(true);
      expect(result.patterns[0]!.alternativeTool).toBe('fallbackSearch');
    });

    it('should return score 1.0 for trajectory with no tool calls', () => {
      const trajectory: Trajectory = { steps: [{ stepType: 'model_generation' as const, name: 'gen' }] };
      const result = analyzeToolFailures(trajectory);
      expect(result.score).toBe(1);
      expect(result.patterns).toEqual([]);
    });
  });
});
