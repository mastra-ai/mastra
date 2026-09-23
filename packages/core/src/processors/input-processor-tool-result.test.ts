import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';
import { loop } from '../loop/loop';
import {
  createMessageListWithUserMessage,
  createTestMastra,
  createTestModels,
  defaultSettings,
  mockDate,
  testUsage,
} from '../loop/test-utils/utils';
import type { Mastra } from '../mastra';
import { MockMemory } from '../memory/mock';
import { createTool } from '../tools';
import { TokenLimiterProcessor } from './processors/token-limiter';
import type { Processor } from './index';

/**
 * `processToolResult` used to fire only for processors registered as
 * `outputProcessors`. A processor registered as an `inputProcessor` — the
 * natural place for anything that shapes what the *next* LLM call sees, like
 * TokenLimiter — never saw tool results at all.
 */
const echoTool = createTool({
  id: 'echoTool',
  description: 'echo',
  inputSchema: z.object({ text: z.string() }),
  execute: async ({ text }) => `Echo: ${text}`,
});

const makeMockToolCallModel = (toolName: string, toolCallId = 'call-tr-1', toolInput = { text: 'hello' }) =>
  new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const hasToolResults = prompt.some(
        (msg: any) =>
          msg.role === 'tool' || (Array.isArray(msg.content) && msg.content.some((c: any) => c.type === 'tool-result')),
      );

      if (!hasToolResults) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'tool-call', toolCallId, toolName, input: JSON.stringify(toolInput) },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            },
          ]),
          rawCall: { rawPrompt: [], rawSettings: {} },
          warnings: [],
        };
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'done' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 } },
        ]),
        rawCall: { rawPrompt: [], rawSettings: {} },
        warnings: [],
      };
    },
  });

describe('input-registered processors receive processToolResult', () => {
  it('fires for a client-executed tool result', async () => {
    const calls: Array<{ toolName: string; toolCallId: string; result: unknown }> = [];

    class CapturingProcessor implements Processor {
      readonly id = 'input-capturing';
      async processToolResult({ toolName, toolCallId, result }: any) {
        calls.push({ toolName, toolCallId, result });
      }
    }

    const agent = new Agent({
      id: 'input-tr-agent-1',
      name: 'Test Agent',
      instructions: 'tr',
      model: makeMockToolCallModel('echoTool') as any,
      tools: { echoTool },
      inputProcessors: [new CapturingProcessor()],
    });

    const stream = await agent.stream('go', { maxSteps: 5 });
    for await (const _ of stream.fullStream) {
      void _;
    }

    expect(calls).toEqual([{ toolName: 'echoTool', toolCallId: 'call-tr-1', result: 'Echo: hello' }]);
  });

  it('can rewrite the result before it reaches history and the stream', async () => {
    class RedactingProcessor implements Processor {
      readonly id = 'input-redacting';
      async processToolResult({ messageList, toolCallId, toolName, args }: any) {
        messageList.updateToolInvocation({
          type: 'tool-invocation',
          toolInvocation: { state: 'result', toolCallId, toolName, args, result: '[REDACTED]' },
        });
      }
    }

    const agent = new Agent({
      id: 'input-tr-agent-2',
      name: 'Test Agent',
      instructions: 'tr',
      model: makeMockToolCallModel('echoTool') as any,
      tools: { echoTool },
      inputProcessors: [new RedactingProcessor()],
    });

    const stream = await agent.stream('go', { maxSteps: 5 });
    let toolResultChunkValue: unknown;
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-result') {
        toolResultChunkValue = (chunk as any).payload?.result ?? (chunk as any).result;
      }
    }

    expect(toolResultChunkValue).toBe('[REDACTED]');
  });

  it('runs a processor registered on both input and output exactly once per result', async () => {
    let callCount = 0;
    class CountingProcessor implements Processor {
      readonly id = 'both-sides';
      async processToolResult() {
        callCount++;
      }
    }
    const shared = new CountingProcessor();

    const agent = new Agent({
      id: 'input-tr-agent-3',
      name: 'Test Agent',
      instructions: 'tr',
      model: makeMockToolCallModel('echoTool') as any,
      tools: { echoTool },
      inputProcessors: [shared],
      outputProcessors: [shared],
    });

    const stream = await agent.stream('go', { maxSteps: 5 });
    for await (const _ of stream.fullStream) {
      void _;
    }

    expect(callCount).toBe(1);
  });
});

