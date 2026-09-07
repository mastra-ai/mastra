import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, mockValues, mockId } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod/v4';

import { Mastra } from '../..';
import { MessageList } from '../../agent/message-list';
import { EventEmitterPubSub } from '../../events';
import { loop } from '../../loop/loop';
import { MastraLanguageModelV2Mock } from '../../loop/test-utils/MastraLanguageModelV2Mock';
import { toolCallFilterProvider } from '../../processor-provider/providers';
import { InMemoryStore } from '../../storage';
import type { Processor } from '../index';

import { ToolCallFilter } from './tool-call-filter';

async function runFilter(filter: Processor, prompt: LanguageModelV2Prompt): Promise<LanguageModelV2Prompt> {
  const result = await filter.processLLMRequest?.({
    prompt,
    model: 'test-model' as any,
    stepNumber: 0,
    steps: [],
    state: {},
    abort: ((reason?: string) => {
      throw new Error(reason || 'Aborted');
    }) as (reason?: string) => never,
  } as any);

  return result?.prompt ?? prompt;
}

function toolCallPart(toolCallId: string, toolName: string, input: unknown = {}) {
  return { type: 'tool-call' as const, toolCallId, toolName, input };
}

function toolResultPart(toolCallId: string, toolName: string, output: any = { type: 'text', value: 'result' }) {
  return { type: 'tool-result' as const, toolCallId, toolName, output };
}

function toolCallIdsIn(prompt: LanguageModelV2Prompt): string[] {
  return prompt.flatMap(message =>
    typeof message.content === 'string'
      ? []
      : (message.content as any[]).flatMap(part => (part.toolCallId ? [part.toolCallId] : [])),
  );
}

function textsIn(prompt: LanguageModelV2Prompt): string[] {
  return prompt.flatMap(message =>
    typeof message.content === 'string'
      ? [message.content]
      : (message.content as any[]).flatMap(part => (part.type === 'text' ? [part.text] : [])),
  );
}

