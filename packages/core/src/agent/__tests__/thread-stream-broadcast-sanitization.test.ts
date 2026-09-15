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

import { PubSub } from '../../events/pubsub';
import type { Event } from '../../events/types';
import type { MastraModelOutput } from '../../stream/base/output';
import type { Agent } from '../agent';
import { AgentThreadStreamRuntime } from '../thread-stream-runtime';

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
const agent = { id: 'sanitize-agent' } as Agent<any, any, any, any>;

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
      expect(part.payload.output).toEqual({ usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } });
      expect('messages' in part.payload).toBe(false);
      expect(part.payload.stepResult).toEqual({ reason: 'stop' });
    }

    // The caller's chunks are untouched — only the broadcast copies are rewritten.
    expect(stepStart.payload.request.body).toBe(MARKER);
    expect(stepFinish.payload.metadata.request.body).toBe(MARKER);
    expect(finishPart.payload.output.steps[0]!.request.body).toBe(MARKER);
    expect(finishPart.payload.messages.all[0]!.content).toBe(MARKER);
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
});