describe('input-registered processors receive provider-executed tool results', () => {
  let mastraRef: { current?: Mastra } = {};
  let dispose: (() => Promise<void>) | undefined;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(mockDate);
    const created = await createTestMastra();
    mastraRef.current = created.mastra;
    dispose = created.dispose;
  });

  afterEach(async () => {
    vi.useRealTimers();
    await dispose?.();
    mastraRef.current = undefined;
    dispose = undefined;
  });

  it('fires for a deferred provider-executed tool result', async () => {
    const calls: Array<{ toolName: string; providerExecuted?: boolean; result: unknown }> = [];

    class CapturingProcessor implements Processor {
      readonly id = 'provider-capturing';
      async processToolResult({ toolName, providerExecuted, result }: any) {
        calls.push({ toolName, providerExecuted, result });
      }
    }

    const settings = defaultSettings();
    const result = await loop({
      ...settings,
      mastra: mastraRef.current as any,
      methodType: 'stream',
      runId: 'provider-tool-result-run',
      messageList: createMessageListWithUserMessage(),
      inputProcessors: [new CapturingProcessor()],
      llmRequestInputProcessors: [new CapturingProcessor()],
      models: createTestModels({
        stream: convertArrayToReadableStream([
          { type: 'tool-input-start', id: 'call-1', toolName: 'web_search', providerExecuted: true },
          { type: 'tool-input-delta', id: 'call-1', delta: '{ "value": "value" }' },
          { type: 'tool-input-end', id: 'call-1' },
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'web_search',
            input: `{ "value": "value" }`,
            providerExecuted: true,
          },
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'web_search',
            result: `{ "value": "result1" }`,
            providerExecuted: true,
          },
          { type: 'finish', finishReason: 'stop', usage: testUsage },
        ]),
      }),
      tools: {
        web_search: {
          type: 'provider-defined',
          id: 'test.web_search',
          name: 'web_search',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          args: {},
        },
      },
    } as any);

    await result.consumeStream();

    expect(calls).toHaveLength(1);
    expect(calls[0]!.toolName).toBe('web_search');
    expect(calls[0]!.providerExecuted).toBe(true);
    expect(calls[0]!.result).toBe(`{ "value": "result1" }`);
  });
});

