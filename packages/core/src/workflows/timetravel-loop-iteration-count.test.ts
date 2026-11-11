import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';

// #29734 follow-up: only the time-travel target's own loop continues its recorded iteration count,
// and a caller-supplied count must be a positive integer.
function setup() {
  const inputs: number[] = [];
  const counts: number[] = [];
  const call = createStep({
    id: 'call',
    inputSchema: z.object({ n: z.number() }),
    outputSchema: z.object({ n: z.number() }),
    resumeSchema: z.object({ approved: z.boolean() }),
    execute: async ({ inputData, resumeData, suspend }) => {
      inputs.push(inputData.n);
      if (inputData.n === 1 && !resumeData) return suspend({});
      return { n: inputData.n + 1 };
    },
  });
  const prep = createStep({
    id: 'prep',
    inputSchema: z.object({ n: z.number() }),
    outputSchema: z.object({ n: z.number() }),
    execute: async ({ inputData }) => inputData,
  });
  const workflow = createWorkflow({
    id: 'timetravel-loop-before-target',
    inputSchema: z.object({ n: z.number() }),
    outputSchema: z.object({ n: z.number() }),
  })
    .then(prep)
    .dountil(call, async ({ iterationCount }) => {
      counts.push(iterationCount);
      return iterationCount >= 3;
    })
    .commit();
  new Mastra({ workflows: { workflow }, storage: new MockStore(), logger: false });
  const reset = () => {
    inputs.length = 0;
    counts.length = 0;
  };
  return { workflow, inputs, counts, reset };
}

describe('time travel and loop iterationCount (default engine)', () => {
  it('restarts a suspended loop from its first iteration when the target is a step before it', async () => {
    const { workflow, inputs, counts, reset } = setup();
    const runId = randomUUID();
    const suspended = await (await workflow.createRun({ runId })).start({ inputData: { n: 0 } });
    expect(suspended.status).toBe('suspended');
    expect(counts).toEqual([1]);

    reset();
    const replayed = await (
      await workflow.createRun({ runId })
    ).timeTravel({ step: 'prep', resumeData: { approved: true } });

    expect(replayed.status).toBe('suspended');
    expect(inputs).toEqual([0, 1]);
    expect(counts).toEqual([1]);
  });

  it.each([0, -20, 1.5])('rejects a caller-supplied iterationCount of %s', async iterationCount => {
    const { workflow } = setup();
    const runId = randomUUID();
    await (await workflow.createRun({ runId })).start({ inputData: { n: 0 } });

    await expect(
      (await workflow.createRun({ runId })).timeTravel({
        step: 'call',
        context: {
          call: {
            payload: { n: 1 },
            startedAt: Date.now(),
            status: 'suspended',
            metadata: { iterationCount },
          } as any,
        },
      }),
    ).rejects.toThrow(/iterationCount/);
  });
});