describe('ToolCallFilter', () => {
  describe('exclude all tool calls (default)', () => {
    it('should exclude all tool calls and tool results', async () => {
      const prompt: LanguageModelV2Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'What is the weather?' }] },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Let me check.' }, toolCallPart('call-1', 'weather', { city: 'NYC' })],
        },
        { role: 'tool', content: [toolResultPart('call-1', 'weather', { type: 'text', value: 'Sunny, 72F' })] },
        { role: 'assistant', content: [{ type: 'text', text: 'It is sunny.' }] },
      ];

      const result = await runFilter(new ToolCallFilter(), prompt);

      expect(toolCallIdsIn(result)).toEqual([]);
      expect(textsIn(result)).toEqual(['What is the weather?', 'Let me check.', 'It is sunny.']);
      // The tool message became empty and was dropped rather than sent empty.
      expect(result.some(message => message.role === 'tool')).toBe(false);
    });

    it('should leave the prompt untouched when there are no tool calls', async () => {
      const prompt: LanguageModelV2Prompt = [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'Hi there!' }] },
      ];

      const result = await runFilter(new ToolCallFilter(), prompt);

      expect(result).toBe(prompt);
    });

    it('should handle an empty prompt', async () => {
      const result = await runFilter(new ToolCallFilter(), []);
      expect(result).toEqual([]);
    });

    it('should exclude multiple tool calls in sequence', async () => {
      const prompt: LanguageModelV2Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'Compare NYC and Boston' }] },
        { role: 'assistant', content: [toolCallPart('call-1', 'weather', { city: 'NYC' })] },
        { role: 'tool', content: [toolResultPart('call-1', 'weather')] },
        { role: 'assistant', content: [toolCallPart('call-2', 'weather', { city: 'Boston' })] },
        { role: 'tool', content: [toolResultPart('call-2', 'weather')] },
        { role: 'assistant', content: [{ type: 'text', text: 'Both are mild.' }] },
      ];

      const result = await runFilter(new ToolCallFilter(), prompt);

      expect(toolCallIdsIn(result)).toEqual([]);
      expect(result.map(message => message.role)).toEqual(['user', 'assistant']);
    });

    it('should drop a tool result that has no matching tool call', async () => {
      const prompt: LanguageModelV2Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'Hi' }] },
        { role: 'tool', content: [toolResultPart('orphan-call', 'weather')] },
      ];

      const result = await runFilter(new ToolCallFilter(), prompt);

      expect(toolCallIdsIn(result)).toEqual([]);
      expect(result.map(message => message.role)).toEqual(['user']);
    });
  });

  describe('exclude specific tool calls', () => {
    const mixedPrompt = (): LanguageModelV2Prompt => [
      { role: 'user', content: [{ type: 'text', text: 'Weather and math please' }] },
      {
        role: 'assistant',
        content: [toolCallPart('call-weather', 'weather'), toolCallPart('call-calc', 'calculator')],
      },
      {
        role: 'tool',
        content: [toolResultPart('call-weather', 'weather'), toolResultPart('call-calc', 'calculator')],
      },
    ];

    it('should exclude only the specified tool', async () => {
      const result = await runFilter(new ToolCallFilter({ exclude: ['weather'] }), mixedPrompt());

      expect(toolCallIdsIn(result)).toEqual(['call-calc', 'call-calc']);
    });

    it('should exclude multiple specified tools', async () => {
      const prompt: LanguageModelV2Prompt = [
        ...mixedPrompt(),
        { role: 'assistant', content: [toolCallPart('call-search', 'search')] },
        { role: 'tool', content: [toolResultPart('call-search', 'search')] },
      ];

      const result = await runFilter(new ToolCallFilter({ exclude: ['weather', 'search'] }), prompt);

      expect(toolCallIdsIn(result)).toEqual(['call-calc', 'call-calc']);
    });

    it('should remove the call and result as a pair, never leaving a dangling half', async () => {
      const result = await runFilter(new ToolCallFilter({ exclude: ['weather'] }), mixedPrompt());

      const ids = toolCallIdsIn(result);
      expect(ids.filter(id => id === 'call-weather')).toEqual([]);
      // calculator keeps exactly one call and one result
      expect(ids.filter(id => id === 'call-calc')).toHaveLength(2);
    });

    it('should keep tool calls that are not in the exclude list', async () => {
      const result = await runFilter(new ToolCallFilter({ exclude: ['unused-tool'] }), mixedPrompt());

      expect(result).toEqual(mixedPrompt());
    });

    it('should not transform anything when the exclude list is empty', async () => {
      const prompt = mixedPrompt();
      const result = await runFilter(new ToolCallFilter({ exclude: [] }), prompt);

      expect(result).toBe(prompt);
    });
  });

  describe('preserveModelOutput', () => {
    const searchPrompt = (): LanguageModelV2Prompt => [
      { role: 'user', content: [{ type: 'text', text: 'Search and summarize' }] },
      {
        role: 'assistant',
        content: [toolCallPart('call-search', 'search', { query: 'SECRET_QUERY' })],
      },
      {
        role: 'tool',
        content: [toolResultPart('call-search', 'search', { type: 'text', value: 'Compact search summary' })],
      },
    ];

    it('drops the output entirely when preserveModelOutput is off', async () => {
      const result = await runFilter(new ToolCallFilter(), searchPrompt());

      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('Compact search summary');
      expect(serialized).not.toContain('SECRET_QUERY');
    });

    it('replaces the filtered tool call with its compact model output as text', async () => {
      const result = await runFilter(new ToolCallFilter({ preserveModelOutput: true }), searchPrompt());

      expect(textsIn(result)).toContain('search result:\nCompact search summary');
      expect(JSON.stringify(result)).not.toContain('SECRET_QUERY');
      expect(toolCallIdsIn(result)).toEqual([]);
      // The text lands in the assistant message so role ordering stays valid.
      expect(result.map(message => message.role)).toEqual(['user', 'assistant']);
    });

    it('preserves model output only for the tools being filtered', async () => {
      const prompt: LanguageModelV2Prompt = [
        ...searchPrompt(),
        { role: 'assistant', content: [toolCallPart('call-calc', 'calculator')] },
        { role: 'tool', content: [toolResultPart('call-calc', 'calculator', { type: 'text', value: '42' })] },
      ];

      const result = await runFilter(new ToolCallFilter({ exclude: ['search'], preserveModelOutput: true }), prompt);

      expect(textsIn(result)).toContain('search result:\nCompact search summary');
      expect(toolCallIdsIn(result)).toEqual(['call-calc', 'call-calc']);
    });

    it('supports text, primitive, array, and json output shapes', async () => {
      const prompt: LanguageModelV2Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'Run everything' }] },
        {
          role: 'assistant',
          content: [
            toolCallPart('call-text', 'textTool'),
            toolCallPart('call-json', 'jsonTool'),
            toolCallPart('call-content', 'contentTool'),
          ],
        },
        {
          role: 'tool',
          content: [
            toolResultPart('call-text', 'textTool', { type: 'text', value: 'plain text' }),
            toolResultPart('call-json', 'jsonTool', { type: 'json', value: { total: 7 } }),
            toolResultPart('call-content', 'contentTool', {
              type: 'content',
              value: [
                { type: 'text', text: 'first' },
                { type: 'text', text: 'second' },
              ],
            }),
          ],
        },
      ];

      const result = await runFilter(new ToolCallFilter({ preserveModelOutput: true }), prompt);
      const texts = textsIn(result);

      expect(texts).toContain('textTool result:\nplain text');
      expect(texts).toContain('jsonTool result:\n{"total":7}');
      expect(texts).toContain('contentTool result:\nfirst\nsecond');
    });

    it('drops model output that cannot be represented as text', async () => {
      const circular: any = { name: 'CIRCULAR' };
      circular.self = circular;

      const prompt: LanguageModelV2Prompt = [
        { role: 'assistant', content: [toolCallPart('call-circular', 'circularTool')] },
        { role: 'tool', content: [toolResultPart('call-circular', 'circularTool', { type: 'json', value: circular })] },
      ];

      const result = await runFilter(new ToolCallFilter({ preserveModelOutput: true }), prompt);

      expect(JSON.stringify(result)).not.toContain('circularTool result');
      expect(JSON.stringify(result)).not.toContain('CIRCULAR');
      expect(result).toEqual([]);
    });
  });

  describe('filterAfterToolSteps', () => {
    const threeStepPrompt = (): LanguageModelV2Prompt => [
      { role: 'user', content: [{ type: 'text', text: 'Check three cities' }] },
      { role: 'assistant', content: [toolCallPart('call-1', 'weather')] },
      { role: 'tool', content: [toolResultPart('call-1', 'weather')] },
      { role: 'assistant', content: [toolCallPart('call-2', 'weather')] },
      { role: 'tool', content: [toolResultPart('call-2', 'weather')] },
      { role: 'assistant', content: [toolCallPart('call-3', 'weather')] },
      { role: 'tool', content: [toolResultPart('call-3', 'weather')] },
    ];

    it('preserves the most recent tool step', async () => {
      const result = await runFilter(new ToolCallFilter({ filterAfterToolSteps: 1 }), threeStepPrompt());

      expect(new Set(toolCallIdsIn(result))).toEqual(new Set(['call-3']));
    });

    it('preserves the most recent two tool steps', async () => {
      const result = await runFilter(new ToolCallFilter({ filterAfterToolSteps: 2 }), threeStepPrompt());

      expect(new Set(toolCallIdsIn(result))).toEqual(new Set(['call-2', 'call-3']));
    });

    it('filters every tool step when filterAfterToolSteps is 0', async () => {
      const result = await runFilter(new ToolCallFilter({ filterAfterToolSteps: 0 }), threeStepPrompt());

      expect(toolCallIdsIn(result)).toEqual([]);
    });

    it('only preserves recent steps for tools that are being excluded', async () => {
      const prompt: LanguageModelV2Prompt = [
        { role: 'assistant', content: [toolCallPart('call-1', 'weather')] },
        { role: 'tool', content: [toolResultPart('call-1', 'weather')] },
        { role: 'assistant', content: [toolCallPart('call-2', 'calculator')] },
        { role: 'tool', content: [toolResultPart('call-2', 'calculator')] },
      ];

      const result = await runFilter(
        new ToolCallFilter({ exclude: ['weather'], filterAfterToolSteps: 1 }),
        // Most recent step is the calculator, which is not excluded anyway,
        // so the older weather call is still filtered.
        prompt,
      );

      expect(new Set(toolCallIdsIn(result))).toEqual(new Set(['call-2']));
    });
  });

  describe('processor provider config', () => {
    const prompt = (): LanguageModelV2Prompt => [
      { role: 'assistant', content: [toolCallPart('call-search', 'search', { query: 'SECRET_QUERY' })] },
      {
        role: 'tool',
        content: [toolResultPart('call-search', 'search', { type: 'text', value: 'Compact search summary' })],
      },
    ];

    it('exposes filterAfterToolSteps and preserveModelOutput', async () => {
      const parsedConfig = toolCallFilterProvider.configSchema.parse({
        filterAfterToolSteps: 0,
        preserveModelOutput: true,
      });
      const processor = toolCallFilterProvider.createProcessor(parsedConfig);

      const result = await runFilter(processor, prompt());

      expect(textsIn(result)).toContain('search result:\nCompact search summary');
      expect(JSON.stringify(result)).not.toContain('SECRET_QUERY');
    });

    it('exposes preserveModelOutput', async () => {
      const parsedConfig = toolCallFilterProvider.configSchema.parse({ preserveModelOutput: true });
      const processor = toolCallFilterProvider.createProcessor(parsedConfig);

      const result = await runFilter(processor, prompt());

      expect(textsIn(result)).toContain('search result:\nCompact search summary');
    });
  });

  describe('integration: multi-step agent loop with ToolCallFilter', () => {
    let mastra: Mastra;
    beforeEach(async () => {
      mastra = new Mastra({
        logger: false,
        storage: new InMemoryStore(),
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startWorkers();
    });
    afterEach(async () => {
      await mastra.stopWorkers();
    });
    it('should filter tool calls older than filterAfterToolSteps in a real agent loop while preserving recent tool results and text', async () => {
      const stepInputs: any[] = [];
      let responseCount = 0;

      const messageList = new MessageList();
      messageList.add(
        {
          id: 'msg-user',
          role: 'user',
          content: [{ type: 'text', text: 'What is the weather in NYC?' }],
        },
        'input',
      );

      const result = await loop({
        methodType: 'stream',
        runId: 'test-toolcallfilter-integration',
        models: [
          {
            id: 'test-model',
            maxRetries: 0,
            model: new MastraLanguageModelV2Mock({
              doStream: async ({ prompt }: { prompt: unknown }) => {
                stepInputs.push(prompt);

                switch (responseCount++) {
                  case 0:
                    // Step 1: LLM calls the weather tool
                    return {
                      stream: convertArrayToReadableStream([
                        {
                          type: 'response-metadata',
                          id: 'resp-0',
                          modelId: 'mock-model-id',
                          timestamp: new Date(0),
                        },
                        {
                          type: 'tool-call',
                          id: 'call-weather-1',
                          toolCallId: 'call-weather-1',
                          toolName: 'weather',
                          input: '{ "city": "NYC" }',
                        },
                        {
                          type: 'finish',
                          finishReason: 'tool-calls',
                          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                        },
                      ]),
                    };
                  case 1:
                    // Step 2: LLM calls another tool; step 1 tool data should still be available.
                    return {
                      stream: convertArrayToReadableStream([
                        {
                          type: 'response-metadata',
                          id: 'resp-1',
                          modelId: 'mock-model-id',
                          timestamp: new Date(1000),
                        },
                        {
                          type: 'tool-call',
                          id: 'call-weather-2',
                          toolCallId: 'call-weather-2',
                          toolName: 'weather',
                          input: '{ "city": "Brooklyn" }',
                        },
                        {
                          type: 'finish',
                          finishReason: 'tool-calls',
                          usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
                        },
                      ]),
                    };
                  case 2:
                    // Step 3: LLM responds with text; step 1 tool data is old enough to filter.
                    return {
                      stream: convertArrayToReadableStream([
                        {
                          type: 'response-metadata',
                          id: 'resp-2',
                          modelId: 'mock-model-id',
                          timestamp: new Date(2000),
                        },
                        { type: 'text-start', id: 'text-1' },
                        { type: 'text-delta', id: 'text-1', delta: 'The weather in NYC is sunny.' },
                        { type: 'text-end', id: 'text-1' },
                        {
                          type: 'finish',
                          finishReason: 'stop',
                          usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
                        },
                      ]),
                    };
                  default:
                    throw new Error(`Unexpected response count: ${responseCount}`);
                }
              },
            }),
          },
        ],
        inputProcessors: [new ToolCallFilter({ filterAfterToolSteps: 1 })],
        tools: {
          weather: {
            inputSchema: z.object({ city: z.string() }),
            execute: async ({ city }: { city: string }) => `Sunny, 72°F in ${city}`,
          },
        },
        messageList,
        stopWhen: stepCountIs(4),
        _internal: {
          now: mockValues(0, 100, 500, 600, 1000),
          generateId: mockId({ prefix: 'id' }),
        },
        agentId: 'test-agent',
        mastra,
      });

      await result.consumeStream();

      expect(stepInputs).toHaveLength(3);

      const step1Prompt = stepInputs[0] as any[];
      const step1UserMsg = step1Prompt.find((m: any) => m.role === 'user');
      expect(step1UserMsg).toBeDefined();
      expect(step1UserMsg.content.some((p: any) => p.type === 'text' && p.text.includes('NYC'))).toBe(true);

      const step2Prompt = stepInputs[1] as any[];
      const step2UserMsg = step2Prompt.find((m: any) => m.role === 'user');
      expect(step2UserMsg).toBeDefined();
      expect(step2UserMsg.content.some((p: any) => p.type === 'text' && p.text.includes('NYC'))).toBe(true);
      expect(
        step2Prompt.some(
          (msg: any) =>
            msg.role === 'assistant' &&
            msg.content?.some((p: any) => p.type === 'tool-call' && p.toolCallId === 'call-weather-1'),
        ),
      ).toBe(true);
      expect(
        step2Prompt.some(
          (msg: any) =>
            msg.role === 'tool' &&
            msg.content?.some((p: any) => p.type === 'tool-result' && p.toolCallId === 'call-weather-1'),
        ),
      ).toBe(true);

      const step3Prompt = stepInputs[2] as any[];
      const step3UserMsg = step3Prompt.find((m: any) => m.role === 'user');
      expect(step3UserMsg).toBeDefined();
      expect(step3UserMsg.content.some((p: any) => p.type === 'text' && p.text.includes('NYC'))).toBe(true);
      expect(
        step3Prompt.some((msg: any) =>
          msg.content?.some((p: any) => p.toolCallId === 'call-weather-1' || p.toolCallId === 'call-weather-2'),
        ),
      ).toBe(true);
      expect(step3Prompt.some((msg: any) => msg.content?.some((p: any) => p.toolCallId === 'call-weather-1'))).toBe(
        false,
      );
      expect(step3Prompt.some((msg: any) => msg.content?.some((p: any) => p.toolCallId === 'call-weather-2'))).toBe(
        true,
      );
    });

    it('should preserve the last two tool-call steps with filterAfterToolSteps 2', async () => {
      const stepInputs: any[] = [];
      let responseCount = 0;

      const messageList = new MessageList();
      messageList.add(
        {
          id: 'msg-user-filter-after-two',
          role: 'user',
          content: [{ type: 'text', text: 'Check weather in NYC, Brooklyn, and Queens.' }],
        },
        'input',
      );

      const result = await loop({
        methodType: 'stream',
        runId: 'test-toolcallfilter-after-two-integration',
        models: [
          {
            id: 'test-model',
            maxRetries: 0,
            model: new MastraLanguageModelV2Mock({
              doStream: async ({ prompt }: { prompt: unknown }) => {
                stepInputs.push(prompt);
                const currentResponse = responseCount++;
                const toolCallId = `call-weather-${currentResponse + 1}`;
                const cities = ['NYC', 'Brooklyn', 'Queens'];

                if (currentResponse < 3) {
                  return {
                    stream: convertArrayToReadableStream([
                      {
                        type: 'response-metadata',
                        id: `resp-${currentResponse}`,
                        modelId: 'mock-model-id',
                        timestamp: new Date(currentResponse * 1000),
                      },
                      {
                        type: 'tool-call',
                        id: toolCallId,
                        toolCallId,
                        toolName: 'weather',
                        input: `{ "city": "${cities[currentResponse]}" }`,
                      },
                      {
                        type: 'finish',
                        finishReason: 'tool-calls',
                        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                      },
                    ]),
                  };
                }

                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'response-metadata',
                      id: 'resp-3',
                      modelId: 'mock-model-id',
                      timestamp: new Date(3000),
                    },
                    { type: 'text-start', id: 'text-1' },
                    { type: 'text-delta', id: 'text-1', delta: 'Done checking weather.' },
                    { type: 'text-end', id: 'text-1' },
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
                    },
                  ]),
                };
              },
            }),
          },
        ],
        inputProcessors: [new ToolCallFilter({ filterAfterToolSteps: 2 })],
        tools: {
          weather: {
            inputSchema: z.object({ city: z.string() }),
            execute: async ({ city }: { city: string }) => `Sunny in ${city}`,
          },
        },
        messageList,
        stopWhen: stepCountIs(5),
        _internal: {
          now: mockValues(0, 100, 500, 600, 1000, 1100, 1500, 1600, 2000, 2100),
          generateId: mockId({ prefix: 'id' }),
        },
        agentId: 'test-agent',
        mastra,
      });

      await result.consumeStream();

      expect(stepInputs).toHaveLength(4);

      const step3Prompt = stepInputs[2] as any[];
      expect(step3Prompt.some((msg: any) => msg.content?.some((p: any) => p.toolCallId === 'call-weather-1'))).toBe(
        true,
      );
      expect(step3Prompt.some((msg: any) => msg.content?.some((p: any) => p.toolCallId === 'call-weather-2'))).toBe(
        true,
      );

      const step4Prompt = stepInputs[3] as any[];
      expect(step4Prompt.some((msg: any) => msg.content?.some((p: any) => p.toolCallId === 'call-weather-1'))).toBe(
        false,
      );
      expect(step4Prompt.some((msg: any) => msg.content?.some((p: any) => p.toolCallId === 'call-weather-2'))).toBe(
        true,
      );
      expect(step4Prompt.some((msg: any) => msg.content?.some((p: any) => p.toolCallId === 'call-weather-3'))).toBe(
        true,
      );
    });

    it('should filter remembered tool calls but keep tool calls made during the current run by default', async () => {
      const stepInputs: any[] = [];
      let responseCount = 0;

      const messageList = new MessageList();
      messageList.add(
        [
          { id: 'remembered-user', role: 'user', content: [{ type: 'text', text: 'Weather in Paris?' }] },
          {
            id: 'remembered-assistant',
            role: 'assistant',
            content: [
              {
                type: 'tool-call' as const,
                toolCallId: 'remembered-call',
                toolName: 'weather',
                input: { city: 'Paris' },
              },
            ],
          },
          {
            id: 'remembered-tool',
            role: 'tool',
            content: [
              {
                type: 'tool-result' as const,
                toolCallId: 'remembered-call',
                toolName: 'weather',
                output: { type: 'text' as const, value: 'Sunny in Paris' },
              },
            ],
          },
        ],
        'memory',
      );
      messageList.add({ id: 'msg-user-default', role: 'user', content: 'What about NYC?' }, 'input');

      const result = await loop({
        methodType: 'stream',
        runId: 'test-toolcallfilter-default-integration',
        models: [
          {
            id: 'test-model',
            maxRetries: 0,
            model: new MastraLanguageModelV2Mock({
              doStream: async ({ prompt }: { prompt: unknown }) => {
                stepInputs.push(prompt);

                if (responseCount++ === 0) {
                  return {
                    stream: convertArrayToReadableStream([
                      { type: 'response-metadata', id: 'resp-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                      {
                        type: 'tool-call',
                        id: 'call-weather-current',
                        toolCallId: 'call-weather-current',
                        toolName: 'weather',
                        input: '{ "city": "NYC" }',
                      },
                      {
                        type: 'finish',
                        finishReason: 'tool-calls',
                        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                      },
                    ]),
                  };
                }

                return {
                  stream: convertArrayToReadableStream([
                    { type: 'response-metadata', id: 'resp-1', modelId: 'mock-model-id', timestamp: new Date(1000) },
                    { type: 'text-start', id: 'text-1' },
                    { type: 'text-delta', id: 'text-1', delta: 'Sunny in NYC.' },
                    { type: 'text-end', id: 'text-1' },
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
                    },
                  ]),
                };
              },
            }),
          },
        ],
        inputProcessors: [new ToolCallFilter()],
        tools: {
          weather: {
            inputSchema: z.object({ city: z.string() }),
            execute: async ({ city }: { city: string }) => `Sunny, 72°F in ${city}`,
          },
        },
        messageList,
        stopWhen: stepCountIs(4),
        _internal: {
          now: mockValues(0, 100, 500, 600, 1000),
          generateId: mockId({ prefix: 'id' }),
        },
        agentId: 'test-agent',
        mastra,
      });

      await result.consumeStream();

      expect(stepInputs).toHaveLength(2);

      // Remembered tool calls are filtered from every prompt.
      for (const prompt of stepInputs as any[][]) {
        expect(prompt.some((msg: any) => msg.content?.some?.((p: any) => p.toolCallId === 'remembered-call'))).toBe(
          false,
        );
      }

      // The tool call made during this run stays visible so the loop can use its result.
      const step2Prompt = stepInputs[1] as any[];
      expect(
        step2Prompt.some((msg: any) => msg.content?.some?.((p: any) => p.toolCallId === 'call-weather-current')),
      ).toBe(true);
    });
  });
});
