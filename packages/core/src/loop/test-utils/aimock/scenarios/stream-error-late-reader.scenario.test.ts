/**
 * AIMock Scenario: a run that fails still delivers every chunk it produced before the failure
 *
 * Erroring a ReadableStream discards the chunks still queued for its reader.
 * Each stream layer between the loop and the caller (the loop stream, the
 * durable pubsub adapter, the output's subscriber stream) used to error as soon
 * as the failure arrived, so a reader that was behind lost the tail of the run:
 * a caller that starts reading late, or a thread run whose pubsub has real
 * delivery latency. The failure must reach the reader after the chunks the run
 * emitted before it.
 */

import { expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../../events/event-emitter';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import { delay } from '../../../../utils';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/** A bus with delivery latency, like any pubsub backed by a socket or a broker. */
class SlowPubSub extends EventEmitterPubSub {
  override async publish(...args: Parameters<EventEmitterPubSub['publish']>) {
    await delay(20);
    return super.publish(...args);
  }
}

const LIFECYCLE = ['start', 'step-start', 'tool-call', 'tool-result', 'finish'];

describeForAllEngines('AIMock loop scenario: a failed run delivers its chunks before the error', engine => {
  const getMock = useLoopScenarioAimock();

  async function runThrowingStopWhen(opts: { readDelayMs?: number; slowBus?: boolean }) {
    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Take a step',
      tools: {
        step: createTool({
          id: 'step',
          description: 'Take a step',
          inputSchema: z.object({ n: z.number() }),
          execute: async ({ n }) => ({ done: n }),
        }),
      },
      maxSteps: 10,
      stopWhen: (() => {
        throw new Error('stopWhen failure');
      }) as any,
      ...(opts.slowBus
        ? { pubsub: new SlowPubSub(), memory: new MockMemory(), threadId: 'late-thread', resourceId: 'late-user' }
        : {}),
      manualStreamConsumption: true,
      fixtures: mock => {
        mock.on(
          { endpoint: 'chat', sequenceIndex: 0 },
          { toolCalls: [{ id: 'call-1', name: 'step', arguments: { n: 1 } }] },
        );
      },
    });

    if (opts.readDelayMs) await delay(opts.readDelayMs);

    const types: string[] = [];
    let error: unknown;
    try {
      for await (const chunk of output.fullStream as AsyncIterable<{ type: string }>) types.push(chunk.type);
    } catch (e) {
      error = e;
    }
    return { types: types.filter(t => LIFECYCLE.includes(t)), error: error as Error | undefined };
  }

  it('a caller that starts reading 200ms late still gets the tool step before the rejection', async () => {
    const { types, error } = await runThrowingStopWhen({ readDelayMs: 200 });
    expect(error?.message).toBe('stopWhen failure');
    expect(types).toEqual(['start', 'step-start', 'tool-call', 'tool-result']);
  });

  it('a thread run on a bus with delivery latency still gets the tool step before the rejection', async () => {
    const { types, error } = await runThrowingStopWhen({ slowBus: true });
    expect(error?.message).toBe('stopWhen failure');
    expect(types).toEqual(['start', 'step-start', 'tool-call', 'tool-result']);
  });
});
