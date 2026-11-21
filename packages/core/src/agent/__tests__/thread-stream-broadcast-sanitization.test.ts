/**
 * Regression test for https://github.com/mastra-ai/mastra/issues/21219
 *
 * Every thread-bound run broadcasts its chunk stream to the thread-stream
 * pubsub topic. `step-start` embeds the full serialized model request (which
 * can include base64 media from context), and `step-finish`/`finish` repeat it
 * via `metadata.request`, `output.steps[]` and `messages` — amplifying the
 * largest object in the system ≥5× per step, persisting it in durable pubsub
 * backends, and exposing prompt contents to every subscriber. The broadcast
 * copy must be sanitized; the caller's local output must stay untouched.
 */
import { describe, expect, it } from 'vitest';

import { z } from 'zod/v4';

import { PubSub } from '../../events/pubsub';
import type { Event } from '../../events/types';
import { Mastra } from '../../mastra';
import type { MastraModelOutput } from '../../stream/base/output';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { AgentThreadStreamRuntime } from '../thread-stream-runtime';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

class CapturePubSub extends PubSub {
  events: Array<{ topic: string; event: Event }> = [];

  async publish(topic: string, event: Event): Promise<void> {
    this.events.push({ topic, event });
  }
  async flush(): Promise<void> {}
  async subscribe(): Promise<void> {}
  async unsubscribe(): Promise<void> {}
}

function fakeOutput(runId: string, parts: unknown[]): MastraModelOutput<any> {
  let finish!: () => void;
  const finished = new Promise<void>(resolve => (finish = resolve));
  return {
    runId,
    status: 'success',
    fullStream: new ReadableStream({
      start(controller) {
        for (const part of parts) controller.enqueue(part);
        controller.close();
        finish();
      },
    }),
    _waitUntilFinished: () => finished,
  } as unknown as MastraModelOutput<any>;
}

const MARKER = 'RAW_MODEL_REQUEST_BODY_'.repeat(64);
const agent = { id: 'sanitize-agent' } as unknown as Agent<any, any, any, any>;

