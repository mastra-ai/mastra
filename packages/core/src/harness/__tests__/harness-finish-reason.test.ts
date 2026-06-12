/**
 * Tests that the Harness finalizes a run into an explicit terminal state for
 * non-success stream finish reasons.
 *
 * Anthropic's `claude-fable-5` can block a turn server-side and return a
 * `refusal` stop reason, which the AI SDK surfaces as a `content-filter` finish
 * reason. Previously the Harness mapped any non-`stop`/non-`tool-calls` finish
 * reason to `complete`, so the run ended on an empty assistant message with no
 * error — it appeared to silently stop. These tests pin the fix: the run ends
 * on `stopReason: 'error'`, carries an `errorMessage`, emits an `error` event,
 * and `agent_end` reports `reason: 'error'`.
 */
import { describe, it, expect, vi } from 'vitest';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';

import { Harness, describeNonSuccessFinishReason } from '../harness';

vi.setConfig({ testTimeout: 30_000 });

function createFinishReasonStream(finishReason: string, providerMetadata?: Record<string, unknown>) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'partial' });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({
        type: 'finish',
        finishReason,
        ...(providerMetadata ? { providerMetadata } : {}),
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });
      controller.close();
    },
  });
}

async function buildHarness(id: string, stream: () => ReadableStream) {
  const agent = new Agent({
    id: `agent-${id}`,
    name: `Agent ${id}`,
    instructions: 'You are a helpful assistant.',
    model: new MastraLanguageModelV2Mock({
      doStream: async () => ({ stream: stream() }),
    }),
  });

  const storage = new InMemoryStore();
  const mastra = new Mastra({ agents: { [`agent-${id}`]: agent }, logger: false, storage });
  const registeredAgent = mastra.getAgent(`agent-${id}`);

  const harness = new Harness({
    id: `harness-${id}`,
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
    initialState: { yolo: true } as any,
  });

  await harness.init();
  await harness.createThread();
  return harness;
}

describe('describeNonSuccessFinishReason', () => {
  it('includes the refusal explanation from anthropic stop details', () => {
    const message = describeNonSuccessFinishReason('content-filter', {
      anthropic: {
        stopDetails: {
          type: 'refusal',
          category: 'cyber',
          explanation: 'This request was blocked under the Usage Policy.',
        },
      },
    });
    expect(message).toBe('The model stopped on a content filter (This request was blocked under the Usage Policy.).');
  });

  it('falls back to the category when no explanation is present', () => {
    const message = describeNonSuccessFinishReason('content-filter', {
      anthropic: { stopDetails: { type: 'refusal', category: 'cyber' } },
    });
    expect(message).toBe('The model stopped on a content filter (category: cyber).');
  });

  it('returns a generic content-filter message when details are absent', () => {
    expect(describeNonSuccessFinishReason('content-filter', undefined)).toBe('The model stopped on a content filter.');
  });

  it('returns undefined for success reasons', () => {
    expect(describeNonSuccessFinishReason('stop', undefined)).toBeUndefined();
    expect(describeNonSuccessFinishReason('tool-calls', undefined)).toBeUndefined();
  });
});

describe('Harness: non-success finish reasons', () => {
  it('finalizes a content-filter refusal into an explicit terminal error state', async () => {
    const harness = await buildHarness('content-filter', () =>
      createFinishReasonStream('content-filter', {
        anthropic: {
          stopDetails: {
            type: 'refusal',
            category: 'cyber',
            explanation: 'This request was blocked under the Usage Policy.',
          },
        },
      }),
    );

    const events: any[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    await harness.sendMessage({ content: 'do something blocked' });

    // The run must not silently complete.
    const agentEnd = events.find(e => e.type === 'agent_end');
    expect(agentEnd?.reason).toBe('error');

    // A user-visible error event is emitted with diagnostic context.
    const errorEvent = events.find(e => e.type === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent.error.message).toContain('content filter');

    // The finalized assistant message carries the terminal error state.
    const messageEnd = [...events].reverse().find(e => e.type === 'message_end');
    expect(messageEnd?.message.stopReason).toBe('error');
    expect(messageEnd?.message.errorMessage).toContain('content filter');
  });

  it('surfaces a content-filter refusal even without provider stop details', async () => {
    const harness = await buildHarness('content-filter-no-details', () => createFinishReasonStream('content-filter'));

    const events: any[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    await harness.sendMessage({ content: 'do something blocked' });

    expect(events.find(e => e.type === 'agent_end')?.reason).toBe('error');
    const messageEnd = [...events].reverse().find(e => e.type === 'message_end');
    expect(messageEnd?.message.stopReason).toBe('error');
    expect(messageEnd?.message.errorMessage).toBe('The model stopped on a content filter.');
  });

  it('surfaces a length finish reason as a terminal error state', async () => {
    const harness = await buildHarness('length', () => createFinishReasonStream('length'));

    const events: any[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    await harness.sendMessage({ content: 'write a very long answer' });

    expect(events.find(e => e.type === 'agent_end')?.reason).toBe('error');
    const messageEnd = [...events].reverse().find(e => e.type === 'message_end');
    expect(messageEnd?.message.stopReason).toBe('error');
    expect(messageEnd?.message.errorMessage).toContain('maximum output length');
  });

  it('still completes normally on a stop finish reason', async () => {
    const harness = await buildHarness('stop', () => createFinishReasonStream('stop'));

    const events: any[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    await harness.sendMessage({ content: 'say hi' });

    expect(events.find(e => e.type === 'agent_end')?.reason).toBe('complete');
    expect(events.some(e => e.type === 'error')).toBe(false);
    const messageEnd = [...events].reverse().find(e => e.type === 'message_end');
    expect(messageEnd?.message.stopReason).toBe('complete');
    expect(messageEnd?.message.errorMessage).toBeUndefined();
  });
});
