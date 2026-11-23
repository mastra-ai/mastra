/**
 * #28750 end to end: an AgentController session (one per conversation on a
 * server) subscribes to its thread with initial history, which reads the
 * thread lease from Redis. A TCP proxy in front of the real Redis lets the test
 * stall or reset exactly that lease read. The session must still open and be
 * able to run a turn against an AIMock-served model once Redis answers again.
 */
import { connect, createServer } from 'node:net';
import type { Server, Socket } from 'node:net';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { InMemoryStore } from '@mastra/core/storage';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { flushRedis, getFreePort, REDIS_URL } from '../test-fixtures/harness';
import { RedisStreamsPubSub } from './index';

type Fault = 'stall' | 'reset';

// Default lease renew interval (TTL 15 s / 3): how long initial history waits for the lease read.
const LEASE_READ_DEADLINE_MS = 5_000;

const isLeaseGet = (buf: Buffer) => {
  const text = buf.toString('latin1');
  return text.includes('\r\n$3\r\nGET\r\n') && text.includes('mastra:topic:lease:');
};

/** Forwards to Redis; once armed, stalls or resets the connection that sends a lease GET. */
async function startProxy(fault: Fault) {
  const upstreamUrl = new URL(REDIS_URL);
  const state = { armed: false, hit: false };
  const sockets = new Set<Socket>();
  const stalledClients = new Set<Socket>();
  const server: Server = createServer(client => {
    sockets.add(client);
    const redis = connect(Number(upstreamUrl.port || 6379), upstreamUrl.hostname);
    sockets.add(redis);
    let stalled = false;
    client.on('data', buf => {
      if (stalled) return;
      if (state.armed && isLeaseGet(buf)) {
        state.armed = false;
        state.hit = true;
        if (fault === 'stall') {
          stalled = true;
          stalledClients.add(client);
          return;
        }
        client.resetAndDestroy();
        redis.destroy();
        return;
      }
      redis.write(buf);
    });
    redis.on('data', buf => {
      if (!stalled) client.write(buf);
    });
    client.on('error', () => redis.destroy());
    redis.on('error', () => client.destroy());
    client.on('close', () => redis.destroy());
  });
  const port = await getFreePort();
  await new Promise<void>(resolve => server.listen(port, '127.0.0.1', resolve));
  return {
    url: `redis://127.0.0.1:${port}`,
    state,
    /** Backend recovers: drop the stalled connection so the client reconnects. */
    recover: () => {
      for (const socket of stalledClients) socket.destroy();
    },
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>(resolve => server.close(() => resolve()));
    },
  };
}

describe('AgentController session over Redis when the lease read misbehaves (#28750)', () => {
  let llm: LLMock;
  const cleanups: Array<() => Promise<void>> = [];

  beforeAll(async () => {
    llm = new LLMock({ port: 0 });
    await llm.start();
    llm.on({ endpoint: 'chat' }, { content: 'Hello from aimock.' });
  });
  afterAll(async () => {
    await llm.stop();
  });
  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!().catch(() => {});
    await flushRedis();
  });

  it.each([
    ['stall', LEASE_READ_DEADLINE_MS],
    ['reset', 0],
  ] as const)('opens a session and runs a turn when the lease read %ss', async (fault, minOpenMs) => {
    const proxy = await startProxy(fault);
    cleanups.push(proxy.close);
    const pubsub = new RedisStreamsPubSub({ url: proxy.url, blockMs: 200 });
    cleanups.push(() => pubsub.close());
    cleanups.push(async () => proxy.recover());

    const openai = createOpenAI({ apiKey: 'aimock', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
    const agent = new Agent({
      id: 'lease-read-agent',
      name: 'lease-read-agent',
      instructions: 'Reply briefly.',
      model: openai.chat('gpt-4o-mini'),
    });
    const controller = new AgentController({
      id: 'lease-read-controller',
      storage: new InMemoryStore(),
      pubsub,
      initialState: { yolo: true },
      modes: [{ id: 'default', name: 'Default', default: true, agent, defaultModelId: 'openai/gpt-4o-mini' }],
    });
    await controller.init();

    proxy.state.armed = true;
    const started = Date.now();
    const opened = controller.createSession({
      id: 'session-1',
      ownerId: 'owner',
      resourceId: 'user-1',
      threadId: 'thread-1',
    });
    const session = await Promise.race([
      opened,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('createSession still pending')), LEASE_READ_DEADLINE_MS + 5_000),
      ),
    ]);
    const openMs = Date.now() - started;
    expect(proxy.state.hit).toBe(true);
    expect(openMs).toBeGreaterThanOrEqual(minOpenMs - 50);
    expect(openMs).toBeLessThan(LEASE_READ_DEADLINE_MS + 2_000);

    proxy.recover();
    const events: any[] = [];
    const unsubscribe = session.subscribe(event => {
      events.push(event);
    });
    cleanups.push(async () => unsubscribe());
    await session.sendMessage({ content: 'hi' });
    const text = events
      .filter(event => event.type === 'message_update' && event.event?.type === 'text-delta')
      .map(event => event.event.delta)
      .join('');
    expect(text).toBe('Hello from aimock.');
    expect(events.find(event => event.type === 'agent_end')).toMatchObject({ reason: 'complete' });
  });
});
