import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: a `stopWhen` predicate that throws is a deterministic user
 * failure. It must be called exactly once and reject the stream with its own
 * error on every engine. The evented engine used to treat the throw as a
 * transport failure and redeliver the loop's continuation event until its
 * delivery-attempt limit, calling the predicate three times.
 *
 * Script: the model calls `step` once; the predicate throws on the first
 * continuation decision, so the second model turn is never reached.
 */
describeForAllEngines('AIMock loop scenario: throwing stopWhen', engine => {
  const getMock = useLoopScenarioAimock();

  it('calls a throwing stopWhen once and rejects the stream with its error', async () => {
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
      engine,
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

    expect(stopWhenCalls).toBe(1);
    expect(streamError).toMatchObject({ message: 'stopWhen exploded' });
    expect(toolCalls).toBe(1);
    expect(requests).toHaveLength(1);
    expect(chunks!.some(chunk => chunk.type === 'finish')).toBe(false);
  });
});
