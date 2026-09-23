import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { estimateTokenCount } from 'tokenx';
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
import { getToolResultInputProcessors } from '../loop/workflows/agentic-execution/tool-result-processors';
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

    const capturing = new CapturingProcessor();

    const settings = defaultSettings();
    const result = await loop({
      ...settings,
      mastra: mastraRef.current as any,
      methodType: 'stream',
      runId: 'provider-tool-result-run',
      messageList: createMessageListWithUserMessage(),
      // One instance across both lists, mirroring the agent: inputProcessors and
      // llmRequestInputProcessors are two views of the same resolved registrations.
      inputProcessors: [capturing],
      llmRequestInputProcessors: [capturing],
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

describe('cross-phase deduplication is by instance, not id', () => {
  /**
   * `id` is a public, user-chosen string that distinct instances routinely share:
   * every `new TokenLimiterProcessor()` reports 'token-limiter'. Deduplicating on it
   * silently dropped an input-registered processor whenever an unrelated output
   * processor happened to share the name.
   */
  it('keeps two distinct instances that share an id and drops a genuine repeat', async () => {
    const calls: string[] = [];

    class Tagged implements Processor {
      readonly id = 'shared-id';
      constructor(private tag: string) {}
      async processToolResult() {
        calls.push(this.tag);
      }
    }

    const onInput = new Tagged('input');
    const onOutput = new Tagged('output');
    const shared = new Tagged('shared');

    const selected = getToolResultInputProcessors({
      // `shared` appears twice across the two input lists: one registration, runs once.
      inputProcessors: [onInput, shared],
      llmRequestInputProcessors: [shared],
      outputProcessors: [onOutput],
    });

    // onInput and shared survive; onOutput is reached through the output list instead.
    expect(selected).toHaveLength(2);
    expect(selected).toContain(onInput);
    expect(selected).toContain(shared);
    expect(selected).not.toContain(onOutput);
  });

  it('drops an instance already registered as an output processor', () => {
    class Noop implements Processor {
      readonly id = 'noop';
      async processToolResult() {}
    }

    const both = new Noop();
    expect(getToolResultInputProcessors({ inputProcessors: [both], outputProcessors: [both] })).toHaveLength(0);
  });
});

describe('tool results that resist serialization', () => {
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

  /**
   * A provider-executed result is whatever the provider put on the wire, and
   * ProcessToolResultArgs types it as unknown. Measuring it with a bare
   * JSON.stringify throws on a BigInt or a cycle, which would turn an oversized-result
   * guard into a crash on the run it was meant to protect.
   */
  it.each([
    ['a BigInt', () => ({ total: 10n })],
    [
      'a circular reference',
      () => {
        const node: any = { name: 'root' };
        node.self = node;
        return node;
      },
    ],
    [
      'a throwing toJSON',
      () => ({
        toJSON() {
          throw new Error('nope');
        },
      }),
    ],
  ])('does not throw when a tool returns %s', async (_label, makeResult) => {
    const tool = createTool({
      id: 'hostileTool',
      description: 'returns something awkward',
      inputSchema: z.object({}),
      execute: async () => makeResult(),
    });

    const agent = new Agent({
      name: 'hostile-result-agent',
      instructions: 'test',
      model: makeMockToolCallModel('hostileTool', 'call-hostile', {}),
      inputProcessors: [new TokenLimiterProcessor({ limit: 500, maxToolResultTokens: 10 })],
    });

    const stream = await agent.stream('go', { toolsets: { default: { hostileTool: tool } } });
    await expect(stream.text).resolves.toBeDefined();
  });
});

describe('setResult replaces the tool result everywhere it travels', () => {
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

  /**
   * A provider that emits the call and the result in one stream has no tool-invocation
   * part to edit while processToolResult runs — history is assembled from the chunks
   * afterwards. messageList.updateToolInvocation is a no-op there, so a processor that
   * used it bounded nothing: the raw result still reached history and the next call.
   * setResult has to land in all three places.
   */
  it('applies a provider-executed replacement to the stream chunk, history, and the next model call', async () => {
    const RAW = 'RAW_PROVIDER_PAYLOAD';
    const REPLACED = 'REPLACED_BY_PROCESSOR';

    class ReplacingProcessor implements Processor {
      readonly id = 'replacing';
      async processToolResult({ setResult }: any) {
        setResult(REPLACED);
      }
    }

    const prompts: any[] = [];
    let call = 0;
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        prompts.push(prompt);
        call++;
        if (call === 1) {
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'tool-input-start', id: 'call-1', toolName: 'web_search', providerExecuted: true },
              { type: 'tool-input-delta', id: 'call-1', delta: '{ "value": "v" }' },
              { type: 'tool-input-end', id: 'call-1' },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'web_search',
                input: '{ "value": "v" }',
                providerExecuted: true,
              },
              {
                type: 'tool-result',
                toolCallId: 'call-1',
                toolName: 'web_search',
                result: RAW,
                providerExecuted: true,
              },
              { type: 'finish', finishReason: 'tool-calls', usage: testUsage },
            ]),
            rawCall: { rawPrompt: [], rawSettings: {} },
            warnings: [],
          };
        }
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'v1' },
            { type: 'text-delta', id: 'v1', delta: 'done' },
            { type: 'text-end', id: 'v1' },
            { type: 'finish', finishReason: 'stop', usage: testUsage },
          ]),
          rawCall: { rawPrompt: [], rawSettings: {} },
          warnings: [],
        };
      },
    });

    const memory = new MockMemory();
    const agent = new Agent({
      name: 'provider-replacement-agent',
      instructions: 'test',
      model,
      memory,
      inputProcessors: [new ReplacingProcessor()],
    });

    const stream = await agent.stream('search please', {
      memory: { thread: 'thread-replace', resource: 'resource-replace' },
    });

    const toolResultChunks: any[] = [];
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-result') toolResultChunks.push(chunk);
    }
    await stream.text;

    // 1. the stream chunk the client sees
    const chunkValues = toolResultChunks.map(c => c.payload.result);
    expect(chunkValues).toContain(REPLACED);
    expect(chunkValues).not.toContain(RAW);

    // 2. the next model call
    expect(prompts).toHaveLength(2);
    const secondPrompt = JSON.stringify(prompts[1]);
    expect(secondPrompt).toContain(REPLACED);
    expect(secondPrompt).not.toContain(RAW);

    // 3. persisted history
    const recalled = await memory.recall({ threadId: 'thread-replace', resourceId: 'resource-replace' });
    const persisted = JSON.stringify(recalled.messages);
    expect(persisted).toContain(REPLACED);
    expect(persisted).not.toContain(RAW);
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

  // An MCP media result is structured data the output converter turns into native
  // image/audio parts. Serializing it to JSON to measure tokens would destroy that shape,
  // so the cap has to leave it alone even when it is well over the limit.
  it('leaves an MCP media tool result intact instead of flattening it to JSON', async () => {
    const mediaResult = {
      content: [
        { type: 'text', text: 'here is the chart' },
        { type: 'image', data: 'A'.repeat(4000), mimeType: 'image/png' },
      ],
    };

    let captured: unknown;
    const limiter = new TokenLimiterProcessor({ limit: 500, maxToolResultTokens: 10 });
    await limiter.processToolResult({
      result: mediaResult,
      setResult: (value: unknown) => {
        captured = value;
      },
    } as any);

    // No replacement at all: the structured shape reaches the converter untouched.
    expect(captured).toBeUndefined();
  });

  // Exempting the shape from capping is only half the job. Input trimming has to estimate
  // that media rather than tokenize its base64, or the message looks enormous and gets
  // trimmed away — losing the result and sending the model back to re-call the tool.
  it('estimates MCP media results during input trimming instead of counting base64 as text', async () => {
    const mediaResult = {
      content: [
        { type: 'text', text: 'here is the chart' },
        { type: 'image', data: 'A'.repeat(40_000), mimeType: 'image/png' },
      ],
    };

    const message = {
      id: 'm-media',
      role: 'assistant',
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'call-media',
              toolName: 'renderChart',
              args: {},
              result: mediaResult,
            },
          },
        ],
      },
    };

    const limiter = new TokenLimiterProcessor({ limit: 100_000 });
    const counted = await (limiter as any).countInputMessageTokens(message);

    // Tokenizing the 40k-char base64 would cost thousands of tokens; the flat image
    // estimate (765) keeps the message small enough to survive trimming.
    expect(counted).toBeLessThan(1000);
  });

  // A non-media object result is still capped as usual — the guard must not become a
  // blanket exemption for every object.
  it('still caps an oversized object result that carries no media', async () => {
    let captured: unknown;
    const limiter = new TokenLimiterProcessor({ limit: 500, maxToolResultTokens: 60 });
    await limiter.processToolResult({
      result: { content: [{ type: 'text', text: bigResult }] },
      setResult: (value: unknown) => {
        captured = value;
      },
    } as any);

    expect(typeof captured).toBe('string');
    expect(captured as string).toMatch(/\[truncated: showing \d+ of \d+ tokens]$/);
    expect(estimateTokenCount(captured as string)).toBeLessThanOrEqual(60);
  });

  // The marker costs tokens too. Slicing to the full cap and then appending it lands
  // over budget, and that overshoot is exactly what lets trimming evict the result.
  it('keeps the capped result, marker included, within the configured cap', async () => {
    for (const limit of [10, 25, 50, 200]) {
      let captured: unknown;
      const limiter = new TokenLimiterProcessor({ limit: 100_000, maxToolResultTokens: limit });
      await limiter.processToolResult({
        result: bigResult,
        setResult: (value: unknown) => {
          captured = value;
        },
      } as any);

      expect(typeof captured).toBe('string');
      expect(estimateTokenCount(captured as string)).toBeLessThanOrEqual(limit);
    }
  });

  // A cap smaller than the marker itself has no room for content. The result still has
  // to come back bounded rather than overshooting to fit the marker.
  it('stays bounded when the cap cannot fit the marker', async () => {
    let captured: unknown;
    const limiter = new TokenLimiterProcessor({ limit: 100_000, maxToolResultTokens: 2 });
    await limiter.processToolResult({
      result: bigResult,
      setResult: (value: unknown) => {
        captured = value;
      },
    } as any);

    expect(typeof captured).toBe('string');
    expect(captured as string).not.toContain('rule number');
    expect(estimateTokenCount(captured as string)).toBeLessThan(estimateTokenCount(bigResult));
  });

  // modelOutput is derived from the tool result, so a processor that replaces the result
  // has to leave the chunk's metadata describing the value that actually survived.
  it('recomputes modelOutput from the processed result, not the raw one', async () => {
    let executions = 0;
    const { model } = makeCountingModel('You have 200 rules.');
    const seenByToModelOutput: unknown[] = [];

    const agent = new Agent({
      id: 'token-limiter-tr-metadata-agent',
      name: 'Test Agent',
      instructions: 'tr',
      model: model as any,
      tools: {
        listRules: createTool({
          id: 'listRules',
          description: 'list rules',
          inputSchema: z.object({}),
          execute: async () => {
            executions++;
            return bigResult;
          },
          toModelOutput: (output: unknown) => {
            seenByToModelOutput.push(output);
            return { type: 'text', value: String(output) };
          },
        }) as any,
      },
      inputProcessors: [new TokenLimiterProcessor({ limit: 500, maxToolResultTokens: 50 })],
    });

    const stream = await agent.stream('how many rules do I have?', { maxSteps: 5 });
    for await (const _chunk of stream.fullStream) {
      // drain
    }

    expect(executions).toBe(1);
    // The last mapping sees the truncated value, so the metadata describes what the
    // model actually received rather than the evicted raw result.
    const last = seenByToModelOutput[seenByToModelOutput.length - 1];
    expect(String(last)).toMatch(/\[truncated: showing \d+ of \d+ tokens]$/);
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
    expect(toolResultChunkValue as string).toMatch(/\[truncated: showing \d+ of \d+ tokens]$/);
    expect((toolResultChunkValue as string).length).toBeLessThan(bigResult.length);

    // The model still gets the (bounded) result and answers from it in one more
    // call — it does not loop asking for the tool again.
    expect(executions).toBe(1);
    expect(prompts).toHaveLength(2);
    expect(text).toBe('You have 200 rules.');

    const secondPrompt = JSON.stringify(prompts[1]);
    expect(secondPrompt).toMatch(/\[truncated: showing \d+ of /);
    expect(secondPrompt.length).toBeLessThan(JSON.stringify(bigResult).length);
  });

  // The agent wraps even a single plain output processor in a processor workflow, so an
  // output-registered limiter reaches `processToolResult` through the workflow step rather
  // than the direct call. The replacement has to survive that route as well.
  it('truncates an oversized tool result for an output-registered limiter', async () => {
    let executions = 0;
    const { model, prompts } = makeCountingModel('You have 200 rules.');

    const agent = new Agent({
      id: 'token-limiter-tr-output-agent',
      name: 'Test Agent',
      instructions: 'tr',
      model: model as any,
      tools: { listRules: makeRulesTool(() => executions++) },
      outputProcessors: [new TokenLimiterProcessor({ limit: 500, maxToolResultTokens: 50 })],
    });

    const stream = await agent.stream('how many rules do I have?', { maxSteps: 5 });
    let toolResultChunkValue: unknown;
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-result') {
        toolResultChunkValue = (chunk as any).payload?.result ?? (chunk as any).result;
      }
    }

    expect(typeof toolResultChunkValue).toBe('string');
    expect(toolResultChunkValue as string).toMatch(/\[truncated: showing \d+ of \d+ tokens]$/);

    expect(executions).toBe(1);
    expect(JSON.stringify(prompts[1])).toMatch(/\[truncated: showing \d+ of /);
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
