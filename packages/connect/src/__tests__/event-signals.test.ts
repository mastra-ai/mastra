import type { ServerResponse } from 'node:http';

import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import type { SignalProviderTarget } from '@mastra/core/signals';
import { InMemoryStore } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConnectEventFilter } from '../event-filter.js';
import { ConnectEventSignals } from '../event-signals.js';
import type { ConnectEventSignalsOptions } from '../event-signals.js';
import { event, eventsServer, ready, startStream } from './events-server.js';

const servers: Array<{ close(): Promise<void> }> = [];
const providers: ConnectEventSignals<any, any>[] = [];

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
  for (const provider of providers.splice(0)) provider.stop();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await Promise.all(servers.splice(0).map(s => s.close()));
});

/** Persist notifications without waking the thread, so no model runs. */
const ops: SignalProviderTarget = { threadId: 'ops', resourceId: 'team-ops', ifIdle: { behavior: 'persist' } };

interface Delivery {
  provider: string;
  eventType: string;
  payload?: unknown;
  rawPayload?: string;
  connectionId?: string;
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

/** A local events service that streams `deliveries` on the first connection, then holds it open. */
async function eventsService(deliveries: Delivery[]) {
  const streams: ServerResponse[] = [];
  const s = await eventsServer([
    (_req, res) => {
      streams.push(res);
      startStream(res);
      res.write(ready('10'));
      deliveries.forEach((delivery, index) => res.write(event(String(11 + index), fields(delivery))));
    },
    (_req, res) => {
      streams.push(res);
      startStream(res);
      res.write(ready('100'));
    },
  ]);
  servers.push(s);
  return { ...s, streams };
}

function model() {
  const prompts: unknown[] = [];
  const mock = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      prompts.push(prompt);
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start' as const, warnings: [] },
          { type: 'text-start' as const, id: 't' },
          { type: 'text-delta' as const, id: 't', delta: 'Looking into it.' },
          { type: 'text-end' as const, id: 't' },
          {
            type: 'finish' as const,
            finishReason: 'stop' as const,
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          },
        ]),
      };
    },
  });
  return { mock, prompts };
}

