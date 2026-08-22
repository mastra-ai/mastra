import type { Event, OpencodeClient } from '@opencode-ai/sdk/v2';
import { OpenCodeEventType } from './event-types';

export type CallId = string;
export type SessionId = string;

export interface StreamListener {
  readonly sessionId: SessionId;
  push(event: Event): void;
  end(error?: unknown): void;
}

export interface OpenCodeStreamGate {
  openStream(callId: CallId): Promise<void>;
  closeStream(callId: CallId): void;
  listenStream(sessionId: SessionId): AsyncGenerator<Event, void, void>;
}

const TERMINAL_EVENT_TYPES = new Set<Event['type']>([OpenCodeEventType.SessionIdle, OpenCodeEventType.SessionError]);

function isTerminalEvent(event: Event): boolean {
  return TERMINAL_EVENT_TYPES.has(event.type);
}

function sessionIdOf(event: Event): SessionId | undefined {
  switch (event.type) {
    case OpenCodeEventType.SessionIdle:
    case OpenCodeEventType.SessionStatus:
    case OpenCodeEventType.SessionError:
    case OpenCodeEventType.SessionCompacted:
    case OpenCodeEventType.SessionDiff:
    case OpenCodeEventType.MessageRemoved:
    case OpenCodeEventType.MessagePartRemoved:
    case OpenCodeEventType.MessagePartDelta:
    case OpenCodeEventType.PermissionReplied:
    case OpenCodeEventType.PermissionAsked:
    case OpenCodeEventType.PermissionV2Asked:
    case OpenCodeEventType.PermissionV2Replied:
    case OpenCodeEventType.TodoUpdated:
    case OpenCodeEventType.CommandExecuted:
      return event.properties.sessionID;
    case OpenCodeEventType.SessionCreated:
    case OpenCodeEventType.SessionUpdated:
    case OpenCodeEventType.SessionDeleted:
      return event.properties.info.id;
    case OpenCodeEventType.MessageUpdated:
      return event.properties.info.sessionID;
    case OpenCodeEventType.MessagePartUpdated:
      return event.properties.part.sessionID;
    default:
      return undefined;
  }
}

// Bridges push-based dispatch into the pull-based AsyncGenerator interface.
class SessionEventChannel implements StreamListener, AsyncGenerator<Event, void, void> {
  readonly sessionId: SessionId;
  // Mutually exclusive with #waiters.
  #buffer: Event[] = [];
  #waiters: Array<{ resolve: (result: IteratorResult<Event, void>) => void; reject: (error: unknown) => void }> = [];
  #ended = false;
  #error?: unknown;
  #onEarlyExit: () => void;

  constructor(sessionId: SessionId, onEarlyExit: () => void) {
    this.sessionId = sessionId;
    this.#onEarlyExit = onEarlyExit;
  }

  push(event: Event): void {
    if (this.#ended) return; // no consumer left to deliver to
    const waiter = this.#waiters.shift();
    if (waiter) {
      waiter.resolve({ value: event, done: false });
    } else {
      this.#buffer.push(event);
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
    const buffered = this.#buffer.shift();
    if (buffered) return { value: buffered, done: false };
    if (this.#ended) {
      if (this.#error) throw this.#error;
      return { value: undefined, done: true };
    }
    return new Promise((resolve, reject) => this.#waiters.push({ resolve, reject }));
  }

  // Only fires on consumer-driven break/return; end() already unregisters otherwise.
  async return(): Promise<IteratorResult<Event, void>> {
    this.end();
    this.#onEarlyExit();
    return { value: undefined, done: true };
  }

  async throw(error?: unknown): Promise<IteratorResult<Event, void>> {
    this.end(error);
    this.#onEarlyExit();
    throw error;
  }

  [Symbol.asyncIterator](): AsyncGenerator<Event, void, void> {
    return this;
  }
}

// OpenCodeStreamManager abstracts subscription to session updates.
// OpenCode events are fired at a global handler, so this gives sessions a pub-sub model.
export class OpenCodeStreamManager implements OpenCodeStreamGate {
  #client: OpencodeClient;
  #refs = new Set<CallId>();
  #connecting?: Promise<void>;
  #pumpAbort?: AbortController;
  #listeners = new Map<SessionId, Set<SessionEventChannel>>();

  constructor(client: OpencodeClient) {
    this.#client = client;
  }

  async openStream(callId: CallId): Promise<void> {
    if (!this.#connecting) {
      this.#connecting = this.#connect().catch(error => {
        this.#connecting = undefined;
        throw error;
      });
    }
    await this.#connecting;
    this.#refs.add(callId);
  }

  closeStream(callId: CallId): void {
    this.#refs.delete(callId);
    if (this.#refs.size === 0) {
      this.#disconnect();
    }
  }

  listenStream(sessionId: SessionId): AsyncGenerator<Event, void, void> {
    const channel = new SessionEventChannel(sessionId, () => this.#unregister(sessionId, channel));
    this.#register(sessionId, channel);
    return channel;
  }

  #register(sessionId: SessionId, channel: SessionEventChannel): void {
    let listeners = this.#listeners.get(sessionId);
    if (!listeners) {
      listeners = new Set();
      this.#listeners.set(sessionId, listeners);
    }
    listeners.add(channel);
  }

  #unregister(sessionId: SessionId, channel: SessionEventChannel): void {
    const listeners = this.#listeners.get(sessionId);
    if (!listeners) return;
    listeners.delete(channel);
    if (listeners.size === 0) this.#listeners.delete(sessionId);
  }

  async #connect(): Promise<void> {
    const abort = new AbortController();
    this.#pumpAbort = abort;
    const subscription = await this.#client.event.subscribe(undefined, { signal: abort.signal });
    void this.#pump(subscription.stream, abort.signal);
  }

  #disconnect(): void {
    this.#pumpAbort?.abort();
    this.#pumpAbort = undefined;
    this.#connecting = undefined;
    this.#endAllListeners();
  }

  #endAllListeners(error?: unknown): void {
    for (const listeners of this.#listeners.values()) {
      for (const channel of listeners) channel.end(error);
    }
    this.#listeners.clear();
  }

  async #pump(stream: AsyncGenerator<Event, unknown, unknown>, signal: AbortSignal): Promise<void> {
    try {
      for await (const event of stream) {
        if (signal.aborted) return;
        this.#dispatch(event);
      }
    } catch (error) {
      if (!signal.aborted) this.#endAllListeners(error);
    }
  }

  #dispatch(event: Event): void {
    const sessionId = sessionIdOf(event);
    if (!sessionId) return;
    const listeners = this.#listeners.get(sessionId);
    if (!listeners) return;

    const terminal = isTerminalEvent(event);
    for (const channel of listeners) {
      channel.push(event);
      if (terminal) channel.end();
    }
    if (terminal) this.#listeners.delete(sessionId);
  }
}
