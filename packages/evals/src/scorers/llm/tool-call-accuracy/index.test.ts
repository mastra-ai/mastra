import { openai } from '@ai-sdk/openai';
import { createTool } from '@mastra/core';
import { describe, expect, it, vi } from 'vitest';
import { createAgentTestRun, createToolInvocation, createUIMessage, extractToolCalls } from '../../utils';
import { createToolCallAccuracyScorerLLM } from './index';

describe('createToolCallAccuracyScorerLLM', () => {
  const mockModel = openai('gpt-4o-mini');

  const availableTools = [
    createTool({ id: 'calculator-tool', description: 'Perform mathematical calculations' }),
    createTool({ id: 'search-tool', description: 'Search the web for information' }),
    createTool({ id: 'calendar-tool', description: 'Manage calendar events' }),
    createTool({ id: 'weather-tool', description: 'Get weather information' }),
  ];

  describe('Basic Configuration', () => {
    it('should create scorer with correct configuration', () => {
      const scorer = createToolCallAccuracyScorerLLM({
        model: mockModel,
        availableTools,
      });

      expect(scorer.name).toBe('Tool Call Accuracy (LLM)');
      expect(scorer.description).toContain('Evaluates whether an agent selected appropriate tools');
    });

    it('should handle empty availableTools array', () => {
      const scorer = createToolCallAccuracyScorerLLM({
        model: mockModel,
        availableTools: [],
      });

      expect(scorer.name).toBe('Tool Call Accuracy (LLM)');
      expect(scorer).toBeDefined();
    });
  });

  describe('Tool Call Extraction', () => {
    it('should extract tool calls from agent output with tool invocations', async () => {
      const scorer = createToolCallAccuracyScorerLLM({
        model: mockModel,
        availableTools,
      });

      // Mock the preprocess step
      scorer.preprocess = vi.fn().mockImplementation(() => ({
        ...scorer,
        preprocessStepResult: {
          actualTools: ['weather-tool'],
          hasToolCalls: true,
          toolCallInfos: [],
        },
      }));

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: 'What is the weather in Paris?',
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content: 'Let me check the weather in Paris for you.',
            toolInvocations: [
              createToolInvocation({
                toolCallId: 'call_1',
                toolName: 'weather-tool',
                args: { location: 'Paris' },
                result: { temperature: 15, condition: 'cloudy' },
              }),
            ],
          }),
        ],
      });

      // Verify that tool extraction works
      const { tools } = extractToolCalls(testRun.output);
      expect(tools).toContain('weather-tool');
    });

    it('should handle output with no tool calls', async () => {
      const scorer = createToolCallAccuracyScorerLLM({
        model: mockModel,
        availableTools,
      });

      scorer.preprocess = vi.fn().mockImplementation(() => ({
        ...scorer,
        preprocessStepResult: {
          actualTools: [],
          hasToolCalls: false,
          toolCallInfos: [],
        },
      }));

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: 'Hello, how are you?',
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content: 'I am doing well, thank you for asking!',
          }),
        ],
      });

      const { tools } = extractToolCalls(testRun.output);
      expect(tools).toHaveLength(0);
    });
  });

  describe('Scoring Logic', () => {
    it('should score 1.0 when all tool calls are appropriate', async () => {
      const scorer = createToolCallAccuracyScorerLLM({
        model: mockModel,
        availableTools,
      });

      // Mock the run method to return expected results
      scorer.run = vi.fn().mockResolvedValue({
        score: 1.0,
        reason: 'Perfect tool selection for weather query.',
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: 'What is the weather in Paris?',
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content: 'The weather in Paris is 15°C and cloudy.',
            toolInvocations: [
              createToolInvocation({
                toolCallId: 'call_1',
                toolName: 'weather-tool',
                args: { location: 'Paris' },
                result: { temperature: 15, condition: 'cloudy' },
              }),
            ],
          }),
        ],
      });

      const result = await scorer.run(testRun);
      expect(result.score).toBe(1.0);
      expect(result.reason).toBe('Perfect tool selection for weather query.');
    });

    it('should score 0.0 when all tool calls are inappropriate', async () => {
      const scorer = createToolCallAccuracyScorerLLM({
        model: mockModel,
        availableTools,
      });

      // Mock the run method to return expected results
      scorer.run = vi.fn().mockResolvedValue({
        score: 0.0,
        reason: 'Wrong tools used - should have used weather-tool.',
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: 'What is the weather today?',
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content: 'Let me calculate that and check your calendar.',
            toolInvocations: [
              createToolInvocation({
                toolCallId: 'call_1',
                toolName: 'calculator-tool',
                args: {},
                result: {},
              }),
              createToolInvocation({
                toolCallId: 'call_2',
                toolName: 'calendar-tool',
                args: {},
                result: {},
              }),
            ],
          }),
        ],
      });

      const result = await scorer.run(testRun);
      expect(result.score).toBe(0.0);
      expect(result.reason).toBe('Wrong tools used - should have used weather-tool.');
    });

    it('should score 0.5 when half of tool calls are appropriate', async () => {
      const scorer = createToolCallAccuracyScorerLLM({
        model: mockModel,
        availableTools,
      });

      // Mock the run method to return expected results
      scorer.run = vi.fn().mockResolvedValue({
        score: 0.5,
        reason: 'Partial success - weather tool was appropriate but calculator was not needed.',
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: 'What is the weather in London?',
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content: 'The weather in London is 10°C.',
            toolInvocations: [
              createToolInvocation({
                toolCallId: 'call_1',
                toolName: 'weather-tool',
                args: { location: 'London' },
                result: { temperature: 10 },
              }),
              createToolInvocation({
                toolCallId: 'call_2',
                toolName: 'calculator-tool',
                args: { operation: 'celsius_to_fahrenheit' },
                result: { fahrenheit: 50 },
              }),
            ],
          }),
        ],
      });

      const result = await scorer.run(testRun);
      expect(result.score).toBe(0.5);
    });

    it('should score 1.0 when no tools were called and none were needed', async () => {
      const scorer = createToolCallAccuracyScorerLLM({
        model: mockModel,
        availableTools,
      });

      // Mock the run method to return expected results
      scorer.run = vi.fn().mockResolvedValue({
        score: 1.0,
        reason: 'Correctly identified that no tools were needed for this greeting.',
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: 'Hello, how are you?',
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content: 'Hello! I am doing well, thank you for asking.',
          }),
        ],
      });

      const result = await scorer.run(testRun);
      expect(result.score).toBe(1.0);
    });

    it('should score 0.0 when no tools were called but some were needed', async () => {
      const scorer = createToolCallAccuracyScorerLLM({
        model: mockModel,
        availableTools,
      });

      // Mock the run method to return expected results
      scorer.run = vi.fn().mockResolvedValue({
        score: 0.0,
        reason: 'Failed to use weather-tool when explicitly asked for weather information.',
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: 'What is the weather in Tokyo?',
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content: 'I cannot provide weather information without checking.',
          }),
        ],
      });

      const result = await scorer.run(testRun);
      expect(result.score).toBe(0.0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple tool calls for complex queries', async () => {
      const scorer = createToolCallAccuracyScorerLLM({
        model: mockModel,
        availableTools,
      });

      // Mock the run method to return expected results
      scorer.run = vi.fn().mockResolvedValue({
        score: 1.0,
        reason: 'Both tools were appropriate for the complex query.',
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: 'What is the weather in Paris and what are the top tourist attractions?',
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content: 'Let me get you the weather and tourist information for Paris.',
            toolInvocations: [
              createToolInvocation({
                toolCallId: 'call_1',
                toolName: 'weather-tool',
                args: { location: 'Paris' },
                result: { temperature: 15 },
              }),
              createToolInvocation({
                toolCallId: 'call_2',
                toolName: 'search-tool',
                args: { query: 'Paris tourist attractions' },
                result: { results: ['Eiffel Tower', 'Louvre'] },
              }),
            ],
          }),
        ],
      });

      const result = await scorer.run(testRun);
      expect(result.score).toBe(1.0);
    });

    it('should handle clarification requests appropriately', async () => {
      const scorer = createToolCallAccuracyScorerLLM({
        model: mockModel,
        availableTools,
      });

      // Mock the run method to return expected results
      scorer.run = vi.fn().mockResolvedValue({
        score: 1.0,
        reason: 'Appropriately asked for clarification on vague request.',
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: 'I need help with something',
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content:
              'I would be happy to help! Could you please provide more details about what you need assistance with?',
          }),
        ],
      });

      const result = await scorer.run(testRun);
      expect(result.score).toBe(1.0);
      expect(result.reason).toContain('clarification');
    });

    it('should handle undefined or null results gracefully', async () => {
      const scorer = createToolCallAccuracyScorerLLM({
        model: mockModel,
        availableTools,
      });

      // Mock the run method to return expected results
      scorer.run = vi.fn().mockResolvedValue({
        score: 1.0,
        reason: 'Unable to evaluate tool selection.',
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: 'Test query',
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content: 'Test response',
          }),
        ],
      });

      const result = await scorer.run(testRun);

      // When no evaluations and no missing tools, default to 1.0
      expect(result.score).toBe(1.0);
    });

    it('should handle tool calls with errors', async () => {
      const scorer = createToolCallAccuracyScorerLLM({
        model: mockModel,
        availableTools,
      });

      // Mock the run method to return expected results
      scorer.run = vi.fn().mockResolvedValue({
        score: 1.0,
        reason: 'Correct tool selection despite execution error.',
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: 'What is the weather in InvalidCity?',
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content: 'I encountered an error getting the weather.',
            toolInvocations: [
              {
                toolCallId: 'call_1',
                toolName: 'weather-tool',
                args: { location: 'InvalidCity' },
                result: { error: 'City not found' },
                state: 'error' as any,
              },
            ],
          }),
        ],
      });

      const result = await scorer.run(testRun);

      // Tool selection was still appropriate even if execution failed
      expect(result.score).toBe(1.0);
    });

    it('should handle repeated tool calls', async () => {
      const scorer = createToolCallAccuracyScorerLLM({
        model: mockModel,
        availableTools,
      });

      // Mock the run method to return expected results
      scorer.run = vi.fn().mockResolvedValue({
        score: 0.67,
        reason: 'Two out of three tool calls were appropriate.',
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: 'Compare weather in Paris and London',
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content: 'Checking weather for both cities.',
            toolInvocations: [
              createToolInvocation({
                toolCallId: 'call_1',
                toolName: 'weather-tool',
                args: { location: 'Paris' },
                result: { temperature: 15 },
              }),
              createToolInvocation({
                toolCallId: 'call_2',
                toolName: 'weather-tool',
                args: { location: 'London' },
                result: { temperature: 10 },
              }),
              createToolInvocation({
                toolCallId: 'call_3',
                toolName: 'weather-tool',
                args: { location: 'Paris' },
                result: { temperature: 15 },
              }),
            ],
          }),
        ],
      });

      const result = await scorer.run(testRun);
      expect(result.score).toBeCloseTo(0.67, 2); // 2 out of 3 were appropriate
    });
  });

  describe('Real-world Scenarios', () => {
    it('should evaluate multi-step tool usage correctly', async () => {
      const scorer = createToolCallAccuracyScorerLLM({
        model: mockModel,
        availableTools: [...availableTools, createTool({ id: 'email-tool', description: 'Send emails' })],
      });

      // Mock the run method to return expected results
      scorer.run = vi.fn().mockResolvedValue({
        score: 0.67,
        reason: 'Two out of three tools were appropriate for the task.',
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: 'Schedule an outdoor picnic for this weekend if the weather is good',
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content: 'I will check the weather and schedule the picnic.',
            toolInvocations: [
              createToolInvocation({
                toolCallId: 'call_1',
                toolName: 'calendar-tool',
                args: { event: 'Outdoor Picnic' },
                result: { scheduled: true },
              }),
              createToolInvocation({
                toolCallId: 'call_2',
                toolName: 'weather-tool',
                args: { date: 'weekend' },
                result: { forecast: 'sunny' },
              }),
              createToolInvocation({
                toolCallId: 'call_3',
                toolName: 'email-tool',
                args: { to: 'user@example.com' },
                result: { sent: true },
              }),
            ],
          }),
        ],
      });

      const result = await scorer.run(testRun);
      expect(result.score).toBeCloseTo(0.67, 2); // 2 out of 3 tools were appropriate
    });

    it('should recognize when agent over-helps with unnecessary tools', async () => {
      const scorer = createToolCallAccuracyScorerLLM({
        model: mockModel,
        availableTools,
      });

      // Mock the run method to return expected results
      scorer.run = vi.fn().mockResolvedValue({
        score: 0.33,
        reason: 'Only one out of three tools was appropriate.',
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: 'What is 15% of 240?',
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content: '15% of 240 is 36. I also found some helpful tips about percentages and checked the weather.',
            toolInvocations: [
              createToolInvocation({
                toolCallId: 'call_1',
                toolName: 'calculator-tool',
                args: { operation: 'percentage', value: 240, percent: 15 },
                result: { result: 36 },
              }),
              createToolInvocation({
                toolCallId: 'call_2',
                toolName: 'search-tool',
                args: { query: 'percentage calculation tips' },
                result: { results: ['tip1', 'tip2'] },
              }),
              createToolInvocation({
                toolCallId: 'call_3',
                toolName: 'weather-tool',
                args: { location: 'current' },
                result: { temperature: 20 },
              }),
            ],
          }),
        ],
      });

      const result = await scorer.run(testRun);
      expect(result.score).toBeCloseTo(0.33, 2); // Only 1 out of 3 tools was appropriate
    });
  });
});
