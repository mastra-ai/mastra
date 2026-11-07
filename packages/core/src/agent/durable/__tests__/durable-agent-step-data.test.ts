/**
 * #26780: DurableAgent callbacks and results must carry the same step data as the
 * regular Agent — step response messages and model id in onStepFinish, output.steps
 * and onFinish — and a per-call `model` must be the model that runs.
 *
 * #27475: those step messages must not be resent in full on every step-finish chunk.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { CachingPubSub } from '../../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { AGENT_STREAM_TOPIC } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';

const probe = (requireApproval = false) =>
  createTool({
    id: 'probe',
    description: 'probe',
    inputSchema: z.object({ q: z.number() }),
    requireApproval,
    execute: async () => ({ ok: true }),
  });

function expectStepData(steps: any[], modelId: string) {
  expect(steps).toHaveLength(2);
  for (const step of steps) {
    expect(step.response?.modelId).toBe(modelId);
    expect(step.response?.messages?.length).toBeGreaterThan(0);
  }
}

function toolThenTextModel(modelId: string) {
  let calls = 0;
  const model = new MockLanguageModelV2({
    modelId,
    doStream: async () => {
      calls++;
      const parts =
        calls === 1
          ? [
              { type: 'tool-call', toolCallId: 'call-1', toolName: 'probe', input: '{"q":1}', providerExecuted: false },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]
          : [
              { type: 'text-start', id: 't' },
              { type: 'text-delta', id: 't', delta: 'done' },
              { type: 'text-end', id: 't' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
            ];
      return {
        stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, ...parts] as any),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
  return { model, calls: () => calls };
}

describe('DurableAgent step data (#26780)', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('reports step messages and model id, and runs the per-call model', async () => {
    const agentModel = toolThenTextModel('agent-model');
    const perCallModel = toolThenTextModel('per-call-model');
    const probe = createTool({
      id: 'probe',
      description: 'probe',
      inputSchema: z.object({ q: z.number() }),
      execute: async () => ({ ok: true }),
    });
    const durableAgent = createDurableAgent({
      agent: new Agent({
        id: 'step-data-agent',
        name: 'Step Data Agent',
        instructions: 'Test',
        model: agentModel.model as LanguageModelV2,
        tools: { probe },
      }),
      pubsub,
    });

    const stepEvents: any[] = [];
    let finish: any;
    const { output, cleanup } = await durableAgent.stream('go', {
      maxSteps: 5,
      model: perCallModel.model as LanguageModelV2,
      onStepFinish: (e: any) => void stepEvents.push(e),
      onFinish: (e: any) => void (finish = e),
    });
    await output.consumeStream();
    const steps = await output.steps;
    cleanup();

    expect(perCallModel.calls()).toBe(2);
    expect(agentModel.calls()).toBe(0);

    expect(stepEvents).toHaveLength(2);
    for (const event of stepEvents) {
      expect(event.response.modelId).toBe('per-call-model');
      expect(event.response.messages.length).toBeGreaterThan(0);
    }
    expect(stepEvents[0].response.messages.some((m: any) => m.role === 'tool')).toBe(true);

    expect(steps).toHaveLength(2);
    expect(steps.every(s => s.response.messages!.length > 0)).toBe(true);

    expect(finish.steps).toHaveLength(2);
    expect(finish.steps.every((s: any) => s.response?.messages?.length > 0)).toBe(true);
    expect(finish.response.modelId).toBe('per-call-model');
    expect(finish.response.messages.length).toBeGreaterThan(0);
  });

  it('generate() returns step data and runs the per-call model', async () => {
    const agentModel = toolThenTextModel('agent-model');
    const perCallModel = toolThenTextModel('per-call-model');
    const durableAgent = createDurableAgent({
      agent: new Agent({
        id: 'step-data-generate',
        name: 'Step Data Generate',
        instructions: 'Test',
        model: agentModel.model as LanguageModelV2,
        tools: { probe: probe() },
      }),
      pubsub,
    });

    const result: any = await durableAgent.generate('go', {
      maxSteps: 5,
      model: perCallModel.model as LanguageModelV2,
    });

    expect(perCallModel.calls()).toBe(2);
    expect(agentModel.calls()).toBe(0);
    expectStepData(result.steps, 'per-call-model');
    expect(result.response.modelId).toBe('per-call-model');
  });

  it('carries step data on the evented engine', async () => {
    const model = toolThenTextModel('evented-model');
    const agent = createEventedAgent({
      agent: new Agent({
        id: 'step-data-evented',
        name: 'Step Data Evented',
        instructions: 'Test',
        model: model.model as LanguageModelV2,
        tools: { probe: probe() },
      }),
    });
    new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false });

    const stepEvents: any[] = [];
    const { output, cleanup } = await agent.stream('go', {
      maxSteps: 5,
      onStepFinish: (e: any) => void stepEvents.push(e),
    } as any);
    await output.consumeStream();
    const steps = await output.steps;
    cleanup();

    expectStepData(stepEvents, 'evented-model');
    expectStepData(steps, 'evented-model');
  });

  it('carries step data on the segment resumed by an approval', async () => {
    const model = toolThenTextModel('resume-model');
    const memory = { thread: 'step-data-resume', resource: 'r' };
    const durableAgent = createDurableAgent({
      agent: new Agent({
        id: 'step-data-resume',
        name: 'Step Data Resume',
        instructions: 'Test',
        model: model.model as LanguageModelV2,
        memory: new MockMemory(),
        tools: { probe: probe(true) },
      }),
      pubsub,
    });
    new Mastra({ agents: { durableAgent }, storage: new InMemoryStore(), logger: false });

    const stream = await durableAgent.stream('go', { memory, maxSteps: 5 });
    for await (const chunk of stream.fullStream) if (chunk.type === 'tool-call-approval') break;

    const resumed: any = await durableAgent.approveToolCall({ runId: stream.runId, toolCallId: 'call-1', memory });
    for await (const _ of resumed.fullStream);
    const steps = await resumed.steps;

    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      expect(step.response?.modelId).toBe('resume-model');
      expect(step.response?.messages?.length).toBeGreaterThan(0);
    }
  }, 30000);

  it('keeps steps completed before an approval in the resumed onFinish', async () => {
    let calls = 0;
    const model = new MockLanguageModelV2({
      modelId: 'resume-model',
      doStream: async () => {
        calls++;
        const toolCall = (id: string, toolName: string) => [
          { type: 'tool-call', toolCallId: id, toolName, input: '{"q":1}', providerExecuted: false },
          { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ];
        const parts =
          calls === 1
            ? toolCall('call-free', 'free')
            : calls === 2
              ? toolCall('call-gated', 'gated')
              : [
                  { type: 'text-start', id: 't' },
                  { type: 'text-delta', id: 't', delta: 'done' },
                  { type: 'text-end', id: 't' },
                  { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
                ];
        return {
          stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, ...parts] as any),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    });
    const tool = (id: string, requireApproval: boolean) =>
      createTool({
        id,
        description: id,
        inputSchema: z.object({ q: z.number() }),
        requireApproval,
        execute: async () => ({ ok: true }),
      });
    const memory = { thread: 'step-data-resume-prior', resource: 'r' };
    const durableAgent = createDurableAgent({
      agent: new Agent({
        id: 'step-data-resume-prior',
        name: 'Step Data Resume Prior',
        instructions: 'Test',
        model: model as LanguageModelV2,
        memory: new MockMemory(),
        tools: { free: tool('free', false), gated: tool('gated', true) },
      }),
      pubsub,
    });
    new Mastra({ agents: { durableAgent }, storage: new InMemoryStore(), logger: false });

    const stream = await durableAgent.stream('go', { memory, maxSteps: 5 });
    for await (const chunk of stream.fullStream) if (chunk.type === 'tool-call-approval') break;

    let finish: any;
    const resumed: any = await durableAgent.approveToolCall({
      runId: stream.runId,
      toolCallId: 'call-gated',
      memory,
      onFinish: (e: any) => void (finish = e),
    });
    for await (const _ of resumed.fullStream);
    await vi.waitFor(() => expect(finish).toBeDefined());

    expect(finish.steps).toHaveLength(3);
    expect(finish.toolCalls.map((c: any) => c.payload?.toolName ?? c.toolName)).toEqual(['free', 'gated']);
    expect(finish.toolResults).toHaveLength(2);
    // The first step finished before the approval, so its content comes from the run's stored steps.
    expect(finish.steps[0].content.find((part: any) => part.type === 'tool-result')).toMatchObject({
      toolCallId: 'call-free',
      output: { type: 'json', value: { ok: true } },
    });
    expect(finish.steps.at(-1).response?.modelId).toBe('resume-model');
    expect(finish.steps.at(-1).response?.messages?.length).toBeGreaterThan(0);
  }, 30000);

  it('gives onAbort the completed steps and output.response the run messages (toolsets)', async () => {
    const abort = new AbortController();
    let calls = 0;
    const model = new MockLanguageModelV2({
      modelId: 'abort-model',
      doStream: async () => {
        calls++;
        if (calls === 2) abort.abort();
        const parts =
          calls === 1
            ? [
                { type: 'text-start', id: 'a' },
                { type: 'text-delta', id: 'a', delta: 'looking ' },
                { type: 'text-end', id: 'a' },
                { type: 'tool-call', toolCallId: 'call-1', toolName: 'probe', input: '{"q":1}' },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                },
              ]
            : [{ type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }];
        return {
          stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, ...parts] as any),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    });
    const durableAgent = createDurableAgent({
      agent: new Agent({
        id: 'step-data-abort',
        name: 'Step Data Abort',
        instructions: 'Test',
        model: model as LanguageModelV2,
      }),
      pubsub,
    });

    let aborted: any;
    const { output, cleanup } = await durableAgent.stream('go', {
      maxSteps: 5,
      abortSignal: abort.signal,
      toolsets: { runtime: { probe: probe() } },
      onAbort: (e: any) => void (aborted = e),
    } as any);
    await output.consumeStream().catch(() => {});
    await vi.waitFor(() => expect(aborted).toBeDefined());
    cleanup();

    const completed = aborted.steps[0];
    expect(completed.response.messages.some((m: any) => m.role === 'tool')).toBe(true);
    expect(completed.content.some((p: any) => p.type === 'tool-result')).toBe(true);
  });

  it('resolves output.response with the run messages', async () => {
    const model = toolThenTextModel('response-model');
    const durableAgent = createDurableAgent({
      agent: new Agent({
        id: 'step-data-response',
        name: 'Step Data Response',
        instructions: 'Test',
        model: model.model as LanguageModelV2,
      }),
      pubsub,
    });
    const { output, cleanup } = await durableAgent.stream('go', {
      maxSteps: 5,
      toolsets: { runtime: { probe: probe() } },
    } as any);
    await output.consumeStream();
    const response: any = await output.response;
    cleanup();
    expect(response.modelId).toBe('response-model');
    expect(response.messages.some((m: any) => m.role === 'tool')).toBe(true);
  });
});

/** Model that calls `shot` `toolSteps` times, then answers with text. */
function shotsThenTextModel(toolSteps: number) {
  let calls = 0;
  return new MockLanguageModelV2({
    modelId: 'shot-model',
    doStream: async () => {
      calls++;
      const parts =
        calls <= toolSteps
          ? [
              { type: 'text-start', id: `t${calls}` },
              { type: 'text-delta', id: `t${calls}`, delta: `step ${calls}` },
              { type: 'text-end', id: `t${calls}` },
              {
                type: 'tool-call',
                toolCallId: `call-${calls}`,
                toolName: 'shot',
                input: `{"q":${calls}}`,
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]
          : [
              { type: 'text-start', id: 'end' },
              { type: 'text-delta', id: 'end', delta: 'done' },
              { type: 'text-end', id: 'end' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
            ];
      return {
        stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, ...parts] as any),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

const SHOT_BYTES = 100_000;
const shot = createTool({
  id: 'shot',
  description: 'returns a large payload',
  inputSchema: z.object({ q: z.number() }),
  execute: async ({ q }) => ({ q, image: 'x'.repeat(SHOT_BYTES) }),
});

/** Payloads of the step-finish chunks published to pubsub. */
function captureStepFinishPayloads(pubsub: EventEmitterPubSub) {
  const payloads: any[] = [];
  const publish = pubsub.publish.bind(pubsub);
  vi.spyOn(pubsub, 'publish').mockImplementation(async (topic: string, event: any) => {
    const chunk = event?.data;
    if (chunk?.type === 'step-finish' && chunk.payload && '_durableResponseMessages' in chunk.payload) {
      payloads.push(structuredClone(chunk.payload));
    }
    return publish(topic, event);
  });
  return payloads;
}

const toolResultIds = (messages: any[]) =>
  messages.flatMap(m =>
    m.role === 'tool' && Array.isArray(m.content)
      ? m.content.filter((p: any) => p.type === 'tool-result').map((p: any) => p.toolCallId)
      : [],
  );

describe('DurableAgent step-finish payload size (#27475)', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await pubsub.close();
  });

  async function runShots(toolSteps: number, withMemory = false) {
    const payloads = captureStepFinishPayloads(pubsub);
    const storage = new InMemoryStore();
    const durableAgent = createDurableAgent({
      agent: new Agent({
        id: 'step-finish-size',
        name: 'Step Finish Size',
        instructions: 'Test',
        model: shotsThenTextModel(toolSteps) as LanguageModelV2,
        tools: { shot },
        ...(withMemory ? { memory: new MockMemory({ storage }) } : {}),
      }),
      pubsub,
    });
    if (withMemory) new Mastra({ agents: { durableAgent }, storage, logger: false });
    const stepEvents: any[] = [];
    const { output, cleanup } = await durableAgent.stream('go', {
      maxSteps: toolSteps + 2,
      ...(withMemory ? { memory: { thread: 'shot-thread', resource: 'shot-resource' } } : {}),
      onStepFinish: (e: any) => void stepEvents.push(e),
    });
    await output.consumeStream();
    const steps = await output.steps;
    const response: any = await output.response;
    cleanup();
    return { payloads, stepEvents, steps, response, storage };
  }

  it('sends each tool output once instead of on every later step', async () => {
    const { payloads } = await runShots(10);

    expect(payloads).toHaveLength(11);
    for (const payload of payloads) {
      // One 100KB tool result per step at most, not the 1MB the run accumulates.
      expect(JSON.stringify(payload._durableResponseMessages).length).toBeLessThan(2.5 * SHOT_BYTES);
    }
    const sent = payloads.reduce((n, p) => n + JSON.stringify(p._durableResponseMessages).length, 0);
    expect(sent).toBeLessThan(15 * SHOT_BYTES);
  }, 30000);

  it('keeps memory-backed turns linear on the wire and persists every result', async () => {
    const { payloads, stepEvents, response, storage } = await runShots(10, true);
    const sent = payloads.reduce((n, p) => n + JSON.stringify(p._durableResponseMessages).length, 0);
    expect(sent).toBeLessThan(15 * SHOT_BYTES);
    expect(toolResultIds(stepEvents.at(-1)!.response.messages)).toEqual(
      Array.from({ length: 10 }, (_, i) => `call-${i + 1}`),
    );
    expect(toolResultIds(response.messages)).toEqual(toolResultIds(stepEvents.at(-1)!.response.messages));
    const stored = await (await storage.getStore('memory'))!.listMessages({ threadId: 'shot-thread', perPage: false });
    const storedToolIds = stored.messages.flatMap(message =>
      message.content.parts.flatMap(part =>
        part.type === 'tool-invocation' && part.toolInvocation.state === 'result'
          ? [part.toolInvocation.toolCallId]
          : [],
      ),
    );
    expect(storedToolIds).toEqual(Array.from({ length: 10 }, (_, i) => `call-${i + 1}`));
  }, 30000);

  it('still reports the cumulative response messages on every step', async () => {
    const { stepEvents, steps, response } = await runShots(4);

    expect(stepEvents).toHaveLength(5);
    expect(steps).toHaveLength(5);
    stepEvents.forEach((event, i) => {
      const messages = event.response.messages;
      // Each step sees every tool result so far, each exactly once.
      expect(toolResultIds(messages)).toEqual(Array.from({ length: Math.min(i + 1, 4) }, (_, n) => `call-${n + 1}`));
      expect(steps[i]!.response.messages).toEqual(messages);
    });
    // Earlier steps keep their own snapshot when later chunks update the tail.
    expect(toolResultIds(steps[0]!.response.messages!)).toEqual(['call-1']);
    expect(steps[4]!.response.messages).toEqual(response.messages);
    expect(JSON.stringify(steps[4]!.response.messages)).toContain('done');
  }, 30000);

  it('sends the full history on the first step-finish of a resumed segment', async () => {
    // A free tool step completes (and is sent) before the gated call suspends the run.
    let calls = 0;
    const model = new MockLanguageModelV2({
      modelId: 'resume-model',
      doStream: async () => {
        calls++;
        const toolName = calls === 1 ? 'free' : 'gated';
        const parts =
          calls <= 2
            ? [
                {
                  type: 'tool-call',
                  toolCallId: `call-${toolName}`,
                  toolName,
                  input: '{"q":1}',
                  providerExecuted: false,
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                },
              ]
            : [
                { type: 'text-start', id: 't' },
                { type: 'text-delta', id: 't', delta: 'done' },
                { type: 'text-end', id: 't' },
                { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
              ];
        return {
          stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, ...parts] as any),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    });
    const tool = (id: string, requireApproval: boolean) =>
      createTool({
        id,
        description: id,
        inputSchema: z.object({ q: z.number() }),
        requireApproval,
        execute: async () => ({ ok: true }),
      });
    const memory = { thread: 'step-finish-size-resume', resource: 'r' };
    const durableAgent = createDurableAgent({
      agent: new Agent({
        id: 'step-finish-size-resume',
        name: 'Step Finish Size Resume',
        instructions: 'Test',
        model: model as LanguageModelV2,
        memory: new MockMemory(),
        tools: { free: tool('free', false), gated: tool('gated', true) },
      }),
      pubsub,
    });
    new Mastra({ agents: { durableAgent }, storage: new InMemoryStore(), logger: false });

    const payloads = captureStepFinishPayloads(pubsub);
    const stream = await durableAgent.stream('go', { memory, maxSteps: 5 });
    for await (const chunk of stream.fullStream) if (chunk.type === 'tool-call-approval') break;
    const firstSegmentChunks = payloads.length;
    expect(firstSegmentChunks).toBeGreaterThan(0);

    const resumed: any = await durableAgent.approveToolCall({ runId: stream.runId, toolCallId: 'call-gated', memory });
    for await (const _ of resumed.fullStream);
    const steps = await resumed.steps;

    expect(payloads.length).toBeGreaterThan(firstSegmentChunks);
    expect(payloads[firstSegmentChunks]._durableResponseMessagesFrom).toBe(0);
    const last = steps.at(-1).response.messages;
    expect(toolResultIds(last)).toEqual(['call-free', 'call-gated']);
    expect(JSON.stringify(last)).toContain('done');
  }, 30000);

  it('gives an observer that joins after the first step the messages from its first step-finish on', async () => {
    const cachingPubsub = new CachingPubSub(pubsub, new InMemoryServerCache());
    const durableAgent = createDurableAgent({
      agent: new Agent({
        id: 'step-finish-size-observe',
        name: 'Step Finish Size Observe',
        instructions: 'Test',
        model: shotsThenTextModel(3) as LanguageModelV2,
        tools: { shot },
      }),
      pubsub: cachingPubsub,
      cleanupTimeoutMs: 60_000,
    });
    new Mastra({
      agents: { durableAgent },
      storage: new InMemoryStore(),
      logger: false,
      pubsub: cachingPubsub,
    });

    const source = await durableAgent.stream('go', { maxSteps: 5 });
    await source.output.consumeStream();
    const history = await cachingPubsub.getHistory(AGENT_STREAM_TOPIC(source.runId), 0);
    const stepFinishOffsets = history.flatMap((event: any, i) => (event?.data?.type === 'step-finish' ? [i] : []));
    expect(stepFinishOffsets).toHaveLength(4);

    // Join at the second step-finish, so the first step's delta (call-1) is never received.
    const stepEvents: any[] = [];
    const observed = await durableAgent.observe(source.runId, {
      offset: stepFinishOffsets[1],
      onStepFinish: (e: any) => void stepEvents.push(e),
    });
    await observed.output.consumeStream();
    const steps = await observed.output.steps;
    const response: any = await observed.output.response;
    source.cleanup();

    // The output keeps splicing later deltas onto the first one it received, instead of
    // reporting each step's delta alone. Messages from before that chunk are not included.
    expect(stepEvents.map(e => toolResultIds(e.response.messages))).toEqual([
      ['call-2'],
      ['call-2', 'call-3'],
      ['call-2', 'call-3'],
    ]);
    expect(steps.map(step => step.response.messages)).toEqual(stepEvents.map(e => e.response.messages));
    expect(JSON.stringify(steps.at(-1)!.response.messages)).toContain('done');
    expect(response.messages).toEqual(steps.at(-1)!.response.messages);
  }, 30000);
});

describe('DurableAgent final step text', () => {
  it('reports the text an output processor rewrote in the finish steps', async () => {
    const pubsub = new EventEmitterPubSub();
    const { model } = toolThenTextModel('rewrite-model');
    const durableAgent = createDurableAgent({
      agent: new Agent({
        id: 'rewrite-agent',
        name: 'Rewrite Agent',
        instructions: 'Test',
        model: model as LanguageModelV2,
        tools: { probe: probe() },
        outputProcessors: [
          {
            id: 'redact',
            processOutputResult: async ({ messages }: { messages: any[] }) => {
              for (const message of messages) {
                if (message.role !== 'assistant') continue;
                for (const part of message.content.parts) {
                  if (part.type === 'text') part.text = part.text.replace('done', 'rewritten');
                }
              }
              return messages;
            },
          },
        ],
      }),
      pubsub,
    });

    let finish: any;
    const { output, cleanup } = await durableAgent.stream('go', {
      maxSteps: 5,
      onFinish: (e: any) => void (finish = e),
    });
    await output.consumeStream();
    cleanup();
    await pubsub.close();

    expect(finish.text).toBe('rewritten');
    expect(finish.steps.at(-1).text).toBe('rewritten');
  });
});