describe('thread-stream broadcast sanitization', () => {
  it('drops raw model request bookkeeping from broadcast parts without mutating the originals', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new CapturePubSub();

    const stepStart = {
      type: 'step-start',
      payload: {
        messageId: 'msg-1',
        request: { body: MARKER },
        inputMessages: [{ role: 'user', content: MARKER }],
        warnings: [],
      },
    };
    const textDelta = { type: 'text-delta', payload: { text: 'hi' } };
    const stepFinish = {
      type: 'step-finish',
      payload: {
        stepResult: { reason: 'stop' },
        output: { usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, steps: [{ request: { body: MARKER } }] },
        metadata: { request: { body: MARKER }, providerMetadata: { test: { keep: true } } },
        messages: { all: [{ role: 'user', content: MARKER }], user: [], nonUser: [] },
      },
    };
    const finishPart = {
      type: 'finish',
      payload: {
        stepResult: { reason: 'stop' },
        output: { usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, steps: [{ request: { body: MARKER } }] },
        metadata: { request: { body: MARKER }, providerMetadata: { test: { keep: true } } },
        messages: { all: [{ role: 'user', content: MARKER }], user: [], nonUser: [] },
      },
    };

    const output = fakeOutput('sanitize-run', [stepStart, textDelta, stepFinish, finishPart]);
    await runtime.registerRun(
      agent,
      output,
      { memory: { thread: 'sanitize-thread', resource: 'sanitize-user' } },
      pubsub,
    );

    // The broadcast pump runs asynchronously after registration.
    const streamParts = async () =>
      pubsub.events
        .map(({ event }) => event.data as { type?: string; part?: unknown })
        .filter(data => data?.type === 'stream-part')
        .map(data => data.part as { type: string; payload: Record<string, any> });
    const deadline = Date.now() + 2000;
    while ((await streamParts()).length < 4 && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const parts = await streamParts();
    expect(parts.map(p => p.type)).toEqual(['step-start', 'text-delta', 'step-finish', 'finish']);

    // No broadcast part carries the raw request body.
    expect(JSON.stringify(parts)).not.toContain(MARKER);

    const [broadcastStepStart, , broadcastStepFinish, broadcastFinish] = parts;
    expect(broadcastStepStart!.payload).toEqual({ messageId: 'msg-1', warnings: [] });
    for (const part of [broadcastStepFinish!, broadcastFinish!]) {
      expect(part.payload.metadata).toEqual({ providerMetadata: { test: { keep: true } } });
      expect('messages' in part.payload).toBe(false);
      expect(part.payload.stepResult).toEqual({ reason: 'stop' });
    }
    expect(broadcastStepFinish!.payload.output).toEqual({ usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } });
    // The run's finish keeps how many steps it took, without the steps themselves.
    expect(broadcastFinish!.payload.output).toEqual({
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      stepCount: 1,
    });

    // The caller's chunks are untouched — only the broadcast copies are rewritten.
    expect(stepStart.payload.request.body).toBe(MARKER);
    expect(stepFinish.payload.metadata.request.body).toBe(MARKER);
    expect(finishPart.payload.output.steps[0]!.request.body).toBe(MARKER);
    expect(finishPart.payload.messages.all[0]!.content).toBe(MARKER);
  });

  it('recursively sanitizes delegated agent parts wrapped in tool-output chunks', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new CapturePubSub();

    const childFinish = {
      type: 'finish',
      runId: 'child-run',
      from: 'AGENT',
      payload: {
        stepResult: { reason: 'stop' },
        output: { text: 'child answer', steps: [{ request: { body: MARKER } }] },
        metadata: { request: { body: MARKER }, providerMetadata: { test: { keep: true } } },
        messages: { all: [{ role: 'tool', content: MARKER }], user: [], nonUser: [] },
      },
    };
    const childDelegation = {
      type: 'tool-output',
      runId: 'child-run',
      from: 'AGENT',
      payload: {
        toolCallId: 'child-delegate-call',
        toolName: 'agent-researcher',
        output: childFinish,
      },
    };
    const delegatedPart = {
      type: 'tool-output',
      runId: 'parent-run',
      from: 'AGENT',
      payload: {
        toolCallId: 'parent-delegate-call',
        toolName: 'agent-coordinator',
        output: childDelegation,
      },
    };

    const output = fakeOutput('parent-run', [delegatedPart]);
    await runtime.registerRun(
      agent,
      output,
      { memory: { thread: 'delegation-thread', resource: 'sanitize-user' } },
      pubsub,
    );

    const deadline = Date.now() + 2000;
    while (pubsub.events.filter(({ event }) => (event.data as { type?: string })?.type === 'stream-part').length < 1) {
      if (Date.now() >= deadline) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    const broadcast = pubsub.events
      .map(({ event }) => event.data as { type?: string; part?: unknown })
      .find(data => data.type === 'stream-part')!.part as typeof delegatedPart;
    const broadcastChildDelegation = broadcast.payload.output;
    const broadcastChildFinish = broadcastChildDelegation.payload.output;

    expect(broadcastChildFinish.payload.output).toEqual({ text: 'child answer', stepCount: 1 });
    expect(broadcastChildFinish.payload.metadata).toEqual({ providerMetadata: { test: { keep: true } } });
    expect('messages' in broadcastChildFinish.payload).toBe(false);
    expect(JSON.stringify(broadcast)).not.toContain(MARKER);

    // Only the broadcast copy is rewritten.
    expect(childFinish.payload.output.steps[0]!.request.body).toBe(MARKER);
    expect(childFinish.payload.metadata.request.body).toBe(MARKER);
    expect(childFinish.payload.messages.all[0]!.content).toBe(MARKER);
  });

  it('keeps multi-step broadcast size bounded (no compounding steps[] duplication)', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new CapturePubSub();

    // Three model steps. Each step-finish re-embeds every prior step's full
    // request via output.steps[], so unsanitized broadcast traffic grows
    // quadratically with step count.
    const chunks: unknown[] = [];
    const steps: Array<{ request: { body: string } }> = [];
    for (let index = 0; index < 3; index++) {
      steps.push({ request: { body: MARKER } });
      chunks.push(
        { type: 'step-start', payload: { messageId: `msg-${index}`, request: { body: MARKER }, warnings: [] } },
        { type: 'text-delta', payload: { text: `step ${index}` } },
        {
          type: 'step-finish',
          payload: {
            stepResult: { reason: 'stop' },
            output: { usage: { totalTokens: 2 }, steps: structuredClone(steps) },
            metadata: { request: { body: MARKER } },
            messages: { all: [], user: [], nonUser: [] },
          },
        },
      );
    }
    chunks.push({
      type: 'finish',
      payload: {
        stepResult: { reason: 'stop' },
        output: { usage: { totalTokens: 6 }, steps: structuredClone(steps) },
        metadata: { request: { body: MARKER } },
        messages: { all: [], user: [], nonUser: [] },
      },
    });

    const rawSize = JSON.stringify(chunks).length;
    const output = fakeOutput('multi-step-run', chunks);
    await runtime.registerRun(
      agent,
      output,
      { memory: { thread: 'multi-step-thread', resource: 'sanitize-user' } },
      pubsub,
    );

    const streamParts = () =>
      pubsub.events
        .map(({ event }) => event.data as { type?: string; part?: unknown })
        .filter(data => data?.type === 'stream-part')
        .map(data => data.part);
    const deadline = Date.now() + 2000;
    while (streamParts().length < chunks.length && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const parts = streamParts();
    expect(parts.length).toBe(chunks.length);

    const broadcastJson = JSON.stringify(parts);
    expect(broadcastJson).not.toContain(MARKER);
    // The raw chunks embed the marker 14 times (~21 KB); the sanitized
    // broadcast retains only control metadata and text.
    expect(broadcastJson.length).toBeLessThan(rawSize / 10);
  });

  // Subscribers such as Studio tell a run that used its whole maxSteps budget from one a
  // stopWhen ended early by its step count, so the broadcast finish keeps that count. (#29612)
  describe('step count on the broadcast finish', () => {
    const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

    it.each([
      { maxSteps: 3, stopOnFirstStep: false, stepCount: 3 },
      { maxSteps: 10, stopOnFirstStep: true, stepCount: 1 },
    ])(
      'carries $stepCount for a real run with maxSteps $maxSteps (stopWhen on step 1: $stopOnFirstStep)',
      async ({ maxSteps, stopOnFirstStep, stepCount }) => {
        let calls = 0;
        const realAgent = new Agent({
          id: 'step-count-agent',
          name: 'Step count agent',
          instructions: 'Keep looking things up.',
          tools: {
            lookup: createTool({
              id: 'lookup',
              description: 'look something up',
              inputSchema: z.object({}),
              execute: async () => ({ found: true }),
            }),
          },
          model: new MockLanguageModelV2({
            doStream: async () => ({
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                { type: 'stream-start' as const, warnings: [] },
                { type: 'tool-call' as const, toolCallId: `call-${++calls}`, toolName: 'lookup', input: '{}' },
                { type: 'finish' as const, finishReason: 'tool-calls' as const, usage },
              ]),
            }),
          }),
        });
        new Mastra({ agents: { realAgent }, logger: false });
        const memory = { thread: 'step-count-thread', resource: 'step-count-user' };
        const subscription = await realAgent.subscribeToThread({
          threadId: memory.thread,
          resourceId: memory.resource,
        });
        try {
          const output = await realAgent.stream('go', {
            maxSteps,
            ...(stopOnFirstStep ? { stopWhen: () => true } : {}),
            memory,
          });
          const local = await output.getFullOutput();
          expect(local.steps).toHaveLength(stepCount);

          let broadcastFinish: any;
          for await (const part of subscription.stream) {
            if (part.type === 'finish') {
              broadcastFinish = part;
              break;
            }
          }
          expect(broadcastFinish.payload.stepResult.reason).toBe('tool-calls');
          expect(broadcastFinish.payload.output.steps).toBeUndefined();
          expect(broadcastFinish.payload.output.stepCount).toBe(stepCount);
        } finally {
          subscription.unsubscribe();
        }
      },
    );

    it('does not count processor retry steps, which the step limit ignores', async () => {
      const runtime = new AgentThreadStreamRuntime();
      const pubsub = new CapturePubSub();
      const finish = {
        type: 'finish',
        payload: {
          stepResult: { reason: 'tool-calls' },
          output: {
            usage,
            steps: [{ finishReason: 'retry' }, { finishReason: 'tool-calls' }, { finishReason: 'tool-calls' }],
          },
        },
      };
      await runtime.registerRun(
        agent,
        fakeOutput('retry-run', [finish]),
        { memory: { thread: 'retry-thread', resource: 'sanitize-user' } },
        pubsub,
      );
      const broadcastFinish = async () =>
        pubsub.events
          .map(({ event }) => event.data as { type?: string; part?: { type: string; payload: Record<string, any> } })
          .find(data => data?.type === 'stream-part' && data.part?.type === 'finish')?.part;
      const deadline = Date.now() + 2000;
      while (!(await broadcastFinish()) && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect((await broadcastFinish())?.payload.output).toEqual({ usage, stepCount: 2 });
    });
  });
});
