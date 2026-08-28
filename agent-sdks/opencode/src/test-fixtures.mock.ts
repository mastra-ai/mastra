import type { AssistantMessage, Event, OpencodeClient, Session } from '@opencode-ai/sdk/v2';
import { vi } from 'vitest';
import { OpenCodeEventType, OpenCodePartType } from './event-types';

/**
 * A hand-rolled pushable async iterator standing in for the raw SSE
 * `AsyncGenerator<Event>` returned by `client.event.subscribe()`. Tests push
 * events onto it directly instead of running a real HTTP/SSE connection.
 * Mirrors the same push/end/return shape as `SessionEventChannel` in
 * `./stream.ts`, since that's exactly the contract `OpenCodeStreamManager`
 * expects from its underlying subscription.
 */
export class PushableEventSource implements AsyncGenerator<Event, void, void> {
  #queue: Event[] = [];
  #waiters: Array<{ resolve: (result: IteratorResult<Event, void>) => void; reject: (error: unknown) => void }> = [];
  #ended = false;
  #error?: unknown;
  #returnCount = 0;

  get returnCount(): number {
    return this.#returnCount;
  }

  push(event: Event): void {
    if (this.#ended) return;
    const waiter = this.#waiters.shift();
    if (waiter) {
      waiter.resolve({ value: event, done: false });
    } else {
      this.#queue.push(event);
    }
  }

  end(error?: unknown): void {
    if (this.#ended) return;
    this.#ended = true;
    this.#error = error;
    while (this.#waiters.length) {
      const waiter = this.#waiters.shift()!;
      if (error) waiter.reject(error);
      else waiter.resolve({ value: undefined, done: true });
    }
  }

  async next(): Promise<IteratorResult<Event, void>> {
    const buffered = this.#queue.shift();
    if (buffered) return { value: buffered, done: false };
    if (this.#ended) {
      if (this.#error) throw this.#error;
      return { value: undefined, done: true };
    }
    return new Promise((resolve, reject) => this.#waiters.push({ resolve, reject }));
  }

  async return(): Promise<IteratorResult<Event, void>> {
    this.#returnCount += 1;
    this.end();
    return { value: undefined, done: true };
  }

  async throw(error?: unknown): Promise<IteratorResult<Event, void>> {
    this.end(error);
    throw error;
  }

  [Symbol.asyncIterator](): AsyncGenerator<Event, void, void> {
    return this;
  }
}

export function createSession(overrides: Partial<Session> & { id: string }): Session {
  return {
    slug: overrides.id,
    projectID: 'project',
    directory: '/tmp/project',
    title: 'Session',
    version: '1',
    time: { created: 0, updated: 0 },
    ...overrides,
  } as Session;
}

export function createAssistantMessage(
  overrides: Partial<AssistantMessage> & { id: string; sessionID: string },
): AssistantMessage {
  return {
    role: 'assistant',
    time: { created: 0, completed: 1 },
    parentID: 'parent',
    modelID: 'gpt-5.1',
    providerID: 'openai',
    mode: 'build',
    agent: 'build',
    path: { cwd: '/tmp/project', root: '/tmp/project' },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    ...overrides,
  } as AssistantMessage;
}

export function messageUpdatedEvent(sessionId: string, info: AssistantMessage): Event {
  return {
    id: `evt-${info.id}`,
    type: OpenCodeEventType.MessageUpdated,
    properties: { sessionID: sessionId, info },
  } as Event;
}

export function textPartUpdatedEvent(sessionId: string, messageId: string, partId: string, text: string): Event {
  return {
    id: `evt-${partId}`,
    type: OpenCodeEventType.MessagePartUpdated,
    properties: {
      sessionID: sessionId,
      time: 0,
      part: {
        id: partId,
        sessionID: sessionId,
        messageID: messageId,
        type: OpenCodePartType.Text,
        text,
      },
    },
  } as Event;
}

export function textPartDeltaEvent(sessionId: string, messageId: string, partId: string, delta: string): Event {
  return {
    id: `evt-delta-${partId}-${delta}`,
    type: OpenCodeEventType.MessagePartDelta,
    properties: { sessionID: sessionId, messageID: messageId, partID: partId, field: 'text', delta },
  } as Event;
}

export function toolPartUpdatedEvent(
  sessionId: string,
  messageId: string,
  partId: string,
  callId: string,
  toolName: string,
  state: Record<string, unknown>,
): Event {
  return {
    id: `evt-${partId}`,
    type: OpenCodeEventType.MessagePartUpdated,
    properties: {
      sessionID: sessionId,
      time: 0,
      part: {
        id: partId,
        sessionID: sessionId,
        messageID: messageId,
        type: OpenCodePartType.Tool,
        callID: callId,
        tool: toolName,
        state,
      },
    },
  } as Event;
}

export function sessionIdleEvent(sessionId: string): Event {
  return {
    id: `evt-idle-${sessionId}`,
    type: OpenCodeEventType.SessionIdle,
    properties: { sessionID: sessionId },
  } as Event;
}

export function sessionErrorEvent(sessionId: string, error: unknown): Event {
  return {
    id: `evt-error-${sessionId}`,
    type: OpenCodeEventType.SessionError,
    properties: { sessionID: sessionId, error },
  } as Event;
}

/** Drains an async generator into an array. */
export async function collect<T>(source: AsyncGenerator<T, void, void>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of source) {
    items.push(item);
  }
  return items;
}

export function createMockOpenCodeClient() {
  const events = new PushableEventSource();
  const createdSessionIds: string[] = [];
  let sessionCounter = 0;

  const sessionCreate = vi.fn(async (_params?: Record<string, unknown>) => {
    const id = `session-${++sessionCounter}`;
    createdSessionIds.push(id);
    return { data: createSession({ id }), error: undefined };
  });
  const sessionPromptAsync = vi.fn(async (_params: Record<string, unknown>) => ({ error: undefined }));
  const sessionAbort = vi.fn(async (_params: Record<string, unknown>) => ({ error: undefined }));
  const subscribe = vi.fn(async (_params?: unknown, _options?: { signal?: AbortSignal }) => ({ stream: events }));

  const client = {
    session: {
      create: sessionCreate,
      promptAsync: sessionPromptAsync,
      abort: sessionAbort,
    },
    event: {
      subscribe,
    },
  } as unknown as OpencodeClient;

  return { client, events, createdSessionIds, sessionCreate, sessionPromptAsync, sessionAbort, subscribe };
}