describe('TokenLimiter maxToolResultTokens', () => {
  const bigResult = 'rule number seven hundred and seventy seven. '.repeat(60);

  const makeCountingModel = (finalText: string) => {
    const prompts: any[] = [];
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        prompts.push(prompt);
        const hasToolResults = prompt.some(
          (msg: any) =>
            msg.role === 'tool' ||
            (Array.isArray(msg.content) && msg.content.some((c: any) => c.type === 'tool-result')),
        );

        if (!hasToolResults) {
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-rules',
                toolName: 'listRules',
                input: JSON.stringify({}),
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ]),
            rawCall: { rawPrompt: [], rawSettings: {} },
            warnings: [],
          };
        }
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: finalText },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 } },
          ]),
          rawCall: { rawPrompt: [], rawSettings: {} },
          warnings: [],
        };
      },
    });
    return { model, prompts };
  };

  const makeRulesTool = (onExecute: () => void) =>
    createTool({
      id: 'listRules',
      description: 'list rules',
      inputSchema: z.object({}),
      execute: async () => {
        onExecute();
        return bigResult;
      },
    });

  it('truncates an oversized tool result with a visible marker', async () => {
    let executions = 0;
    const { model, prompts } = makeCountingModel('You have 200 rules.');

    const agent = new Agent({
      id: 'token-limiter-tr-agent',
      name: 'Test Agent',
      instructions: 'tr',
      model: model as any,
      tools: { listRules: makeRulesTool(() => executions++) },
      inputProcessors: [new TokenLimiterProcessor({ limit: 500, maxToolResultTokens: 50 })],
    });

    const stream = await agent.stream('how many rules do I have?', { maxSteps: 5 });
    let toolResultChunkValue: unknown;
    let text = '';
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-result') {
        toolResultChunkValue = (chunk as any).payload?.result ?? (chunk as any).result;
      }
      if (chunk.type === 'text-delta') {
        text += (chunk as any).payload?.text ?? '';
      }
    }

    expect(typeof toolResultChunkValue).toBe('string');
    expect(toolResultChunkValue as string).toMatch(/\[truncated: showing 50 of \d+ tokens\]$/);
    expect((toolResultChunkValue as string).length).toBeLessThan(bigResult.length);

    // The model still gets the (bounded) result and answers from it in one more
    // call — it does not loop asking for the tool again.
    expect(executions).toBe(1);
    expect(prompts).toHaveLength(2);
    expect(text).toBe('You have 200 rules.');

    const secondPrompt = JSON.stringify(prompts[1]);
    expect(secondPrompt).toContain('[truncated: showing 50 of');
    expect(secondPrompt.length).toBeLessThan(JSON.stringify(bigResult).length);
  });

  /**
   * #24110: TokenLimiter evicted the current run's tool call/result, so the model
   * never saw what the tool returned and kept calling it again instead of
   * answering. With the result bounded by `maxToolResultTokens`, it survives into
   * the next prompt and the run terminates after a single tool execution.
   */
  it('lets the model answer from the tool result instead of looping (#24110)', async () => {
    const memory = new MockMemory();
    const threadId = 'token-limiter-loop-thread';
    const resourceId = 'token-limiter-loop-resource';

    // ~600 tokens of tool output against a 500 token conversation budget: without
    // a cap this message cannot fit, so the trim drops the tool result the run
    // just produced. Capped at 100 tokens it fits and survives into the prompt.
    const rulesResult = 'rule number seven hundred and seventy seven. '.repeat(60);
    let executions = 0;
    let modelCalls = 0;

    // Calls the tool on every turn until the prompt actually contains its
    // result, then answers from it. If the result is evicted, this loops.
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        modelCalls++;
        const promptText = JSON.stringify(prompt);
        const seesResult = promptText.includes('rule number seven hundred and seventy seven');

        if (!seesResult) {
          if (modelCalls > 5) throw new Error('model looped without ever seeing the tool result');
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: `id-${modelCalls}`, modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: `call-rules-${modelCalls}`,
                toolName: 'listRules',
                input: JSON.stringify({}),
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ]),
            rawCall: { rawPrompt: [], rawSettings: {} },
            warnings: [],
          };
        }

        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: `id-${modelCalls}`, modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'You have 200 rules.' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 } },
          ]),
          rawCall: { rawPrompt: [], rawSettings: {} },
          warnings: [],
        };
      },
    });

    const agent = new Agent({
      id: 'token-limiter-loop-agent',
      name: 'Test Agent',
      instructions: 'answer from the tool result',
      model: model as any,
      memory,
      tools: {
        listRules: createTool({
          id: 'listRules',
          description: 'list rules',
          inputSchema: z.object({}),
          execute: async () => {
            executions++;
            return rulesResult;
          },
        }),
      },
      inputProcessors: [new TokenLimiterProcessor({ limit: 500, maxToolResultTokens: 100 })],
    });

    const stream = await agent.stream('how many rules do I have?', {
      maxSteps: 5,
      memory: { thread: threadId, resource: resourceId },
    });

    let text = '';
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'text-delta') text += (chunk as any).payload?.text ?? '';
    }

    expect(modelCalls).toBe(2);
    expect(executions).toBe(1);
    expect(text).toBe('You have 200 rules.');

    const recalled = await memory.recall({ threadId, resourceId });
    expect(recalled.messages).toHaveLength(2);
  });

  it('leaves tool results untouched when maxToolResultTokens is unset', async () => {
    const { model } = makeCountingModel('done');

    const agent = new Agent({
      id: 'token-limiter-tr-agent-default',
      name: 'Test Agent',
      instructions: 'tr',
      model: model as any,
      tools: { listRules: makeRulesTool(() => {}) },
      inputProcessors: [new TokenLimiterProcessor({ limit: 500 })],
    });

    const stream = await agent.stream('how many rules do I have?', { maxSteps: 5 });
    let toolResultChunkValue: unknown;
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-result') {
        toolResultChunkValue = (chunk as any).payload?.result ?? (chunk as any).result;
      }
    }

    expect(toolResultChunkValue).toBe(bigResult);
  });
});
