import { vi } from 'vitest';
import { EVENTS_SUBSCRIPTION_ID_META_KEY } from '../../../shared/events';
import type {
  EventActiveNotificationParams,
  PollEventsRequestParams,
  PollEventsResult,
  StreamEventsRequestParams,
} from '../../../shared/events';
import type { EventStreamSink, EventsPort } from '../types';

/** One `events/stream` opened against the fake port, driven by the test. */
export class FakeStream {
  aborted = false;
  private resolveOpen!: () => void;
  private rejectOpen!: (error: unknown) => void;
  private resolveDone!: () => void;
  private rejectDone!: (error: unknown) => void;
  readonly opened: Promise<void>;
  readonly done: Promise<void>;

  constructor(
    readonly params: StreamEventsRequestParams,
    readonly sink: EventStreamSink,
    readonly signal: AbortSignal,
  ) {
    this.opened = new Promise((resolve, reject) => {
      this.resolveOpen = resolve;
      this.rejectOpen = reject;
    });
    this.done = new Promise((resolve, reject) => {
      this.resolveDone = resolve;
      this.rejectDone = reject;
    });
    this.done.catch(() => {});
    signal.addEventListener('abort', () => this.abort(), { once: true });
  }

  private get meta() {
    return { [EVENTS_SUBSCRIPTION_ID_META_KEY]: 1 };
  }

  confirm(params: Omit<EventActiveNotificationParams, '_meta'> = { cursor: null }): void {
    this.sink.active({ ...params, _meta: this.meta });
    this.resolveOpen();
  }

  rejectOpenWith(error: unknown): void {
    this.rejectOpen(error);
  }

  event(eventId: string, cursor: string | null | undefined, data: Record<string, unknown> = {}): void {
    this.sink.event({
      eventId,
      name: this.params.name,
      timestamp: new Date(0).toISOString(),
      data,
      ...(cursor !== undefined ? { cursor } : {}),
      _meta: this.meta,
    });
  }

  heartbeat(cursor: string | null): void {
    this.sink.heartbeat({ cursor, _meta: this.meta });
  }

  error(code: number, message = 'boom'): void {
    this.sink.error({ error: { code, message }, _meta: this.meta });
  }

  terminated(code: number, message = 'gone'): void {
    this.sink.terminated({ error: { code, message }, _meta: this.meta });
  }

  close(): void {
    this.resolveDone();
  }

  fail(error: unknown): void {
    this.rejectDone(error);
  }

  abort(): void {
    if (this.aborted) return;
    this.aborted = true;
    this.rejectOpen(new Error('aborted'));
    this.rejectDone(new Error('aborted'));
  }
}

type PollStep = PollEventsResult | Error;

/** An {@link EventsPort} whose poll responses and push streams are scripted by the test. */
export class FakePort implements EventsPort {
  readonly pollCalls: PollEventsRequestParams[] = [];
  readonly streams: FakeStream[] = [];
  private readonly pollSteps: PollStep[] = [];
  readonly ensureConnected = vi.fn(async () => {});
  readonly log = vi.fn();

  queuePoll(...steps: PollStep[]): this {
    this.pollSteps.push(...steps);
    return this;
  }

  poll(params: PollEventsRequestParams, signal: AbortSignal): Promise<PollEventsResult> {
    this.pollCalls.push(params);
    const step = this.pollSteps.shift();
    if (step instanceof Error) return Promise.reject(step);
    if (step) return Promise.resolve(step);
    // Nothing scripted: hang like a slow server until cancelled.
    return new Promise((_, reject) =>
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }),
    );
  }

  async openStream(
    params: StreamEventsRequestParams,
    sink: EventStreamSink,
    options: { signal: AbortSignal; openTimeoutMs: number },
  ) {
    const stream = new FakeStream(params, sink, options.signal);
    this.streams.push(stream);
    await stream.opened;
    return { done: stream.done, abort: () => stream.abort() };
  }

  get lastStream(): FakeStream {
    const stream = this.streams.at(-1);
    if (!stream) throw new Error('no stream opened');
    return stream;
  }
}

export function occurrence(eventId: string, data: Record<string, unknown> = {}) {
  return { eventId, name: 'test.event', timestamp: new Date(0).toISOString(), data };
}

export function pollResult(overrides: Partial<PollEventsResult> = {}): PollEventsResult {
  return { events: [], cursor: null, ...overrides };
}
