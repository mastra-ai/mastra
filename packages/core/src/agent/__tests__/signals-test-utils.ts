import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';

import { PubSub } from '../../events/pubsub';
import type { LeaseProvider } from '../../events/pubsub';
import type { EventCallback } from '../../events/types';

export function createTextStreamModel(responseText: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: responseText },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      ]),
    }),
  });
}

export function createBlockingFirstTextStreamModel(firstResponseText: string, laterResponseText: string) {
  let releaseFirst!: () => void;
  const firstFinished = new Promise<void>(resolve => {
    releaseFirst = resolve;
  });
  let streamCount = 0;
  const model = new MockLanguageModelV2({
    doStream: async () => {
      streamCount += 1;
      const currentStreamCount = streamCount;
      const responseText = currentStreamCount === 1 ? firstResponseText : laterResponseText;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: new ReadableStream({
          async start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({
              type: 'response-metadata',
              id: `blocking-stream-${currentStreamCount}`,
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            });
            controller.enqueue({ type: 'text-start', id: 'text-1' });
            controller.enqueue({ type: 'text-delta', id: 'text-1', delta: responseText });
            controller.enqueue({ type: 'text-end', id: 'text-1' });
            if (currentStreamCount === 1) {
              await firstFinished;
            }
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            });
            controller.close();
          },
        }),
      };
    },
  });

  return { model, releaseFirst, getStreamCount: () => streamCount };
}

export function nextTick() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

export class AsyncCallbackPubSub extends PubSub {
  #subscribers = new Map<string, Set<EventCallback>>();
  #index = 0;
  #pending = new Set<Promise<void>>();
  /** Callback rejections, which a real backend turns into a nack and redelivery. */
  subscriptionFailures: unknown[] = [];

