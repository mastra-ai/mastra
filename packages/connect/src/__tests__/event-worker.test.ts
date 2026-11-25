import type { ServerResponse } from 'node:http';

import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ConnectClient } from '../connect-client.js';
import { ConnectEventWorker } from '../event-worker.js';
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
    connectionId: 'conn_1',
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

  it('gives handlers Mastra, its logger, and a Connect client for the project', async () => {
    const service = await eventsService([
      { provider: 'linear', eventType: 'Issue.create', payload: { data: { id: 'iss_1' } }, resourceId: 'user_ada' },
    ]);
    const contexts: unknown[] = [];
    const { mastra } = await run(service.url, { linear: context => void contexts.push(context) });

    await vi.waitFor(() => expect(contexts).toHaveLength(1));
    expect(contexts[0]).toEqual({
      event: expect.objectContaining({ provider: 'linear', resourceId: 'user_ada' }),
      mastra,
      logger: mastra.getLogger(),
      connect: expect.any(ConnectClient),
    });
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
