/**
 * A loop whose body is a nested workflow that suspends must count its own
 * iterations across resumes on both engines (#29727, #29762).
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createEventedWorkflow, createWorkflow } from '../create';
import { createStep } from '../workflow';

const Value = z.object({ x: z.number() }).passthrough();
type Engine = 'default' | 'evented';

async function runCell(
  engine: Engine,
  {
    innerLoop,
    outerCount,
    loopType,
  }: { innerLoop: number | null; outerCount: number; loopType: 'dountil' | 'dowhile' },
) {
  const factory = engine === 'evented' ? createEventedWorkflow : createWorkflow;
  const outerCounts: number[] = [];
  const id = `${engine}-${innerLoop ?? 'none'}-${outerCount}-${loopType}`;

  const ask = createStep({
    id: 'ask',
    inputSchema: Value,
    outputSchema: Value,
    resumeSchema: z.object({ value: z.number() }),
    execute: async ({ inputData, resumeData, suspend }) =>
      resumeData === undefined ? await suspend({}) : { ...inputData, y: resumeData.value },
  });
  const add = createStep({
    id: 'add',
    inputSchema: Value,
    outputSchema: Value,
    execute: async ({ inputData }) => ({ ...inputData, x: inputData.x + 1 }),
  });

  const workflows: Record<string, any> = {};
  let body;
  if (innerLoop === null) {
    body = factory({ id: `body-${id}`, inputSchema: Value, outputSchema: Value })
      .then(ask)
      .then(add)
      .commit();
  } else {
    const inner = factory({ id: `inner-${id}`, inputSchema: Value, outputSchema: Value })
      .then(ask)
      .then(add)
      .commit();
    workflows[inner.id] = inner;
    body = factory({ id: `body-${id}`, inputSchema: Value, outputSchema: Value })
      .dountil(inner, async ({ iterationCount }) => iterationCount >= innerLoop)
      .commit();
  }
  workflows[body.id] = body;

  const condition = async ({ iterationCount }: { iterationCount: number }) => {
    outerCounts.push(iterationCount);
    return loopType === 'dountil' ? iterationCount >= outerCount : iterationCount < outerCount;
  };
  const builder = factory({ id: `loop-${id}`, inputSchema: Value, outputSchema: Value });
  const loop = (loopType === 'dountil' ? builder.dountil(body, condition) : builder.dowhile(body, condition)).commit();
  workflows[loop.id] = loop;

  const mastra = new Mastra({ logger: false, storage: new MockStore(), workflows });
  try {
    if (engine === 'evented') await mastra.startWorkers();
    const run = await loop.createRun();
    let result: any = await run.start({ inputData: { x: 0 } });
    let resumes = 0;
    while (result.status === 'suspended' && resumes < 12) {
      result = await run.resume({ step: result.suspended[0], resumeData: { value: resumes++ } });
    }
    const expected = outerCount * (innerLoop ?? 1);
    expect(result.status).toBe('success');
    expect(outerCounts).toEqual(Array.from({ length: outerCount }, (_, i) => i + 1));
    expect(resumes).toBe(expected);
    expect(result.result.x).toBe(expected);
  } finally {
    if (engine === 'evented') await mastra.stopWorkers();
  }
}

describe('loop over a suspending nested workflow keeps its own iterationCount', () => {
  describe.each(['default', 'evented'] as const)('%s engine', engine => {
    it.each(['dountil', 'dowhile'] as const)('%s over a nested workflow without its own loop (#29727)', loopType =>
      runCell(engine, { innerLoop: null, outerCount: 2, loopType }),
    );

    it.each([
      { outerCount: 2, loopType: 'dountil' as const },
      { outerCount: 3, loopType: 'dountil' as const },
      { outerCount: 2, loopType: 'dowhile' as const },
    ])('$loopType $outerCount over a nested counted loop of 2 (#29762)', ({ outerCount, loopType }) =>
      runCell(engine, { innerLoop: 2, outerCount, loopType }),
    );
  });
});
