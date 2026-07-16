/**
 * Regression tests for the shape of the durable `step-start` stream chunk.
 *
 * The durable stream adapter used to publish step-start with its fields flat
 * on the chunk (`{ type: 'step-start', stepId, request, warnings }`), while
 * the regular engine emits the canonical `ChunkType` shape
 * (`{ type, runId, from, payload }` — see the agentic-execution llm step).
 * The observe-side consumer enqueues the event's `data` verbatim onto the
 * client stream, so chunk consumers that destructure `chunk.payload` (e.g.
 * `@mastra/ai-sdk`'s chunk converter) crashed with
 * "Cannot destructure property 'messageId' of 'chunk.payload'" on every
 * durable `stream()`/`observe()`.
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { Agent } from '../../agent';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { emitStepStartEvent } from '../stream-adapter';

function createTextStreamModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

async function collectStreamChunks(stream: ReadableStream<any>) {
  const chunks: any[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks;
}

describe('durable step-start chunk shape', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('emitStepStartEvent publishes the canonical ChunkType shape', async () => {
    const runId = 'run-shape-test';
    const events: Event[] = [];
    await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => {
      events.push(event);
    });

    await emitStepStartEvent(pubsub, runId, {
      stepId: 'llm-execution',
      messageId: 'msg-1',
      request: { body: '{}' },
      warnings: [],
    });
    await new Promise(resolve => setImmediate(resolve));

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe(AgentStreamEventTypes.STEP_START);
    expect(events[0]?.data).toEqual({
      type: 'step-start',
      runId,
      from: 'AGENT',
      payload: {
        stepId: 'llm-execution',
        messageId: 'msg-1',
        request: { body: '{}' },
        warnings: [],
      },
    });
  });

  it('emitStepStartEvent defaults request/warnings like the regular engine', async () => {
    const runId = 'run-shape-defaults';
    const events: Event[] = [];
    await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => {
      events.push(event);
    });

    await emitStepStartEvent(pubsub, runId, { stepId: 'llm-execution' });
    await new Promise(resolve => setImmediate(resolve));

    const data = events[0]?.data as any;
    expect(data.payload.request).toEqual({});
    expect(data.payload.warnings).toEqual([]);
  });

  it('step-start chunks from a durable stream match the canonical engine shape', async () => {
    const agent = new Agent({
      id: 'step-start-shape',
      name: 'Step Start Shape',
      instructions: 'Respond briefly.',
      model: createTextStreamModel('Hello!'),
    });
    const durable = createDurableAgent({ agent, pubsub });

    const { output, cleanup } = await durable.stream('Say hello');
    const chunks = await collectStreamChunks(output.fullStream);
    cleanup();

    const stepStarts = chunks.filter(chunk => chunk.type === 'step-start');
    expect(stepStarts.length).toBeGreaterThan(0);

    for (const chunk of stepStarts) {
      // Canonical BaseChunkType fields.
      expect(chunk.runId).toBeDefined();
      expect(chunk.from).toBe('AGENT');

      // Fields live under `payload`, not flat on the chunk (the old shape).
      expect(chunk.payload).toBeDefined();
      expect((chunk as any).request).toBeUndefined();
      expect((chunk as any).warnings).toBeUndefined();

      expect(chunk.payload.request).toBeDefined();
      expect(Array.isArray(chunk.payload.warnings)).toBe(true);
      expect(chunk.payload.messageId).toEqual(expect.any(String));

      // The exact operation the @mastra/ai-sdk converter performs — throws on
      // the old flat shape because `chunk.payload` was undefined.
      const { messageId: _messageId, ...rest } = chunk.payload;
      expect(rest.request).toBeDefined();
    }
  });
});
