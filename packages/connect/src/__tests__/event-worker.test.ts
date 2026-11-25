import type { ServerResponse } from 'node:http';

import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ConnectEventWorker, onConnectEvent } from '../event-worker.js';
import type { ConnectEventTrigger } from '../event-worker.js';
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
  sourceEventId?: string;
  resourceId?: string;
  unverified?: boolean;
}

function fields(delivery: Delivery): Record<string, string> {
  return {
    connectionId: 'conn_1',
    integrationId: delivery.provider,
    eventType: delivery.eventType,
    payload: JSON.stringify(delivery.payload ?? {}),
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

/** A workflow that records each input it runs with. */
function recordingWorkflow<TInput extends z.ZodTypeAny>(id: string, inputSchema: TInput) {
  const inputs: z.infer<TInput>[] = [];
  const record = createStep({
    id: 'record',
    inputSchema: z.any(),
    outputSchema: z.object({}),
    execute: async ({ inputData }) => {
      inputs.push(inputData);
      return {};
    },
  });
  const workflow = createWorkflow({ id, inputSchema, outputSchema: z.object({}) })
    .then(record)
    .commit();
  return { workflow, inputs };
}

const review = () => recordingWorkflow('review-pull-request', z.object({ repo: z.string(), number: z.number() }));

/** A real Mastra with in-memory storage, running a worker with `triggers`. */
async function run(
  url: string,
  triggers: ConnectEventTrigger[],
  workflows: Record<string, ReturnType<typeof review>['workflow']>,
  storage = new InMemoryStore(),
) {
  const worker = new ConnectEventWorker({
    accessToken: 'tok_secret',
    projectId: 'proj_1',
    eventsUrl: url,
    reconnectDelayMs: 5,
    triggers,
  });
  const mastra = new Mastra({ workflows, workers: [worker], logger: false, storage });
  instances.push(mastra);
  await mastra.startWorkers();
  return { worker, mastra, storage };
}

const prOpened = (number: number) => ({
  action: 'opened',
  number,
  pull_request: { title: 'Fix login', base: { ref: 'main' } },
  repository: { full_name: 'acme/app' },
});

const reviewTrigger = (workflow: ReturnType<typeof review>['workflow']) =>
  onConnectEvent({
    events: { github: ['pull_request.opened'] },
    workflow,
    inputData: event => ({ repo: event.payload.repository.full_name, number: event.payload.number }),
  });

describe('ConnectEventWorker', () => {
  it('starts the workflow once for each event it asked for, and for nothing else', async () => {
    const { workflow, inputs } = review();
    const service = await eventsService([
      { provider: 'github', eventType: 'pull_request.opened', payload: prOpened(7), sourceEventId: 'd-1' },
      { provider: 'github', eventType: 'push', payload: { ref: 'refs/heads/main' } },
      { provider: 'linear', eventType: 'Issue.create', payload: {} },
      // A forged delivery never starts a workflow.
      { provider: 'github', eventType: 'pull_request.opened', payload: prOpened(666), unverified: true },
      // The platform redelivered the webhook.
      { provider: 'github', eventType: 'pull_request.opened', payload: prOpened(7), sourceEventId: 'd-1' },
      { provider: 'github', eventType: 'pull_request.opened', payload: prOpened(8), sourceEventId: 'd-2' },
    ]);

    const { mastra } = await run(service.url, [reviewTrigger(workflow)], { review: workflow });

    await vi.waitFor(() => expect(inputs).toHaveLength(2));
    expect(inputs).toEqual([
      { repo: 'acme/app', number: 7 },
      { repo: 'acme/app', number: 8 },
    ]);
    const { runs } = await mastra.getWorkflow('review').listWorkflowRuns();
    expect(runs.map(r => r.runId).sort()).toEqual([
      'connect:review-pull-request:github:d-1',
      'connect:review-pull-request:github:d-2',
    ]);
  });

  it('skips an event whose input is undefined', async () => {
    const { workflow, inputs } = review();
    const service = await eventsService([
      { provider: 'github', eventType: 'pull_request.opened', payload: prOpened(1), sourceEventId: 'd-1' },
      {
        provider: 'github',
        eventType: 'pull_request.opened',
        payload: { ...prOpened(2), pull_request: { base: { ref: 'main' } } },
        sourceEventId: 'd-2',
      },
    ]);

    const { mastra } = await run(
      service.url,
      [
        onConnectEvent({
          events: { github: ['pull_request.opened'] },
          workflow,
          inputData: event =>
            event.payload.pull_request.base.ref === 'main' && event.payload.number !== 1
              ? { repo: event.payload.repository.full_name, number: event.payload.number }
              : undefined,
        }),
      ],
      { review: workflow },
    );

    await vi.waitFor(() => expect(inputs).toEqual([{ repo: 'acme/app', number: 2 }]));
    const { runs } = await mastra.getWorkflow('review').listWorkflowRuns();
    expect(runs.map(r => r.runId)).toEqual(['connect:review-pull-request:github:d-2']);
  });

  it("doesn't start a workflow again for an event a previous subscription already handled", async () => {
    const { workflow, inputs } = review();
    const service = await eventsService([
      { provider: 'github', eventType: 'pull_request.opened', payload: prOpened(7), sourceEventId: 'd-1' },
    ]);
    const { mastra, storage } = await run(service.url, [reviewTrigger(workflow)], { review: workflow });
    await vi.waitFor(async () => {
      const { runs } = await mastra.getWorkflow('review').listWorkflowRuns();
      expect(runs.map(r => r.snapshot)).toMatchObject([{ status: 'success' }]);
    });
    await mastra.stopWorkers();

    // A restart without a saved cursor receives the same event again.
    const again = review();
    await run(service.url, [reviewTrigger(again.workflow)], { review: again.workflow }, storage);
    await vi.waitFor(() => expect(service.streams).toHaveLength(2));
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(inputs).toHaveLength(1);
    expect(again.inputs).toHaveLength(0);
  });

  it("gives the run the end user the event's connection belongs to", async () => {
    const { workflow } = review();
    const service = await eventsService([
      {
        provider: 'github',
        eventType: 'pull_request.opened',
        payload: prOpened(7),
        sourceEventId: 'd-1',
        resourceId: 'user_42',
      },
    ]);
    const { mastra } = await run(service.url, [reviewTrigger(workflow)], { review: workflow });

    await vi.waitFor(async () => {
      const { runs } = await mastra.getWorkflow('review').listWorkflowRuns();
      expect(runs).toMatchObject([{ runId: 'connect:review-pull-request:github:d-1', resourceId: 'user_42' }]);
    });
  });

  it('starts every workflow an event triggers, and only those', async () => {
    const reviewed = review();
    const audited = recordingWorkflow('audit', z.object({ provider: z.string(), eventType: z.string() }));
    const pinged = recordingWorkflow('ping', z.object({ unverified: z.boolean() }));
    const service = await eventsService([
      { provider: 'github', eventType: 'pull_request.opened', payload: prOpened(7), sourceEventId: 'd-1' },
      // Connect has no payload type for GitHub's `ping`, so only a trigger that lists it gets it.
      { provider: 'github', eventType: 'ping', payload: { zen: 'Keep it logically awesome.' }, sourceEventId: 'g-1' },
      { provider: 'github', eventType: 'ping', unverified: true, sourceEventId: 'g-2' },
      { provider: 'linear', eventType: 'Issue.create', payload: {}, sourceEventId: 'l-1' },
    ]);

    await run(
      service.url,
      [
        reviewTrigger(reviewed.workflow),
        onConnectEvent({
          workflow: audited.workflow,
          inputData: event => ({ provider: event.provider, eventType: event.eventType }),
        }),
        onConnectEvent({
          events: { github: ['ping'] },
          includeUnverified: true,
          workflow: pinged.workflow,
          inputData: event => ({ unverified: event.unverified }),
        }),
      ],
      { review: reviewed.workflow, audit: audited.workflow, ping: pinged.workflow },
    );

    await vi.waitFor(() => expect(audited.inputs).toHaveLength(2));
    expect(audited.inputs).toEqual([
      { provider: 'github', eventType: 'pull_request.opened' },
      { provider: 'linear', eventType: 'Issue.create' },
    ]);
    expect(reviewed.inputs).toEqual([{ repo: 'acme/app', number: 7 }]);
    await vi.waitFor(() => expect(pinged.inputs).toEqual([{ unverified: false }, { unverified: true }]));
  });

  it('keeps starting workflows after one event fails, and when a workflow is not registered', async () => {
    const { workflow, inputs } = review();
    const unregistered = recordingWorkflow('not-registered', z.object({}));
    const service = await eventsService([
      { provider: 'github', eventType: 'pull_request.opened', payload: { action: 'opened' }, sourceEventId: 'd-1' },
      { provider: 'github', eventType: 'pull_request.opened', payload: prOpened(8), sourceEventId: 'd-2' },
    ]);

    await run(
      service.url,
      [onConnectEvent({ workflow: unregistered.workflow, inputData: () => ({}) }), reviewTrigger(workflow)],
      { review: workflow },
    );

    // The first payload has no repository, so its input can't be built.
    await vi.waitFor(() => expect(inputs).toEqual([{ repo: 'acme/app', number: 8 }]));
    expect(unregistered.inputs).toHaveLength(0);
  });

  it('starts only workflows for unverified events when asked to', async () => {
    const { workflow, inputs } = recordingWorkflow('log', z.object({ unverified: z.boolean() }));
    const service = await eventsService([
      { provider: 'posthog', eventType: '$pageview', unverified: true, sourceEventId: 'p-1' },
    ]);

    await run(
      service.url,
      [
        onConnectEvent({
          events: { posthog: true },
          includeUnverified: true,
          workflow,
          inputData: event => ({ unverified: event.unverified }),
        }),
      ],
      { log: workflow },
    );

    await vi.waitFor(() => expect(inputs).toEqual([{ unverified: true }]));
  });

  it('stops listening when stopped, and listens again when started', async () => {
    const { workflow } = review();
    const service = await eventsService([]);
    const { worker } = await run(service.url, [reviewTrigger(workflow)], { review: workflow });
    await vi.waitFor(() => expect(service.streams).toHaveLength(1));
    expect(worker.isRunning).toBe(true);

    await worker.stop({ drainTimeout: 1_000 });
    expect(worker.isRunning).toBe(false);
    await vi.waitFor(() => expect(service.streams[0]!.destroyed || service.streams[0]!.writableEnded).toBe(true));

    await worker.start();
    await vi.waitFor(() => expect(service.streams).toHaveLength(2));
  });

  it('lets Mastra start its workers without platform credentials, and says why it is not listening', async () => {
    const { workflow } = review();
    const worker = new ConnectEventWorker({ triggers: [reviewTrigger(workflow)] });
    const error = vi.fn();
    const mastra = new Mastra({ workflows: { review: workflow }, workers: [worker], storage: new InMemoryStore() });
    instances.push(mastra);
    vi.spyOn(mastra.getLogger(), 'error').mockImplementation(error);

    await expect(mastra.startWorkers()).resolves.toBeUndefined();

    expect(worker.isRunning).toBe(false);
    expect(error).toHaveBeenCalledWith('Connect event worker could not subscribe', expect.anything());
  });
});