/** An agent on a real Mastra with in-memory storage, listening through `signals`. */
function opsAgent<const F extends ConnectEventFilter | undefined = undefined, U extends boolean = false>(
  url: string,
  options: Omit<ConnectEventSignalsOptions<F, U>, 'accessToken' | 'projectId' | 'eventsUrl'>,
) {
  const signals = new ConnectEventSignals<F, U>({
    accessToken: 'tok_secret',
    projectId: 'proj_1',
    eventsUrl: url,
    reconnectDelayMs: 5,
    ...options,
  } as ConnectEventSignalsOptions<F, U>);
  providers.push(signals);
  const { mock, prompts } = model();
  const agent = new Agent({ id: 'ops', name: 'Ops', instructions: 'Triage events.', model: mock, signals: [signals] });
  const mastra = new Mastra({ agents: { ops: agent }, logger: false, storage: new InMemoryStore() });
  async function notifications(threadId = ops.threadId) {
    const store = await mastra.getStorage()!.getStore('notifications');
    const records = await store!.listNotifications({ threadId });
    return records.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  return { signals, agent, mastra, prompts, notifications };
}

const prOpened = { action: 'opened', number: 7, pull_request: { title: 'Fix login' } };

describe('ConnectEventSignals', () => {
  it('notifies the agent of the events it asked for, once each, and nothing else', async () => {
    const service = await eventsService([
      { provider: 'github', eventType: 'pull_request.opened', payload: prOpened, sourceEventId: 'd-1' },
      { provider: 'github', eventType: 'push', payload: { ref: 'refs/heads/main' } },
      { provider: 'posthog', eventType: '$pageview', payload: {} },
      // Forged or unreadable deliveries never reach the agent.
      { provider: 'github', eventType: 'pull_request.opened', payload: prOpened, unverified: true },
      { provider: 'github', eventType: 'pull_request.opened', rawPayload: '{not json' },
      // The provider redelivered the same webhook.
      { provider: 'github', eventType: 'pull_request.opened', payload: prOpened, sourceEventId: 'd-1' },
      { provider: 'linear', eventType: 'Issue.create', payload: { data: { id: 'iss_1' } } },
    ]);
    const { notifications } = opsAgent(service.url, {
      events: { github: ['pull_request.opened'], linear: true },
      target: ops,
    });

    await vi.waitFor(async () => expect(await notifications()).toHaveLength(2));
    // The last event delivered; give a duplicate time to land if it would.
    await new Promise(resolve => setTimeout(resolve, 50));
    const records = await notifications();
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      source: 'connect',
      kind: 'github:pull_request.opened',
      summary: 'github pull_request.opened',
      payload: prOpened,
      dedupeKey: 'connect:github:d-1',
      agentId: 'ops',
      resourceId: 'team-ops',
      // The redelivery updates this notification instead of adding one.
      metadata: expect.objectContaining({
        connectionId: 'conn_1',
        eventId: expect.any(String),
        provider: 'github',
        eventType: 'pull_request.opened',
      }),
    });
    expect(records[1]).toMatchObject({ kind: 'linear:Issue.create', payload: { data: { id: 'iss_1' } } });
  });

  it('sends every verified event when no filter is given, but only typed events of a typed provider', async () => {
    const service = await eventsService([
      { provider: 'posthog', eventType: '$pageview', payload: { distinct_id: 'u1' } },
      { provider: 'github', eventType: 'push', payload: { ref: 'refs/heads/main' }, unverified: true },
      // No typed payload for GitHub's `ping`, or for a Jira body that isn't JSON.
      { provider: 'github', eventType: 'ping', payload: { zen: 'Keep it logically awesome.' } },
      { provider: 'jira', eventType: 'jira:issue_created', rawPayload: 'not json' },
      { provider: 'github', eventType: 'push', payload: { ref: 'refs/heads/next' } },
      { provider: 'posthog', eventType: '$pageview', rawPayload: 'not json' },
    ]);
    const { notifications } = opsAgent(service.url, { target: ops });

    await vi.waitFor(async () => expect(await notifications()).toHaveLength(3));
    expect((await notifications()).map(record => [record.kind, record.payload])).toEqual([
      ['posthog:$pageview', { distinct_id: 'u1' }],
      ['github:push', { ref: 'refs/heads/next' }],
      ['posthog:$pageview', 'not json'],
    ]);
  });

  it('routes each event to its own thread, with the notification the app wrote', async () => {
    const service = await eventsService([
      { provider: 'github', eventType: 'pull_request.opened', payload: prOpened, connectionId: 'conn_acme' },
      { provider: 'github', eventType: 'pull_request.opened', payload: prOpened, connectionId: 'conn_ignored' },
      { provider: 'linear', eventType: 'Issue.create', payload: {}, connectionId: 'conn_acme' },
    ]);
    const { notifications, mastra } = opsAgent(service.url, {
      events: { github: ['pull_request.opened'], linear: true },
      target: event =>
        event.connectionId === 'conn_ignored'
          ? undefined
          : {
              threadId: `${event.provider}:${event.connectionId}`,
              resourceId: 'team-ops',
              ifIdle: { behavior: 'persist' },
            },
      notification: event =>
        event.provider === 'github'
          ? { summary: `PR ${event.payload.action}: ${event.payload.pull_request.title}`, priority: 'high' }
          : undefined,
    });

    const errors = vi.spyOn(mastra.getLogger(), 'error');

    await vi.waitFor(async () => expect(await notifications('linear:conn_acme')).toHaveLength(1));
    // Dropping an event on purpose isn't a delivery failure.
    expect(errors).not.toHaveBeenCalled();
    expect(await notifications('github:conn_acme')).toEqual([
      expect.objectContaining({
        summary: 'PR opened: Fix login',
        priority: 'high',
        kind: 'github:pull_request.opened',
      }),
    ]);
    expect(await notifications('github:conn_ignored')).toEqual([]);
    expect(await notifications('linear:conn_acme')).toEqual([
      expect.objectContaining({ summary: 'linear Issue.create', kind: 'linear:Issue.create' }),
    ]);
  });

  it("routes an end user's connection's events to that user", async () => {
    const service = await eventsService([
      { provider: 'linear', eventType: 'Issue.create', payload: {}, connectionId: 'conn_ada', resourceId: 'user_ada' },
      { provider: 'linear', eventType: 'Issue.create', payload: {}, connectionId: 'conn_team' },
    ]);
    const { notifications } = opsAgent(service.url, {
      target: event => ({
        threadId: `inbox:${event.resourceId ?? 'team'}`,
        resourceId: event.resourceId ?? 'team-ops',
        ifIdle: { behavior: 'persist' },
      }),
    });

    await vi.waitFor(async () => expect(await notifications('inbox:team')).toHaveLength(1));
    expect(await notifications('inbox:user_ada')).toEqual([
      expect.objectContaining({
        resourceId: 'user_ada',
        metadata: expect.objectContaining({ connectionId: 'conn_ada', resourceId: 'user_ada' }),
      }),
    ]);
    const [team] = await notifications('inbox:team');
    expect(team).toMatchObject({ resourceId: 'team-ops' });
    expect(team!.metadata).not.toHaveProperty('resourceId');
  });

  it('delivers unverified events, marked as such, only when asked to', async () => {
    const service = await eventsService([
      { provider: 'linear', eventType: 'Issue.create', payload: { data: { id: 'iss_1' } }, unverified: true },
    ]);
    const { notifications } = opsAgent(service.url, {
      events: { linear: ['Issue.create'] },
      includeUnverified: true,
      target: ops,
    });

    await vi.waitFor(async () => expect(await notifications()).toHaveLength(1));
    expect((await notifications())[0]).toMatchObject({
      summary: 'linear Issue.create (unverified)',
      metadata: expect.objectContaining({ unverified: true }),
    });
  });

  it('keeps delivering after one event fails', async () => {
    const service = await eventsService([
      { provider: 'linear', eventType: 'Issue.create', payload: { data: { id: 'bad' } } },
      { provider: 'linear', eventType: 'Issue.create', payload: { data: { id: 'good' } } },
    ]);
    const { notifications } = opsAgent(service.url, {
      target: event => {
        if ((event.payload as { data: { id: string } }).data.id === 'bad') throw new Error('no thread for this');
        return ops;
      },
    });

    await vi.waitFor(async () => expect(await notifications()).toHaveLength(1));
    expect((await notifications())[0]!.payload).toEqual({ data: { id: 'good' } });
  });

  it('wakes the idle agent with the event', async () => {
    const service = await eventsService([
      { provider: 'github', eventType: 'pull_request.opened', payload: prOpened, sourceEventId: 'd-1' },
    ]);
    const { prompts } = opsAgent(service.url, {
      target: { threadId: 'ops', resourceId: 'team-ops' },
      notification: () => ({ summary: 'PR opened: Fix login' }),
    });

    await vi.waitFor(() => expect(prompts).toHaveLength(1), { timeout: 5_000 });
    expect(JSON.stringify(prompts[0])).toContain('PR opened: Fix login');
  });

  it('caps how many events of one connection wake the agent, and stores the rest', async () => {
    const burst = (connectionId: string, count: number) =>
      Array.from({ length: count }, (_, i) => ({
        provider: 'linear',
        eventType: 'Issue.create',
        payload: { data: { id: `${connectionId}-${i}` } },
        connectionId,
        sourceEventId: `${connectionId}-${i}`,
      }));
    const service = await eventsService([...burst('conn_noisy', 20), ...burst('conn_quiet', 1)]);
    const { prompts, notifications } = opsAgent(service.url, {
      target: { threadId: 'ops', resourceId: 'team-ops' },
      rateLimit: { limit: 1, windowMs: 60_000 },
    });

    await vi.waitFor(async () => expect(await notifications()).toHaveLength(21), { timeout: 5_000 });
    const limited = (await notifications())
      .filter(n => n.metadata?.rateLimited)
      .map(n => (n.payload as { data: { id: string } }).data.id);
    // The first event of each connection wakes the agent; the noisy one's other 19 don't.
    expect(limited.sort()).toEqual(
      burst('conn_noisy', 20)
        .slice(1)
        .map(d => d.payload.data.id)
        .sort(),
    );
  });

  it("doesn't count events whose target never wakes the agent against the rate limit", async () => {
    const service = await eventsService(
      ['quiet-0', 'quiet-1', 'loud-0', 'loud-1'].map(id => ({
        provider: 'linear',
        eventType: 'Issue.create',
        payload: { data: { id } },
        sourceEventId: id,
      })),
    );
    const { notifications } = opsAgent(service.url, {
      // Quiet events are only stored or dropped, so only the first loud one may wake the agent.
      target: event => {
        const { id } = (event.payload as { data: { id: string } }).data;
        if (id === 'quiet-0') return ops;
        if (id === 'quiet-1') return { ...ops, ifIdle: { behavior: 'discard' } };
        return { threadId: 'ops', resourceId: 'team-ops' };
      },
      rateLimit: { limit: 1, windowMs: 60_000 },
    });

    await vi.waitFor(async () => expect(await notifications()).toHaveLength(4), { timeout: 5_000 });
    const limited = Object.fromEntries(
      (await notifications()).map(n => [(n.payload as { data: { id: string } }).data.id, !!n.metadata?.rateLimited]),
    );
    expect(limited).toEqual({ 'quiet-0': false, 'quiet-1': false, 'loud-0': false, 'loud-1': true });
  });

  describe('a steady stream of events from one connection', () => {
    // Each event is sent once the agent is done with the one before: its run
    // has finished, or it was only stored. So every event that may wake the
    // agent finds it idle and starts its own run.
    async function runs(rateLimit?: { limit: number; windowMs: number }) {
      let stream: ServerResponse | undefined;
      const s = await eventsServer([
        (_req, res) => {
          startStream(res);
          res.write(ready('10'));
          stream = res;
        },
      ]);
      servers.push(s);
      const { agent, prompts } = opsAgent(s.url, {
        target: { threadId: 'ops', resourceId: 'team-ops' },
        ...(rateLimit ? { rateLimit } : {}),
      });
      const done: Promise<void>[] = [];
      const send = agent.sendNotificationSignal.bind(agent) as (
        ...args: Parameters<typeof agent.sendNotificationSignal>
      ) => Promise<Awaited<ReturnType<typeof agent.sendNotificationSignal>>>;
      vi.spyOn(agent, 'sendNotificationSignal').mockImplementation((async (
        ...args: Parameters<typeof agent.sendNotificationSignal>
      ) => {
        const result = await send(...args);
        done.push(
          (async () => {
            const accepted = await result.accepted;
            if (accepted?.action === 'wake') await accepted.output.getFullOutput();
            await result.persisted;
          })(),
        );
        return result;
      }) as typeof agent.sendNotificationSignal);

      await vi.waitFor(() => expect(stream).toBeDefined());
      for (let i = 0; i < 4; i++) {
        stream!.write(
          event(
            String(11 + i),
            fields({
              provider: 'linear',
              eventType: 'Issue.create',
              payload: { data: { id: `i${i}` } },
              sourceEventId: `i${i}`,
            }),
          ),
        );
        await vi.waitFor(() => expect(done).toHaveLength(i + 1), { timeout: 5_000 });
        await done[i];
      }
      return prompts.length;
    }

    it('wakes the agent for each event without a rate limit', async () => {
      expect(await runs()).toBe(4);
    });

    it('wakes the agent only up to the rate limit', async () => {
      expect(await runs({ limit: 1, windowMs: 60_000 })).toBe(1);
    });
  });

  it("lets a connection wake the agent again once the rate limit's window passes", async () => {
    const issue = (id: string) => ({
      provider: 'linear',
      eventType: 'Issue.create',
      payload: { data: { id } },
      sourceEventId: id,
    });
    const streams: ServerResponse[] = [];
    const s = await eventsServer([
      (_req, res) => {
        streams.push(res);
        startStream(res);
        res.write(ready('10'));
        res.write(event('11', fields(issue('a'))));
        res.write(event('12', fields(issue('b'))));
        setTimeout(() => {
          res.write(event('13', fields(issue('c'))));
          res.write(event('14', fields(issue('d'))));
        }, 400);
      },
    ]);
    servers.push(s);
    const { notifications } = opsAgent(s.url, {
      target: { threadId: 'ops', resourceId: 'team-ops' },
      rateLimit: { limit: 1, windowMs: 200 },
    });

    await vi.waitFor(async () => expect(await notifications()).toHaveLength(4), { timeout: 5_000 });
    const limited = (await notifications()).map(n => [
      (n.payload as { data: { id: string } }).data.id,
      !!n.metadata?.rateLimited,
    ]);
    expect(limited).toEqual([
      ['a', false],
      ['b', true],
      ['c', false],
      ['d', true],
    ]);
  });

  it('rejects a rate limit that could never be met', () => {
    for (const rateLimit of [
      { limit: -1, windowMs: 1000 },
      { limit: 1.5, windowMs: 1000 },
      { limit: 1, windowMs: 0 },
    ]) {
      expect(() => new ConnectEventSignals({ target: ops, rateLimit })).toThrow(
        expect.objectContaining({ code: 'invalid_options' }),
      );
    }
  });

  it('stops listening when stopped, and listens again when started', async () => {
    const service = await eventsService([]);
    const { signals } = opsAgent(service.url, { target: ops });
    await vi.waitFor(() => expect(service.streams).toHaveLength(1));

    signals.stop();
    await vi.waitFor(() => expect(service.streams[0]!.destroyed || service.streams[0]!.writableEnded).toBe(true));

    signals.start();
    await vi.waitFor(() => expect(service.streams).toHaveLength(2));
  });

  it('lets the agent start without platform credentials, and says why it is not listening', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const signals = new ConnectEventSignals({ target: ops });
    providers.push(signals);
    const { mock } = model();

    const agent = new Agent({ id: 'ops', name: 'Ops', instructions: 'x', model: mock, signals: [signals] });

    expect(agent.id).toBe('ops');
    expect(logged).toHaveBeenCalledWith(
      'Connect event signals could not subscribe',
      expect.objectContaining({ error: expect.objectContaining({ code: 'missing_access_token' }) }),
    );
  });
});
