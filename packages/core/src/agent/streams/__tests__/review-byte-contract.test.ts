import { describe, expect, it } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { AGENT_STREAM_PUBLISH_RETAINED_BYTES_LIMIT } from '../constants';
import { createAgentStreamPublisher } from '../publisher';

const REPLAY_INCOMPLETE = 'AGENT_STREAM_REPLAY_INCOMPLETE';

class HeldPubSub extends EventEmitterPubSub {
  readonly events: Array<{ type: string; errorId?: string }> = [];
  #held: Promise<void> | undefined;
  #release: (() => void) | undefined;
  /** Makes the first attempt to report a gap fail, as a publish that cannot land would. */
  failNextGap: boolean | number = false;

  hold() {
    this.#held = new Promise(resolve => (this.#release = resolve));
  }

  release() {
    this.#release?.();
    this.#held = undefined;
  }

  override async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>, options?: { localOnly?: boolean }) {
    if (topic.startsWith('agent.stream.')) {
      await this.#held;
      const data = (event as { data?: { error?: { id?: string } } }).data;
      if (data?.error?.id === REPLAY_INCOMPLETE && this.failNextGap) {
        this.failNextGap = typeof this.failNextGap === 'number' ? this.failNextGap - 1 : false;
        throw new Error('Socket closed unexpectedly');
      }
      this.events.push({ type: event.type, errorId: data?.error?.id });
    }
    return super.publish(topic, event, options);
  }
}

describe('review retained-byte contract reproductions', () => {
  it.each(['oversized-first', 'utf8', 'BigInt', 'cycle'])('rejects an over-budget %s payload', async kind => {
    const pubsub = new HeldPubSub();
    pubsub.hold();
    const runId = crypto.randomUUID();
    const publisher = createAgentStreamPublisher({ pubsub, runId, cleanupTimeoutMs: 0 });
    let payload: any;
    if (kind === 'oversized-first') payload = { text: 'x'.repeat(AGENT_STREAM_PUBLISH_RETAINED_BYTES_LIMIT + 1) };
    if (kind === 'utf8') payload = { text: '界'.repeat(3 * 1024 * 1024) };
    if (kind === 'BigInt') payload = { toolCallId: 'c', output: { value: 1n, text: 'x'.repeat(9 * 1024 * 1024) } };
    if (kind === 'cycle') {
      const output: any = { text: 'x'.repeat(9 * 1024 * 1024) };
      output.self = output;
      payload = { toolCallId: 'c', output };
    }
    publisher.publish({
      type: kind === 'BigInt' || kind === 'cycle' ? 'tool-output' : 'text-delta',
      runId,
      from: 'AGENT',
      payload,
    } as any);
    pubsub.release();
    await publisher.close();
    await pubsub.flush();
    // Only boolean metadata is compared: no giant payload in failure output.
    expect(pubsub.events.some(e => e.errorId === REPLAY_INCOMPLETE)).toBe(true);
    await pubsub.close();
  });
});

it('does not silently retain an oversized terminal outside the publication budget', async () => {
  const pubsub = new HeldPubSub();
  pubsub.hold();
  const runId = crypto.randomUUID();
  const publisher = createAgentStreamPublisher({ pubsub, runId, cleanupTimeoutMs: 0 });
  publisher.publish({
    type: 'finish',
    runId,
    from: 'AGENT',
    payload: {
      output: { text: 'x'.repeat(9 * 1024 * 1024), steps: [], usage: {} },
      stepResult: { reason: 'finished' },
    },
  } as any);
  pubsub.release();
  await publisher.close();
  await pubsub.flush();
  expect(pubsub.events.some(e => e.errorId === REPLAY_INCOMPLETE)).toBe(true);
  await pubsub.close();
});
