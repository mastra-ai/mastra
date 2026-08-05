/**
 * End-to-end serialization tests for the codec at the UnixSocketPubSub wire
 * boundary.
 *
 * These tests publish events through a real Unix-socket broker → client round
 * trip and verify that values which `JSON.stringify` would normally lose or
 * mangle survive intact:
 *  - `Date` instances (preserve identity & time)
 *  - `Error` instances (preserve `name`, `message`, `stack`, `cause`)
 *  - `Map` / `Set` instances (preserve type & entries)
 *  - explicit `undefined` properties
 *  - `DefaultGeneratedFile` class instances (via the class registry)
 *  - nested combinations of the above inside a workflow.step.end-shaped payload
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { DefaultGeneratedFile } from '../stream/aisdk/v5/file';
import type { Event } from './types';
import { UnixSocketPubSub } from './unix-socket-pubsub';

function makeEvent(data: Record<string, any>, type = 'codec-test'): Omit<Event, 'id' | 'createdAt'> {
  return { type, data, runId: 'run-1' };
}

async function waitFor(assertion: () => void, timeoutMs = 1500): Promise<void> {
  const start = Date.now();
  let lastError: unknown;
  while (Date.now() - start < timeoutMs) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  throw lastError;
}

describe('UnixSocketPubSub codec round-trips', () => {
  const pubsubs: UnixSocketPubSub[] = [];
  let tempDir: string | undefined;

  async function socketPath(name = 'codec.sock') {
    tempDir ??= await mkdtemp(join(tmpdir(), 'mastra-uds-codec-'));
    return join(tempDir, name);
  }

  afterEach(async () => {
    await Promise.allSettled(pubsubs.splice(0).map(pubsub => pubsub.close()));
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  /**
   * Set up a broker + client pair, subscribe on both, return the client's
   * received-event capture so the test can publish from the broker and observe
   * what survived the JSON wire encode/decode through the codec.
   */
  async function setupPair(topic: string) {
    const path = await socketPath();
    const broker = new UnixSocketPubSub(path);
    const client = new UnixSocketPubSub(path);
    pubsubs.push(broker, client);

    const received: Event[] = [];
    await broker.subscribe(topic, () => {});
    await client.subscribe(topic, e => {
      received.push(e);
    });
    return { broker, received };
  }

  it('preserves Date instances across the wire', async () => {
    const { broker, received } = await setupPair('dates');
    const now = new Date('2026-06-11T10:00:00Z');

    await broker.publish('dates', makeEvent({ timestamp: now }));

    await waitFor(() => expect(received).toHaveLength(1));
    const evt = received[0]!;
    expect(evt.data.timestamp).toBeInstanceOf(Date);
    expect((evt.data.timestamp as Date).getTime()).toBe(now.getTime());
    // Event's own `createdAt` field — set by the publisher — should also be a Date.
    expect(evt.createdAt).toBeInstanceOf(Date);
  });

  it('preserves Error instances with name, message, stack, and cause', async () => {
    const { broker, received } = await setupPair('errors');

    class CustomError extends Error {
      constructor(
        message: string,
        public readonly code: string,
      ) {
        super(message);
        this.name = 'CustomError';
      }
    }
    const inner = new Error('inner failure');
    const outer = new CustomError('outer wrap', 'E_OUTER');
    (outer as any).cause = inner;

    await broker.publish('errors', makeEvent({ error: outer }));

    await waitFor(() => expect(received).toHaveLength(1));
    const decoded = received[0]!.data.error as Error;
    expect(decoded).toBeInstanceOf(Error);
    expect(decoded.message).toBe('outer wrap');
    expect(decoded.name).toBe('CustomError');
    expect(typeof decoded.stack).toBe('string');
    expect((decoded as any).code).toBe('E_OUTER');
    expect((decoded as any).cause).toBeInstanceOf(Error);
    expect(((decoded as any).cause as Error).message).toBe('inner failure');
  });

  it('preserves Map and Set instances', async () => {
    const { broker, received } = await setupPair('collections');

    const map = new Map<string, number>([
      ['a', 1],
      ['b', 2],
    ]);
    const set = new Set([10, 20, 30]);

    await broker.publish('collections', makeEvent({ map, set }));

    await waitFor(() => expect(received).toHaveLength(1));
    const decoded = received[0]!.data;
    expect(decoded.map).toBeInstanceOf(Map);
    expect(Array.from(decoded.map.entries())).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
    expect(decoded.set).toBeInstanceOf(Set);
    expect(Array.from(decoded.set.values())).toEqual([10, 20, 30]);
  });

  it('preserves explicit undefined properties', async () => {
    const { broker, received } = await setupPair('undef');

    await broker.publish('undef', makeEvent({ value: undefined, other: 'kept' }));

    await waitFor(() => expect(received).toHaveLength(1));
    const decoded = received[0]!.data;
    expect('value' in decoded).toBe(true);
    expect(decoded.value).toBeUndefined();
    expect(decoded.other).toBe('kept');
  });

  it('preserves DefaultGeneratedFile class instances via the class registry', async () => {
    const { broker, received } = await setupPair('files');

    const original = new DefaultGeneratedFile({
      data: new Uint8Array([1, 2, 3, 4]),
      mediaType: 'application/octet-stream',
    });

    await broker.publish('files', makeEvent({ file: original }));

    await waitFor(() => expect(received).toHaveLength(1));
    const decoded = received[0]!.data.file;
    expect(decoded).toBeInstanceOf(DefaultGeneratedFile);
    expect(decoded.mediaType).toBe('application/octet-stream');
    // Round-tripped binary content matches the original.
    expect(Array.from(decoded.uint8Array)).toEqual([1, 2, 3, 4]);
  });

  it('preserves a nested mixed payload shaped like a workflow.step.end event', async () => {
    const { broker, received } = await setupPair('workflows');

    const startedAt = new Date('2026-06-11T09:59:00Z');
    const endedAt = new Date('2026-06-11T10:00:00Z');
    const failure = new Error('tool failed');

    const stepResult = {
      status: 'failed' as const,
      startedAt: startedAt.getTime(),
      endedAt: endedAt.getTime(),
      error: failure,
      metadata: new Map<string, unknown>([['retries', 3]]),
      tags: new Set(['llm', 'tool']),
      suspendedAt: undefined,
    };

    await broker.publish(
      'workflows',
      makeEvent(
        {
          workflowId: 'wf-1',
          runId: 'run-1',
          prevResult: stepResult,
          timestamp: startedAt,
        },
        'workflow.step.end',
      ),
    );

    await waitFor(() => expect(received).toHaveLength(1));
    const data = received[0]!.data;
    expect(data.timestamp).toBeInstanceOf(Date);
    expect((data.timestamp as Date).getTime()).toBe(startedAt.getTime());

    const decoded = data.prevResult;
    expect(decoded.status).toBe('failed');
    expect(decoded.error).toBeInstanceOf(Error);
    expect((decoded.error as Error).message).toBe('tool failed');
    expect(decoded.metadata).toBeInstanceOf(Map);
    expect((decoded.metadata as Map<string, unknown>).get('retries')).toBe(3);
    expect(decoded.tags).toBeInstanceOf(Set);
    expect(Array.from(decoded.tags as Set<string>)).toEqual(['llm', 'tool']);
    expect('suspendedAt' in decoded).toBe(true);
    expect(decoded.suspendedAt).toBeUndefined();
  });
});
