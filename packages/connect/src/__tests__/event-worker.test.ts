import type { ServerResponse } from 'node:http';

import type { IMastraLogger } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ConnectClient } from '../connect-client.js';
import { ConnectEventWorker, Dispatcher } from '../event-worker.js';
import type { ConnectEventHandlers, ConnectEventWorkerOptions } from '../event-worker.js';
import { event, eventsServer, ready, startStream } from './events-server.js';

const servers: Array<{ close(): Promise<void> }> = [];
const instances: Mastra[] = [];

beforeEach(() => {
  for (const name of [
    'MASTRA_EVENTS_API_URL',
    'MASTRA_PLATFORM_REGION',
    'MASTRA_PROJECT_ID',
    'MASTRA_PLATFORM_ACCESS_TOKEN',
    'MASTRA_PLATFORM_SECRET_KEY',
  ]) {
    vi.stubEnv(name, '');
  }
});

afterEach(async () => {
  await Promise.all(instances.splice(0).map(mastra => mastra.stopWorkers()));
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await Promise.all(servers.splice(0).map(s => s.close()));
});

interface Delivery {
  connectionId?: string;
  provider: string;
  eventType: string;
  payload?: unknown;
  rawPayload?: string;
  sourceEventId?: string;
  resourceId?: string;
  unverified?: boolean;
}

function fields(delivery: Delivery): Record<string, string> {
  return {
    connectionId: delivery.connectionId ?? 'conn_1',
    integrationId: delivery.provider,
    eventType: delivery.eventType,
    payload: delivery.rawPayload ?? JSON.stringify(delivery.payload ?? {}),
    ...(delivery.sourceEventId ? { sourceEventId: delivery.sourceEventId } : {}),
    ...(delivery.resourceId ? { resourceId: delivery.resourceId } : {}),
    ...(delivery.unverified ? { unverified: 'true' } : {}),
  };
}

/** A local events service that streams `deliveries` on every connection, then holds it open. */
async function eventsService(deliveries: Delivery[]) {
  const streams: ServerResponse[] = [];
  const s = await eventsServer([
    (_req, res) => {
      streams.push(res);
      startStream(res);
      res.write(ready('10'));
      deliveries.forEach((delivery, index) => res.write(event(String(11 + index), fields(delivery))));
    },
  ]);
  servers.push(s);
  return { ...s, streams };
}

/** A real Mastra with in-memory storage, running a worker with `handlers`. */
async function run<const H, U extends boolean = false>(
  url: string,
  handlers: ConnectEventHandlers<H, U>,
  options: Omit<ConnectEventWorkerOptions<U>, 'eventsUrl'> = {},
  workflows: Record<string, ReturnType<typeof createWorkflow>> = {},
) {
  const worker = new ConnectEventWorker<H, U>(handlers, {
    accessToken: 'tok_secret',
    projectId: 'proj_1',
    eventsUrl: url,
    reconnectDelayMs: 5,
    ...options,
  });
  const mastra = new Mastra({ workflows, workers: [worker], logger: false, storage: new InMemoryStore() });
  instances.push(mastra);
  await mastra.startWorkers();
  return { worker, mastra };
}

const prOpened = (number: number) => ({
  action: 'opened',
  number,
  pull_request: { title: 'Fix login', base: { ref: 'main' } },
  repository: { full_name: 'acme/app' },
});

