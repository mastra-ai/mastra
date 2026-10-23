import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { UnixSocketPubSub } from '../../../events/unix-socket-pubsub';
import { runLoopScenario, useLoopScenarioAimock } from '../../../loop/test-utils/aimock/aimock-scenario';
import { createTool } from '../../../tools';

/**
 * A throwing `stopWhen` on an evented agent must be called once when the host
 * bus is `UnixSocketPubSub`. Unlike `EventEmitterPubSub`, this transport
 * redelivers nacked events over the socket, so the continuation event used to
 * be redelivered until its delivery-attempt limit and the predicate ran three
 * times.
 *
 * The agent's bus is a socket client of a separate broker instance, so every
 * publish, ack and nack crosses the socket.
 */
describe('evented agent: throwing stopWhen over UnixSocketPubSub', () => {
  const getMock = useLoopScenarioAimock();
  let tempDir: string;
  const pubsubs: UnixSocketPubSub[] = [];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mastra-evented-stopwhen-'));
  });

  afterEach(async () => {
    for (const pubsub of pubsubs.splice(0).reverse()) await pubsub.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('calls a throwing stopWhen once and rejects the stream with its error', async () => {
    const socketPath = join(tempDir, 'events.sock');
    const broker = new UnixSocketPubSub(socketPath);
    pubsubs.push(broker);
    await broker.subscribe('__boot__', () => {});
    const client = new UnixSocketPubSub(socketPath);
    pubsubs.push(client);
    await client.subscribe('__boot__', () => {});
    expect(broker.isBroker).toBe(true);
    expect(client.isBroker).toBe(false);

    let stopWhenCalls = 0;
    let toolCalls = 0;
    const step = createTool({
      id: 'step',
      description: 'Advance one step.',
      inputSchema: z.object({ n: z.number() }),
      execute: async ({ n }) => {
        toolCalls++;
        return { done: n };
      },
    });

    const { streamError, requests, chunks } = await runLoopScenario({
      engine: 'evented',
      pubsub: client,
      llm: getMock(),
      prompt: 'Go.',
      tools: { step },
      collectChunks: true,
      expectStreamError: true,
      maxSteps: 10,
      stopWhen: (() => {
        stopWhenCalls++;
        throw new Error('stopWhen exploded');
      }) as any,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call-1', name: 'step', arguments: { n: 1 } }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'done' });
      },
    });

    // Let any redelivery the transport schedules land before counting.
    await new Promise(resolve => setTimeout(resolve, 1000));

    expect(stopWhenCalls).toBe(1);
    expect(streamError).toMatchObject({ message: 'stopWhen exploded' });
    expect(toolCalls).toBe(1);
    expect(requests).toHaveLength(1);
    expect(chunks!.some(chunk => chunk.type === 'finish')).toBe(false);
  });
});
