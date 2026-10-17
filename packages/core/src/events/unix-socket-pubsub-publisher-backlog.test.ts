import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { UnixSocketPubSub } from './unix-socket-pubsub';

it('bounds publisher writes when a real broker stops reading (COR-1454)', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mastra-publisher-backlog-'));
  const path = join(directory, 'events.sock');
  const broker = new UnixSocketPubSub(path);
  const cap = 2 * 1024 * 1024;
  const publisher = new UnixSocketPubSub(path, { maxPublisherQueuedBytes: cap });
  const servers = vi.spyOn(net, 'createServer');
  let peer: net.Socket | undefined;
  let writes: ReturnType<typeof vi.spyOn> | undefined;
  const pending: Promise<unknown>[] = [];
  try {
    const received: string[] = [];
    await broker.subscribe('topic', async event => {
      received.push(event.runId);
    });
    const server = servers.mock.results.find(result => result.type === 'return')?.value;
    expect(server).toBeInstanceOf(net.Server);
    server!.on('connection', socket => {
      peer = socket;
    });
    await publisher.subscribe('topic', async () => {});
    expect(peer).toBeDefined();
    peer!.pause();
    const socketWrites = vi.spyOn(net.Socket.prototype, 'write');
    writes = socketWrites;
    for (let index = 0; index < 32; index++) {
      pending.push(
        publisher
          .publish('topic', {
            type: 'test',
            runId: `run-${index}`,
            data: { payload: 'x'.repeat(256 * 1024) },
          })
          .then(
            () => 'sent',
            error => error,
          ),
      );
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    const outgoing = socketWrites.mock.calls.findIndex(
      call => typeof call[0] === 'string' && call[0].startsWith('{"type":"publish"'),
    );
    const socket = socketWrites.mock.contexts[outgoing];
    expect(socket).toBeInstanceOf(net.Socket);
    if (!(socket instanceof net.Socket)) throw new Error('Publisher socket was not captured');
    expect(socket.writableLength).toBeLessThanOrEqual(cap);
    peer!.resume();
    const outcomes = await Promise.all(pending);
    const rejected = outcomes.filter(outcome => outcome instanceof Error);
    expect(rejected.length).toBeGreaterThan(0);
    for (const error of rejected) {
      expect(error).toHaveProperty('message', 'UnixSocketPubSub publisher queue exceeds maxPublisherQueuedBytes');
    }
    await vi.waitFor(() => expect(received).toHaveLength(outcomes.length - rejected.length));
    await publisher.publish('topic', { type: 'test', runId: 'after-drain', data: {} });
    await vi.waitFor(() => expect(received).toContain('after-drain'));
  } finally {
    writes?.mockRestore();
    servers.mockRestore();
    await publisher.close();
    await broker.close();
    await Promise.allSettled(pending);
    await rm(directory, { recursive: true, force: true });
  }
});

it.each([0, -1, NaN, Infinity])('rejects an invalid publisher queue cap (%s)', cap => {
  expect(() => new UnixSocketPubSub('/tmp/unused-publisher.sock', { maxPublisherQueuedBytes: cap })).toThrow(
    'maxPublisherQueuedBytes must be a positive finite number',
  );
});

it.each([
  {
    name: 'oversized ASCII frame',
    options: { maxInboundFrameBytes: 1024 },
    payload: 'x'.repeat(2048),
    error: 'outgoing frame exceeds maxInboundFrameBytes',
    multibyte: false,
  },
  {
    name: 'UTF-8 frame limit',
    options: { maxInboundFrameBytes: 1024 },
    payload: 'é'.repeat(512),
    error: 'outgoing frame exceeds maxInboundFrameBytes',
    multibyte: true,
  },
  {
    name: 'UTF-8 publisher queue limit',
    options: { maxPublisherQueuedBytes: 1024 },
    payload: 'é'.repeat(512),
    error: 'publisher queue exceeds maxPublisherQueuedBytes',
    multibyte: true,
  },
])('enforces $name without breaking the broker connection', async ({ options, payload, error, multibyte }) => {
  const directory = await mkdtemp(join(tmpdir(), 'mastra-publisher-frame-'));
  const path = join(directory, 'events.sock');
  const broker = new UnixSocketPubSub(path);
  const publisher = new UnixSocketPubSub(path, options);
  const received: string[] = [];
  try {
    await broker.subscribe('topic', async event => {
      received.push(event.runId);
    });
    await publisher.subscribe('topic', async () => {});
    const event = { type: 'test', runId: 'oversized', data: { payload } };
    if (multibyte) {
      const frame = JSON.stringify({ type: 'publish', topic: 'topic', event });
      expect(frame.length).toBeLessThan(1024);
      expect(Buffer.byteLength(frame)).toBeGreaterThan(1024);
    }
    await expect(publisher.publish('topic', event)).rejects.toThrow(error);
    await publisher.publish('topic', { type: 'test', runId: 'small', data: {} });
    await vi.waitFor(() => expect(received).toEqual(['small']));
  } finally {
    await publisher.close();
    await broker.close();
    await rm(directory, { recursive: true, force: true });
  }
});
