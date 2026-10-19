import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import type { SignalProvider } from '@mastra/core/signals';
import { InMemoryStore } from '@mastra/core/storage';
import type { MCPClient } from '../../client/configuration';
import type {
  MCPEventDescriptor,
  MCPEventOccurrence,
  MCPEventSubscribeOptions,
  MCPEventSubscription,
} from '../../client/events';

type Item = { occurrence: MCPEventOccurrence; cursor: string | null | undefined } | { error: Error };

/**
 * A controllable subscription: occurrences exist only when a test pushes them into this specific
 * subscription. Like the real client, `cursor` advances only when an occurrence is yielded.
 */
export class FakeSubscription implements MCPEventSubscription {
  readonly mode = 'push';
  readonly arguments: Record<string, unknown> | undefined;
  cursor: string | null;
  truncated = false;
  cancelled = false;
  cancelCalls = 0;
  readonly #items: Item[] = [];
  #wake?: () => void;

  constructor(
    readonly server: string,
    readonly name: string,
    args: Record<string, unknown> | undefined,
    readonly options: MCPEventSubscribeOptions | undefined,
  ) {
    this.arguments = args;
    this.cursor = options?.cursor ?? null;
  }

  /** `cursor: undefined` leaves the subscription cursor unchanged; `null` clears it. */
  push(data: Record<string, unknown>, { eventId, cursor }: { eventId: string; cursor?: string | null }) {
    this.#items.push({
      occurrence: { eventId, name: this.name, timestamp: '2026-01-01T00:00:00.000Z', data },
      cursor,
    });
    this.#wake?.();
  }

  fail(error: Error) {
    this.#items.push({ error });
    this.#wake?.();
  }

  onError(): () => void {
    return () => {};
  }

  async cancel(): Promise<void> {
    this.cancelCalls++;
    this.cancelled = true;
    this.#wake?.();
  }

  [Symbol.asyncIterator](): AsyncIterator<MCPEventOccurrence> {
    return {
      next: async () => {
        while (!this.cancelled && this.#items.length === 0) {
          await new Promise<void>(resolve => (this.#wake = resolve));
        }
        const item = this.cancelled ? undefined : this.#items.shift();
        if (!item) return { done: true, value: undefined };
        if ('error' in item) throw item.error;
        if (item.cursor !== undefined) this.cursor = item.cursor;
        return { done: false, value: item.occurrence };
      },
      return: async () => {
        await this.cancel();
        return { done: true, value: undefined };
      },
    };
  }
}

export const DESCRIPTORS: MCPEventDescriptor[] = [
  {
    name: 'repo.push',
    description: 'A push to a repository',
    delivery: ['push', 'poll'],
    inputSchema: { type: 'object', properties: { repo: { type: 'string' } } },
    payloadSchema: { type: 'object' },
  },
];

export function createFakeEventsClient() {
  const subscriptions: FakeSubscription[] = [];
  const listCalls: string[] = [];
  let nextError: Error | undefined;
  let descriptors = DESCRIPTORS;
  const client: Pick<MCPClient, 'events'> = {
    events: {
      list: async server => {
        listCalls.push(server);
        return descriptors;
      },
      subscribe: async (server, event, args, options) => {
        // Let concurrent callers interleave before the subscription is established.
        await new Promise(resolve => setTimeout(resolve, 0));
        if (nextError) {
          const error = nextError;
          nextError = undefined;
          throw error;
        }
        const subscription = new FakeSubscription(server, event, args, options);
        subscriptions.push(subscription);
        return subscription;
      },
    },
  };
  return {
    client,
    subscriptions,
    listCalls,
    rejectNextSubscribe(error: Error) {
      nextError = error;
    },
    setDescriptors(next: typeof DESCRIPTORS) {
      descriptors = next;
    },
  };
}

/** A real Agent, registered with Mastra, whose notifications are persisted without waking a run. */
export function createAgent(provider: SignalProvider) {
  const storage = new InMemoryStore();
  const agent = new Agent({
    id: 'events-agent',
    name: 'Events Agent',
    instructions: 'Test',
    model: new MockLanguageModelV2(),
    signals: [provider],
    notifications: { deliveryPolicy: { default: 'persist' } },
  });
  new Mastra({ agents: { eventsAgent: agent }, storage, logger: false });
  return { agent, storage };
}

/** Lets pending deliveries run to completion. */
export const settle = () => new Promise(resolve => setTimeout(resolve, 20));