describe('ConnectEventWorker', () => {
  it("calls each provider's handler with the events it asked for, and nothing else", async () => {
    const service = await eventsService([
      { provider: 'github', eventType: 'pull_request.opened', payload: prOpened(7) },
      // Connect has no payload type for GitHub's `ping`, so a handler for all of GitHub doesn't get it.
      { provider: 'github', eventType: 'ping', payload: { zen: 'Keep it logically awesome.' } },
      { provider: 'github', eventType: 'push', rawPayload: 'not json' },
      { provider: 'github', eventType: 'pull_request.opened', payload: prOpened(8), unverified: true },
      { provider: 'linear', eventType: 'Issue.create', payload: { data: { id: 'iss_1' } } },
      { provider: 'linear', eventType: 'Issue.update', payload: { data: { id: 'iss_1' } } },
      { provider: 'posthog', eventType: '$pageview', payload: { distinct_id: 'u1' } },
      { provider: 'slack', eventType: 'app_mention', payload: {} },
      // A handler for listed event types never gets a payload that isn't JSON, even for a provider without types.
      { provider: 'pylon', eventType: 'issue.new', rawPayload: 'not json' },
      { provider: 'pylon', eventType: 'issue.new', payload: { id: 'p_1' } },
    ]);
    const seen: string[] = [];

    await run(service.url, {
      github: ({ event }) => void seen.push(`github ${event.eventType}`),
      linear: { 'Issue.create': ({ event }) => void seen.push(`linear ${event.eventType} ${event.payload.data.id}`) },
      posthog: ({ event }) => void seen.push(`posthog ${event.eventType}`),
      pylon: { 'issue.new': ({ event }) => void seen.push(`pylon ${JSON.stringify(event.payload)}`) },
    });

    await vi.waitFor(() => expect(seen).toHaveLength(4));
    expect(seen).toEqual([
      'github pull_request.opened',
      'linear Issue.create iss_1',
      'posthog $pageview',
      'pylon {"id":"p_1"}',
    ]);
  });

  it("gives handlers Mastra, its logger, and a Connect client scoped to the event's end user", async () => {
    const service = await eventsService([
      { provider: 'linear', eventType: 'Issue.create', payload: { data: { id: 'iss_1' } }, resourceId: 'user_ada' },
      { connectionId: 'conn_2', provider: 'linear', eventType: 'Issue.create', payload: { data: { id: 'iss_2' } } },
    ]);
    const contexts: Array<{ connect: ConnectClient }> = [];
    const { mastra } = await run(service.url, { linear: context => void contexts.push(context) });

    await vi.waitFor(() => expect(contexts).toHaveLength(2));
    expect(contexts[0]).toEqual({
      event: expect.objectContaining({ provider: 'linear', resourceId: 'user_ada' }),
      mastra,
      logger: mastra.getLogger(),
      connect: expect.any(ConnectClient),
    });
    expect(contexts[0]!.connect.resourceId).toBe('user_ada');
    expect(contexts[0]!.connect.projectId).toBe('proj_1');
    // An org or project connection's event gets the project's client.
    expect(contexts[1]!.connect.resourceId).toBeUndefined();
    expect(contexts[1]!.connect.projectId).toBe('proj_1');
  });

  it("handles different connections' events concurrently, and one connection's events in order", async () => {
    const issue = (connectionId: string, id: string): Delivery => ({
      connectionId,
      provider: 'linear',
      eventType: 'Issue.create',
      payload: { data: { id } },
    });
    const service = await eventsService([issue('conn_1', 'a1'), issue('conn_1', 'a2'), issue('conn_2', 'b1')]);
    const log: string[] = [];
    let release!: () => void;
    const blocked = new Promise<void>(resolve => (release = resolve));

    await run(service.url, {
      linear: {
        'Issue.create': async ({ event }) => {
          log.push(`start ${event.payload.data.id}`);
          if (event.payload.data.id === 'a1') await blocked;
          log.push(`end ${event.payload.data.id}`);
        },
      },
    });

    // conn_2's event doesn't wait for conn_1's, but conn_1's second event does.
    await vi.waitFor(() => expect(log).toEqual(['start a1', 'start b1', 'end b1']));
    release();
    await vi.waitFor(() => expect(log).toEqual(['start a1', 'start b1', 'end b1', 'end a1', 'start a2', 'end a2']));
  });

  it('only saves the cursor past events that have been handled, along with every event before them', async () => {
    const service = await eventsService([
      { connectionId: 'conn_1', provider: 'linear', eventType: 'Issue.create', payload: { data: { id: 'slow' } } },
      { connectionId: 'conn_2', provider: 'linear', eventType: 'Issue.create', payload: { data: { id: 'b1' } } },
      { connectionId: 'conn_2', provider: 'linear', eventType: 'Issue.create', payload: { data: { id: 'b2' } } },
    ]);
    const saved: Array<string | undefined> = [];
    const handled: string[] = [];
    let release!: () => void;
    const blocked = new Promise<void>(resolve => (release = resolve));

    await run(
      service.url,
      {
        linear: {
          'Issue.create': async ({ event }) => {
            if (event.payload.data.id === 'slow') await blocked;
            handled.push(event.payload.data.id);
          },
        },
      },
      { cursorStore: { load: () => undefined, save: cursor => void saved.push(cursor.eventId) } },
    );

    await vi.waitFor(() => expect(handled).toEqual(['b1', 'b2']));
    // Event 11 is still being handled, so a restart must start at or before it.
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(saved).toEqual([]);

    release();
    await vi.waitFor(() => expect(saved.at(-1)).toBe('13'));
    expect(saved.every(id => Number(id) >= 11)).toBe(true);
  });

  it('waits on stop for the events being handled, and saves the cursor past them', async () => {
    const service = await eventsService([
      { provider: 'linear', eventType: 'Issue.create', payload: { data: { id: 'a1' } } },
      { provider: 'linear', eventType: 'Issue.create', payload: { data: { id: 'a2' } } },
    ]);
    const saved: Array<string | undefined> = [];
    const handled: string[] = [];
    let release!: () => void;
    const blocked = new Promise<void>(resolve => (release = resolve));
    const { worker } = await run(
      service.url,
      {
        linear: {
          'Issue.create': async ({ event }) => {
            // a1 finishes after a2 is queued behind it, and a2 is still running when the worker stops.
            if (event.payload.data.id === 'a1') await new Promise(resolve => setTimeout(resolve, 30));
            else await blocked;
            handled.push(event.payload.data.id);
          },
        },
      },
      {
        cursorStore: {
          load: () => undefined,
          save: async cursor => {
            await new Promise(resolve => setTimeout(resolve, 10));
            saved.push(cursor.eventId);
          },
        },
      },
    );
    await vi.waitFor(() => expect(handled).toEqual(['a1']));

    let stopped = false;
    const stopping = worker.stop({ drainTimeout: 5_000 }).then(() => (stopped = true));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(stopped).toBe(false);

    release();
    await stopping;
    expect(handled).toEqual(['a1', 'a2']);
    expect(saved.at(-1)).toBe('12');
  });

  it('logs a cursor save that fails, and keeps saving', async () => {
    const service = await eventsService([
      { provider: 'linear', eventType: 'Issue.create', payload: { data: { id: 'a1' } } },
      { provider: 'linear', eventType: 'Issue.create', payload: { data: { id: 'a2' } } },
    ]);
    const saved: Array<string | undefined> = [];
    const { mastra } = await run(
      service.url,
      { linear: () => {} },
      {
        cursorStore: {
          load: () => undefined,
          save: cursor => {
            if (cursor.eventId === '11') throw new Error('database unavailable');
            saved.push(cursor.eventId);
          },
        },
      },
    );
    const error = vi.spyOn(mastra.getLogger(), 'error');

    await vi.waitFor(() => expect(saved).toEqual(['12']));
    expect(error).toHaveBeenCalledWith('Connect event worker could not save its cursor', expect.anything());
  });

  it('saves the cursor on the last event once a handler stuck behind 2,000 others finishes', async () => {
    const service = await eventsService([
      { connectionId: 'conn_slow', provider: 'linear', eventType: 'Issue.create', payload: { data: { id: 'slow' } } },
      ...Array.from(
        { length: 2_000 },
        (_, i): Delivery => ({
          connectionId: 'conn_fast',
          provider: 'linear',
          eventType: 'Issue.create',
          payload: { data: { id: `f${i}` } },
        }),
      ),
    ]);
    const saved: Array<string | undefined> = [];
    let handled = 0;
    let release!: () => void;
    const blocked = new Promise<void>(resolve => (release = resolve));
    await run(
      service.url,
      {
        linear: {
          'Issue.create': async ({ event }) => {
            if (event.payload.data.id === 'slow') await blocked;
            handled++;
          },
        },
      },
      { cursorStore: { load: () => undefined, save: cursor => void saved.push(cursor.eventId) } },
    );

    await vi.waitFor(() => expect(handled).toBe(2_000), { timeout: 10_000 });
    expect(saved).toEqual([]);
    release();
    await vi.waitFor(() => expect(saved.at(-1)).toBe(String(11 + 2_000)));
  });

  it('stops reading ahead while 100 events wait on a slow connection', async () => {
    const service = await eventsService([
      ...Array.from(
        { length: 100 },
        (_, i): Delivery => ({
          connectionId: 'conn_slow',
          provider: 'linear',
          eventType: 'Issue.create',
          payload: { data: { id: `s${i}` } },
        }),
      ),
      { connectionId: 'conn_fast', provider: 'linear', eventType: 'Issue.create', payload: { data: { id: 'f1' } } },
    ]);
    const handled: string[] = [];
    let release!: () => void;
    const blocked = new Promise<void>(resolve => (release = resolve));

    await run(service.url, {
      linear: {
        'Issue.create': async ({ event }) => {
          if (event.payload.data.id === 's0') await blocked;
          handled.push(event.payload.data.id);
        },
      },
    });

    await new Promise(resolve => setTimeout(resolve, 200));
    expect(handled).toEqual([]);
    release();
    await vi.waitFor(() => expect(handled).toHaveLength(101));
    expect(handled).toContain('f1');
  });

  it('starts a workflow from a handler, once per webhook even when it is redelivered', async () => {
    const inputs: unknown[] = [];
    const triage = createWorkflow({
      id: 'triage-issue',
      inputSchema: z.object({ issueId: z.string() }),
      outputSchema: z.object({}),
    })
      .then(
        createStep({
          id: 'record',
          inputSchema: z.any(),
          outputSchema: z.object({}),
          execute: async ({ inputData }) => {
            inputs.push(inputData);
            return {};
          },
        }),
      )
      .commit();
    const service = await eventsService([
      { provider: 'linear', eventType: 'Issue.create', payload: { data: { id: 'iss_1' } }, sourceEventId: 'l-1' },
      { provider: 'linear', eventType: 'Issue.create', payload: { data: { id: 'iss_1' } }, sourceEventId: 'l-1' },
      { provider: 'linear', eventType: 'Issue.create', payload: { data: { id: 'iss_2' } }, sourceEventId: 'l-2' },
    ]);
    const handled: string[] = [];

    // The pattern the docs show.
    await run(
      service.url,
      {
        linear: {
          'Issue.create': async ({ event, mastra }) => {
            const run = await mastra.getWorkflow('triage').createRun({
              runId: `linear:${event.sourceEventId ?? event.id}`,
              resourceId: event.resourceId,
            });
            if (run.workflowRunStatus === 'pending')
              await run.startAsync({ inputData: { issueId: event.payload.data.id } });
            handled.push(event.id);
          },
        },
      },
      {},
      { triage },
    );

    await vi.waitFor(() => expect(handled).toHaveLength(3));
    await vi.waitFor(() => expect(inputs).toEqual([{ issueId: 'iss_1' }, { issueId: 'iss_2' }]));
  });

  it('logs a failing handler and keeps handling events', async () => {
    const service = await eventsService([
      { provider: 'linear', eventType: 'Issue.create', payload: { data: { id: 'bad' } } },
      { provider: 'linear', eventType: 'Issue.create', payload: { data: { id: 'good' } } },
    ]);
    const handled: string[] = [];
    const { mastra } = await run(service.url, {
      linear: ({ event }) => {
        if (event.eventType === 'Issue.create' && event.payload.data.id === 'bad') throw new Error('boom');
        handled.push(event.id);
      },
    });
    const error = vi.spyOn(mastra.getLogger(), 'error');

    await vi.waitFor(() => expect(handled).toEqual(['12']));
    expect(error).toHaveBeenCalledWith(
      'Connect event handler failed',
      expect.objectContaining({ eventId: '11', provider: 'linear', eventType: 'Issue.create' }),
    );
  });

  it('passes unverified events to handlers when asked to', async () => {
    const service = await eventsService([
      { provider: 'linear', eventType: 'Issue.create', payload: { data: { id: 'iss_1' } }, unverified: true },
      { provider: 'linear', eventType: 'Issue.create', payload: { data: { id: 'iss_2' } } },
    ]);
    const seen: boolean[] = [];
    await run(
      service.url,
      { linear: { 'Issue.create': ({ event }) => void seen.push(event.unverified) } },
      {
        includeUnverified: true,
      },
    );

    await vi.waitFor(() => expect(seen).toEqual([true, false]));
  });

  it('stops listening when stopped, and listens again when started', async () => {
    const service = await eventsService([]);
    const { worker } = await run(service.url, { linear: () => {} });
    await vi.waitFor(() => expect(service.streams).toHaveLength(1));
    expect(worker.isRunning).toBe(true);
    await worker.start();

    await worker.stop({ drainTimeout: 1_000 });
    expect(worker.isRunning).toBe(false);
    await vi.waitFor(() => expect(service.streams[0]!.destroyed || service.streams[0]!.writableEnded).toBe(true));

    expect(service.streams).toHaveLength(1);
    await worker.start();
    await vi.waitFor(() => expect(service.streams).toHaveLength(2));
  });

  it('does not subscribe without handlers', async () => {
    const service = await eventsService([]);
    const { worker } = await run(service.url, {});

    expect(worker.isRunning).toBe(false);
    expect(service.streams).toHaveLength(0);
  });

  it('lets Mastra start its workers without platform credentials, and says why it is not listening', async () => {
    const worker = new ConnectEventWorker({ linear: () => {} });
    const error = vi.fn();
    const mastra = new Mastra({ workers: [worker], storage: new InMemoryStore() });
    instances.push(mastra);
    vi.spyOn(mastra.getLogger(), 'error').mockImplementation(error);

    await expect(mastra.startWorkers()).resolves.toBeUndefined();

    expect(worker.isRunning).toBe(false);
    expect(error).toHaveBeenCalledWith('Connect event worker could not subscribe', expect.anything());
  });
});

