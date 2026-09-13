/**
 * DurableAgent output processor lifecycle guarantees (issue #22980).
 *
 * Three contracts the durable path must honor, mirroring the ordinary agent:
 * 1. A tool result goes through processToolResult exactly once (dedicated hook)
 *    and through processOutputStream exactly once (public stream) — not twice
 *    through the stream hook and never through the dedicated hook.
 * 2. A processOutputStep tripwire that requests a retry makes the durable agent
 *    call the model again (bounded by maxProcessorRetries), instead of ending
 *    the run.
 * 3. A terminal tripwire stays recorded, but the public durable stream still
 *    reaches its final finish chunk instead of terminating at the tripwire.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

function createToolCallingModel(toolName: string, toolArgs: Record<string, unknown>) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
        {
          type: 'tool-call',
          id: 'tc-1',
          toolCallType: 'function',
          toolCallId: 'tc-1',
          toolName,
          args: JSON.stringify(toolArgs),
        },
        {
          type: 'finish',
          finishReason: 'tool-calls',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

function createCountingTextModel(callCount: { value: number }) {
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount.value++;
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'resp-' + callCount.value, modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Hello.' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

function createTwoTextModel(callCount: { value: number }, texts: string[]) {
  return new MockLanguageModelV2({
    doStream: async () => {
      const n = ++callCount.value;
      const text = texts[Math.min(n - 1, texts.length - 1)];
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'resp-' + n, modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: text },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

async function drain(stream: ReadableStream<any>) {
  const out: any[] = [];
  for await (const c of stream) out.push(c);
  return out;
}

describe('DurableAgent output processor lifecycle', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('dispatches processToolResult once and processOutputStream once per tool result', async () => {
    // The hook mutates the stored tool invocation so the test proves the
    // mutation syncs into the emitted tool-result chunk, not just the call count.
    const processToolResult = vi.fn(async ({ messageList, toolCallId, toolName, toolArgs }: any) => {
      messageList.updateToolInvocation({
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          toolCallId,
          toolName,
          args: toolArgs,
          result: { temp: 999 },
        },
      });
    });
    const processOutputStream = vi.fn(async ({ part }: any) => part);

    const outputProcessor = {
      id: 'counting-processor',
      name: 'Counting Processor',
      processToolResult,
      processOutputStream,
    };

    const weatherTool = createTool({
      id: 'getWeather',
      description: 'Get weather',
      inputSchema: z.object({ city: z.string() }),
      outputSchema: z.object({ temp: z.number() }),
      execute: async () => ({ temp: 72 }),
    });

    const baseAgent = new Agent({
      id: 'lifecycle-agent',
      name: 'Lifecycle Agent',
      instructions: 'You are a helpful agent.',
      model: createToolCallingModel('getWeather', { city: 'NYC' }) as LanguageModelV2,
      tools: { getWeather: weatherTool },
      outputProcessors: [outputProcessor as any],
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'lifecycle-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const result = await durableAgent.stream('What is the weather in NYC?', {
      maxSteps: 3,
    });

    const chunks = await drain(result.fullStream);

    const streamToolResultCalls = processOutputStream.mock.calls.filter(
      ([ctx]: any[]) => ctx?.part?.type === 'tool-result',
    );

    expect(processToolResult).toHaveBeenCalledTimes(1);
    expect(streamToolResultCalls.length).toBe(1);

    // The public stream must carry the post-processor value, not the raw tool return.
    const toolResultChunks = chunks.filter((c: any) => c.type === 'tool-result');
    expect(toolResultChunks.length).toBe(1);
    expect(toolResultChunks[0]?.payload?.result).toEqual({ temp: 999 });
  });

  it('dispatches processToolResult once per tool call across suspend and resume', async () => {
    const processToolResult = vi.fn(async () => {});
    const outputProcessor = {
      id: 'approval-counting-processor',
      name: 'Approval Counting Processor',
      processToolResult,
    };

    let modelCall = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        modelCall++;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream<any>(
            modelCall === 1
              ? [
                  { type: 'stream-start', warnings: [] },
                  { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
                  {
                    type: 'tool-call',
                    toolCallType: 'function',
                    toolCallId: 'tc-approve-1',
                    toolName: 'getWeather',
                    input: '{"city":"NYC"}',
                    providerExecuted: false,
                  },
                  {
                    type: 'finish',
                    finishReason: 'tool-calls',
                    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                  },
                ]
              : [
                  { type: 'stream-start', warnings: [] },
                  { type: 'response-metadata', id: 'resp-2', modelId: 'mock', timestamp: new Date(0) },
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: 'Done' },
                  { type: 'text-end', id: 'text-1' },
                  { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
                ],
          ),
        };
      },
    });

    const weatherTool = createTool({
      id: 'getWeather',
      description: 'Get weather',
      inputSchema: z.object({ city: z.string() }),
      requireApproval: true,
      execute: async () => ({ temp: 72 }),
    });

    const baseAgent = new Agent({
      id: 'approval-lifecycle-agent',
      name: 'Approval Lifecycle Agent',
      instructions: 'You are a helpful agent.',
      model: model as LanguageModelV2,
      tools: { getWeather: weatherTool },
      memory: new MockMemory(),
      outputProcessors: [outputProcessor as any],
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'approval-lifecycle-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });
    const memory = { thread: 'approval-lifecycle-thread', resource: 'approval-lifecycle-resource' };

    const result = await durableAgent.stream('What is the weather in NYC?', { memory });
    let sawApproval = false;
    for await (const chunk of result.fullStream) {
      if (chunk.type === 'tool-call-approval') {
        sawApproval = true;
        break;
      }
    }
    expect(sawApproval).toBe(true);
    expect(processToolResult).not.toHaveBeenCalled();

    const resumed = await durableAgent.approveToolCall({ runId: result.runId, memory });
    const resumedChunks = await drain(resumed.fullStream);

    // The tool-call step ran once before the approval suspend and once after
    // resume, but the tool result must be processed and emitted exactly once.
    expect(processToolResult).toHaveBeenCalledTimes(1);
    expect(processToolResult.mock.calls[0]?.[0]).toMatchObject({ toolCallId: 'tc-approve-1', toolName: 'getWeather' });
    const toolResultChunks = resumedChunks.filter((c: any) => c.type === 'tool-result');
    expect(toolResultChunks.length).toBe(1);
    expect(toolResultChunks[0]?.payload?.toolCallId).toBe('tc-approve-1');
  });

  it('retries the model call when processOutputStep requests a retry', async () => {
    const callCount = { value: 0 };
    let outputStepCalls = 0;

    const retryProcessor = {
      id: 'retry-processor',
      name: 'Retry Processor',
      processOutputStep: vi.fn(async ({ abort }: any) => {
        outputStepCalls++;
        if (outputStepCalls === 1) {
          abort('not good enough', { retry: true });
        }
      }),
    };

    const baseAgent = new Agent({
      id: 'retry-agent',
      name: 'Retry Agent',
      instructions: 'You are a helpful agent.',
      model: createCountingTextModel(callCount) as unknown as LanguageModelV2,
      outputProcessors: [retryProcessor as any],
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'retry-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const result = await durableAgent.stream('Say something.', {
      maxProcessorRetries: 1,
    });

    await drain(result.fullStream);

    expect(outputStepCalls).toBe(2);
    expect(callCount.value).toBe(2);
  });

  it('terminates the run when the processor retry budget is exhausted', async () => {
    const callCount = { value: 0 };
    let outputStepCalls = 0;

    const alwaysRetryProcessor = {
      id: 'always-retry-processor',
      name: 'Always Retry Processor',
      processOutputStep: vi.fn(async ({ abort }: any) => {
        outputStepCalls++;
        abort('never good enough', { retry: true });
      }),
    };

    const baseAgent = new Agent({
      id: 'retry-budget-agent',
      name: 'Retry Budget Agent',
      instructions: 'You are a helpful agent.',
      model: createCountingTextModel(callCount) as unknown as LanguageModelV2,
      outputProcessors: [alwaysRetryProcessor as any],
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'retry-budget-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const result = await durableAgent.stream('Say something.', {
      maxProcessorRetries: 1,
    });

    const chunks = await drain(result.fullStream);

    // The budget allows one retry, so the model runs exactly twice and the
    // second denied retry ends the run as a terminal tripwire.
    expect(callCount.value).toBe(2);
    const tripwireChunks = chunks.filter((c: any) => c.type === 'tripwire');
    expect(tripwireChunks.length).toBeGreaterThan(0);
    expect(tripwireChunks[0]?.payload?.reason).toBe('never good enough');
    // The denied attempt is recorded as a tripped step, not dropped.
    const steps = await result.output.steps;
    expect(steps.some(step => step.tripwire?.reason === 'never good enough')).toBe(true);
  });

  it('excludes the rejected attempt text from the final output on processor retry', async () => {
    const callCount = { value: 0 };
    let outputStepCalls = 0;
    let finishData: any = null;

    const retryProcessor = {
      id: 'retry-processor',
      name: 'Retry Processor',
      processOutputStep: vi.fn(async ({ abort }: any) => {
        outputStepCalls++;
        if (outputStepCalls === 1) {
          abort('not good enough', { retry: true });
        }
      }),
    };

    const baseAgent = new Agent({
      id: 'retry-leak-agent',
      name: 'Retry Leak Agent',
      instructions: 'You are a helpful agent.',
      model: createTwoTextModel(callCount, ['REJECTED', 'ACCEPTED']) as unknown as LanguageModelV2,
      outputProcessors: [retryProcessor as any],
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'retry-leak-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const result = await durableAgent.stream('Say something.', {
      maxProcessorRetries: 1,
      onFinish: (data: any) => {
        finishData = data;
      },
    });

    await drain(result.fullStream);

    // The rejected attempt is closed as its own tripwire step, so its text is
    // excluded from the final output and only the accepted attempt remains.
    expect(await result.output.text).toBe('ACCEPTED');
    // The onFinish payload carries the same filtered text as the resolved output.
    expect(finishData).not.toBeNull();
    expect(finishData.text).toBe('ACCEPTED');
    const steps = await result.output.steps;
    expect(steps.length).toBe(2);
    expect(steps[0]?.tripwire).toBeTruthy();
    expect(steps[0]?.tripwire?.reason).toBe('not good enough');
    expect(steps[1]?.tripwire).toBeFalsy();
    expect(steps[1]?.text).toBe('ACCEPTED');
  });

  it('passes the incremented retryCount to processOutputStep on retry', async () => {
    const callCount = { value: 0 };
    const seenRetryCounts: number[] = [];
    let outputStepCalls = 0;

    const retryProcessor = {
      id: 'retry-count-processor',
      name: 'Retry Count Processor',
      processOutputStep: vi.fn(async ({ abort, retryCount }: any) => {
        seenRetryCounts.push(retryCount);
        outputStepCalls++;
        if (outputStepCalls === 1) {
          abort('not good enough', { retry: true });
        }
      }),
    };

    const baseAgent = new Agent({
      id: 'retry-count-agent',
      name: 'Retry Count Agent',
      instructions: 'You are a helpful agent.',
      model: createTwoTextModel(callCount, ['REJECTED', 'ACCEPTED']) as unknown as LanguageModelV2,
      outputProcessors: [retryProcessor as any],
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'retry-count-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const result = await durableAgent.stream('Say something.', {
      maxProcessorRetries: 1,
    });

    await drain(result.fullStream);

    // The retry attempt must observe retryCount 1, not the initial 0, so
    // processors can implement "retry once" logic.
    expect(seenRetryCounts).toEqual([0, 1]);
  });

  it('passes the incremented retryCount to every processor hook on retry', async () => {
    const callCount = { value: 0 };
    const seen: Record<string, number[]> = { input: [], request: [], response: [], step: [] };
    let outputStepCalls = 0;

    const hookProcessor = {
      id: 'all-hooks-processor',
      name: 'All Hooks Processor',
      processInputStep: vi.fn(async ({ retryCount }: any) => {
        seen.input!.push(retryCount);
      }),
      processLLMRequest: vi.fn(async ({ retryCount }: any) => {
        seen.request!.push(retryCount);
      }),
      processLLMResponse: vi.fn(async ({ retryCount }: any) => {
        seen.response!.push(retryCount);
      }),
      processOutputStep: vi.fn(async ({ abort, retryCount }: any) => {
        seen.step!.push(retryCount);
        outputStepCalls++;
        if (outputStepCalls === 1) {
          abort('not good enough', { retry: true });
        }
      }),
    };

    const baseAgent = new Agent({
      id: 'all-hooks-agent',
      name: 'All Hooks Agent',
      instructions: 'You are a helpful agent.',
      model: createTwoTextModel(callCount, ['REJECTED', 'ACCEPTED']) as unknown as LanguageModelV2,
      inputProcessors: [hookProcessor as any],
      outputProcessors: [hookProcessor as any],
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'all-hooks-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const result = await durableAgent.stream('Say something.', { maxProcessorRetries: 1 });
    await drain(result.fullStream);

    // Every hook on the retried attempt must see the incremented count, not
    // the value the step was entered with.
    expect(seen.step).toEqual([0, 1]);
    expect(seen.input).toEqual([0, 1]);
    expect(seen.request).toEqual([0, 1]);
    expect(seen.response).toEqual([0, 1]);
  });

  it('syncs a tool result cleared to undefined by processToolResult into the emitted chunk', async () => {
    const processToolResult = vi.fn(async ({ messageList, toolCallId, toolName, toolArgs }: any) => {
      messageList.updateToolInvocation({
        type: 'tool-invocation',
        toolInvocation: { state: 'result', toolCallId, toolName, args: toolArgs, result: undefined },
      });
    });

    const secretTool = createTool({
      id: 'getSecret',
      description: 'Get secret',
      inputSchema: z.object({ city: z.string() }),
      execute: async () => ({ secret: 'do-not-leak' }),
    });

    const baseAgent = new Agent({
      id: 'clear-result-agent',
      name: 'Clear Result Agent',
      instructions: 'You are a helpful agent.',
      model: createToolCallingModel('getSecret', { city: 'NYC' }) as LanguageModelV2,
      tools: { getSecret: secretTool },
      outputProcessors: [{ id: 'clearing-processor', name: 'Clearing Processor', processToolResult } as any],
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'clear-result-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const result = await durableAgent.stream('What is the secret?', { maxSteps: 3 });
    const chunks = await drain(result.fullStream);

    expect(processToolResult).toHaveBeenCalledTimes(1);
    const toolResultChunks = chunks.filter((c: any) => c.type === 'tool-result');
    expect(toolResultChunks.length).toBe(1);
    // A processor that redacts the result to undefined must not leak the raw value.
    expect(toolResultChunks[0]?.payload?.result).toBeUndefined();
  });

  it('carries the processor retry count across tool-call iterations', async () => {
    const callCount = { value: 0 };
    const seenRetryCounts: number[] = [];

    // Call 1: text (rejected, retry). Call 2: tool call (accepted). Call 3: text
    // on the next iteration (rejected again). With maxProcessorRetries: 1 the
    // budget was spent on call 1, so call 3 must be a terminal tripwire rather
    // than a fourth model call.
    const model = new MockLanguageModelV2({
      doStream: async () => {
        const n = ++callCount.value;
        const body: any[] =
          n === 2
            ? [
                {
                  type: 'tool-call',
                  id: 'tc-1',
                  toolCallType: 'function',
                  toolCallId: 'tc-1',
                  toolName: 'getWeather',
                  args: JSON.stringify({ city: 'NYC' }),
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                },
              ]
            : [
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: `attempt-${n}` },
                { type: 'text-end', id: 'text-1' },
                { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
              ];
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'resp-' + n, modelId: 'mock', timestamp: new Date(0) },
            ...body,
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    });

    const rejectTextProcessor = {
      id: 'reject-text-processor',
      name: 'Reject Text Processor',
      processOutputStep: vi.fn(async ({ abort, retryCount, text }: any) => {
        seenRetryCounts.push(retryCount);
        if (text) {
          abort('not good enough', { retry: true });
        }
      }),
    };

    const weatherTool = createTool({
      id: 'getWeather',
      description: 'Get weather',
      inputSchema: z.object({ city: z.string() }),
      execute: async () => ({ temp: 72 }),
    });

    const baseAgent = new Agent({
      id: 'retry-carry-agent',
      name: 'Retry Carry Agent',
      instructions: 'You are a helpful agent.',
      model: model as unknown as LanguageModelV2,
      tools: { getWeather: weatherTool },
      outputProcessors: [rejectTextProcessor as any],
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'retry-carry-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const result = await durableAgent.stream('What is the weather in NYC?', {
      maxProcessorRetries: 1,
      maxSteps: 5,
    });

    const chunks = await drain(result.fullStream);

    expect(callCount.value).toBe(3);
    // The count survives the tool-call iteration: the third call sees 1, not 0.
    expect(seenRetryCounts).toEqual([0, 1, 1]);
    const tripwireChunks = chunks.filter((c: any) => c.type === 'tripwire');
    expect(tripwireChunks.length).toBe(1);
    expect(chunks[chunks.length - 1]?.type).toBe('finish');
  });

  it('reaches finish after a terminal tripwire and keeps the tripwire recorded', async () => {
    const tripwireProcessor = {
      id: 'blocking-processor',
      name: 'Blocking Processor',
      processOutputStep: vi.fn(async ({ abort }: any) => {
        abort('blocked content', { metadata: { k: 1 } });
      }),
    };

    const baseAgent = new Agent({
      id: 'tripwire-agent',
      name: 'Tripwire Agent',
      instructions: 'You are a helpful agent.',
      model: createCountingTextModel({ value: 0 }) as unknown as LanguageModelV2,
      outputProcessors: [tripwireProcessor as any],
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'tripwire-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const result = await durableAgent.stream('Say something.', {});

    const chunks = await drain(result.fullStream);

    const tripwireChunks = chunks.filter((c: any) => c.type === 'tripwire');
    expect(tripwireChunks.length).toBeGreaterThan(0);
    // The terminal tripwire must also land in the recorded output steps, not
    // just the live stream, so recall surfaces why the run stopped.
    const steps = await result.output.steps;
    expect(steps.some(step => step.tripwire?.reason === 'blocked content')).toBe(true);
    const last = chunks[chunks.length - 1];
    expect(last.type).toBe('finish');
    // The finish chunk must not overwrite the full tripwire with the generic
    // fallback: reason, metadata and processorId survive on the result.
    expect(result.output.tripwire).toEqual({
      reason: 'blocked content',
      retry: undefined,
      metadata: { k: 1 },
      processorId: 'blocking-processor',
    });
  });
});