  async publish(topic: string, event: any, _options?: { localOnly?: boolean }): Promise<void> {
    const subscribers = [...(this.#subscribers.get(topic) ?? [])];
    const envelope = {
      ...event,
      id: `event-${this.#index}`,
      createdAt: new Date(),
      index: this.#index++,
    };
    const pending = new Promise<void>(resolve => {
      setTimeout(() => {
        try {
          for (const subscriber of subscribers) {
            void Promise.resolve(subscriber(envelope)).catch(error => this.subscriptionFailures.push(error));
          }
        } finally {
          resolve();
        }
      }, 0);
    });
    this.#pending.add(pending);
    pending.finally(() => this.#pending.delete(pending));
  }

  async subscribe(topic: string, cb: EventCallback): Promise<void> {
    const subscribers = this.#subscribers.get(topic) ?? new Set<EventCallback>();
    subscribers.add(cb);
    this.#subscribers.set(topic, subscribers);
  }

  async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    this.#subscribers.get(topic)?.delete(cb);
  }

  async flush(): Promise<void> {
    await Promise.all([...this.#pending]);
  }
}

export class RetainedAsyncCallbackPubSub extends PubSub {
  #subscribers = new Map<string, Set<EventCallback>>();

  subscriberCount(topic: string) {
    return this.#subscribers.get(topic)?.size ?? 0;
  }
  #history = new Map<string, any[]>();
  #pending = new Set<Promise<void>>();
  #index = 0;
  /** Callback rejections, which a real backend turns into a nack and redelivery. */
  subscriptionFailures: unknown[] = [];

  async publish(topic: string, event: any): Promise<void> {
    const envelope = { ...event, id: `retained-${this.#index}`, createdAt: new Date(), index: this.#index++ };
    const history = this.#history.get(topic) ?? [];
    history.push(envelope);
    this.#history.set(topic, history);
    const subscribers = [...(this.#subscribers.get(topic) ?? [])];
    const pending = new Promise<void>(resolve => {
      setTimeout(() => {
        for (const subscriber of subscribers) {
          void Promise.resolve(subscriber(envelope)).catch(error => this.subscriptionFailures.push(error));
        }
        resolve();
      }, 0);
    });
    this.#pending.add(pending);
    pending.finally(() => this.#pending.delete(pending));
  }

  async subscribe(topic: string, cb: EventCallback): Promise<void> {
    const subscribers = this.#subscribers.get(topic) ?? new Set<EventCallback>();
    subscribers.add(cb);
    this.#subscribers.set(topic, subscribers);
    for (const event of this.#history.get(topic) ?? []) {
      void Promise.resolve(cb(event)).catch(error => this.subscriptionFailures.push(error));
    }
  }

  async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    this.#subscribers.get(topic)?.delete(cb);
  }

  async flush(): Promise<void> {
    await Promise.all([...this.#pending]);
  }
}

export class ControlledLeasePubSub extends RetainedAsyncCallbackPubSub implements LeaseProvider {
  owners = new Map<string, string>();
  publishedData: any[] = [];
  ownerReadDelayMs = 0;
  ownerReadFailures = 0;
  acquireLeaseWait: Promise<void> | undefined;
  onAcquireLease: (() => void) | undefined;
  transferLeaseWait: Promise<void> | undefined;
  onTransferLease: (() => void) | undefined;
  denyLeaseAcquisition = false;
  denyLeaseTransfer = false;
  rejectPublishedTypes = new Set<string>();
  unsubscribeCount = 0;

  override async publish(topic: string, event: any): Promise<void> {
    this.publishedData.push(event.data);
    await super.publish(topic, event);
    if (this.rejectPublishedTypes.has(event.data?.type)) {
      throw new Error(`publish rejected after delivery: ${event.data.type}`);
    }
  }

  async acquireLease(key: string, owner: string): Promise<{ acquired: boolean; owner?: string }> {
    this.onAcquireLease?.();
    await this.acquireLeaseWait;
    const current = this.owners.get(key);
    if (this.denyLeaseAcquisition) return { acquired: false, owner: current ?? 'competing-run' };
    if (current && current !== owner) return { acquired: false, owner: current };
    this.owners.set(key, owner);
    return { acquired: true, owner };
  }

  async getLeaseOwner(key: string): Promise<string | undefined> {
    if (this.ownerReadDelayMs) await new Promise(resolve => setTimeout(resolve, this.ownerReadDelayMs));
    if (this.ownerReadFailures > 0) {
      this.ownerReadFailures -= 1;
      throw new Error('transient owner read failure');
    }
    return this.owners.get(key);
  }

  async releaseLease(key: string, owner: string): Promise<void> {
    if (this.owners.get(key) === owner) this.owners.delete(key);
  }

  async renewLease(key: string, owner: string): Promise<boolean> {
    return this.owners.get(key) === owner;
  }

  async transferLease(key: string, fromOwner: string, toOwner: string): Promise<boolean> {
    this.onTransferLease?.();
    await this.transferLeaseWait;
    if (this.denyLeaseTransfer) return false;
    if (this.owners.get(key) !== fromOwner) return false;
    this.owners.set(key, toOwner);
    return true;
  }

  override async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    this.unsubscribeCount += 1;
    await super.unsubscribe(topic, cb);
  }
}

export class HangingUnsubscribePubSub extends ControlledLeasePubSub {
  override async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    await super.unsubscribe(topic, cb);
    return new Promise<void>(() => {});
  }
}

/**
 * Models an acknowledgement the owner publishes successfully but that never
 * reaches the sender — a lost reply, not a rejected publish. The owner records
 * the reply as published, so it never re-sends it, and the caller waits out its
 * acceptance timeout. This is the transport failure that makes a sender retry a
 * logical message it has no way to know was already accepted.
 */
export class DroppingAcceptanceReplyPubSub extends ControlledLeasePubSub {
  droppedAcceptanceReplies = 0;

  override async publish(topic: string, event: any): Promise<void> {
    if (this.droppedAcceptanceReplies > 0 && event?.data?.type === 'idle-signal-accepted') {
      this.droppedAcceptanceReplies -= 1;
      this.publishedData.push(event.data);
      return;
    }
    await super.publish(topic, event);
  }
}

export async function readNextRun(iterator: AsyncIterator<any>) {
  const nextRun = await readNextRunWithParts(iterator);
  if (nextRun.done) return nextRun;
  return { value: { runId: nextRun.value.runId, text: nextRun.value.text, part: nextRun.value.part }, done: false };
}

export async function readNextRunWithParts(iterator: AsyncIterator<any>) {
  let runId: string | undefined;
  let text = '';
  const parts: any[] = [];

  while (true) {
    const next = await iterator.next();
    if (next.done) return next;

    const part = next.value;
    parts.push(part);
    runId ??= part.runId;
    if (part.type === 'text-delta') {
      text += part.payload.text;
    }
    if (part.type === 'finish' || part.type === 'error' || part.type === 'abort') {
      return { value: { runId, text, part, parts }, done: false };
    }
  }
}

export async function waitForActiveRun(subscription: { activeRunId: () => string | null }, timeoutMs = 500) {
  const startedAt = Date.now();
  let runId = subscription.activeRunId();
  while (!runId) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for active run');
    }
    await nextTick();
    runId = subscription.activeRunId();
  }
  return runId;
}

export async function waitForCondition(predicate: () => boolean, timeoutMs = 500) {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await nextTick();
  }
}

export async function withTimeout<T>(promise: Promise<T>, message: string, timeoutMs = 500): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function createFakeThreadRun(runId: string, finished: Promise<void>) {
  return {
    runId,
    status: 'running',
    fullStream: new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'start', runId });
        controller.enqueue({ type: 'finish', runId, payload: {} });
        controller.close();
      },
    }),
    _waitUntilFinished: () => finished,
  } as any;
}