describe('Dispatcher', () => {
  const logger = { error: vi.fn() } as unknown as IMastraLogger;
  const tick = () => new Promise<void>(resolve => setImmediate(resolve));

  it('holds at most one save more than the events still being handled', async () => {
    const saved: Array<string | undefined> = [];
    const dispatcher = new Dispatcher(
      { load: () => undefined, save: cursor => void saved.push(cursor.eventId) },
      logger,
    );
    const subscription = dispatcher.cursorStore!;
    let release!: () => void;
    const stuck = new Promise<void>(resolve => (release = resolve));

    // The subscription saves each event when it reads the next, often before that event's handler finishes.
    await dispatcher.dispatch('conn_slow', () => stuck);
    let held = 0;
    for (let id = 1; id <= 2_000; id++) {
      subscription.save({ eventId: String(id) });
      await dispatcher.dispatch('conn_fast', tick);
      held = Math.max(held, dispatcher.heldSaves);
    }
    subscription.save({ eventId: '2001' });

    // At most 100 events wait on a handler, so at most 101 saves are held, not one per event read.
    expect(held).toBeLessThanOrEqual(101);
    // Once only the stuck event is left, one save covers everything read after it.
    await vi.waitFor(() => expect(dispatcher.heldSaves).toBe(1));
    expect(saved).toEqual([]);

    release();
    await dispatcher.drain();
    expect(saved).toEqual(['2001']);
  });

  it('keeps a save that a later stuck event would otherwise swallow, so the cursor moves once the earlier event finishes', async () => {
    const saved: Array<string | undefined> = [];
    const dispatcher = new Dispatcher(
      { load: () => undefined, save: cursor => void saved.push(cursor.eventId) },
      logger,
    );
    const subscription = dispatcher.cursorStore!;
    let finishA!: () => void;
    const a = new Promise<void>(resolve => (finishA = resolve));

    await dispatcher.dispatch('conn_1', () => a);
    subscription.save({ eventId: '11' });
    await dispatcher.dispatch('conn_2', () => new Promise<void>(() => {}));
    subscription.save({ eventId: '12' });
    expect(saved).toEqual([]);

    finishA();
    // Event 12 never finishes, but everything up to 11 has been handled.
    await vi.waitFor(() => expect(saved).toEqual(['11']));
  });
});
