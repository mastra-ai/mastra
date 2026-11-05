/** Port of durability harness T56: before → nested suspend/inc loop → after. */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createEventedWorkflow, createWorkflow } from '../create';
import { createStep } from '../workflow';
import { REDELIVERY_MODES, expectRedeliveryParity, redeliverAndDrain } from './test-utils/redelivery-contract';
import { RedeliveryDriver } from './test-utils/redelivery-driver';

const Value = z.object({ n: z.number() });
type Engine = 'default' | 'evented';

async function runCell(engine: Engine, mode?: (typeof REDELIVERY_MODES)[number]) {
  const driver = mode ? new RedeliveryDriver() : undefined;
  const increments: number[] = [];
  const afterInputs: number[] = [];
  const before = createStep({
    id: 'before',
    inputSchema: Value,
    outputSchema: Value,
    execute: async ({ inputData }) => ({ n: inputData.n + 1 }),
  });
  const gate = createStep({
    id: 'gate',
    inputSchema: Value,
    outputSchema: Value,
    resumeSchema: z.object({ ok: z.literal(true) }),
    execute: async ({ inputData, resumeData, suspend }) => {
      if (!resumeData) return suspend({ n: inputData.n });
      return inputData;
    },
  });
  const inc = createStep({
    id: 'inc',
    inputSchema: Value,
    outputSchema: Value,
    execute: async ({ inputData }) => {
      const n = inputData.n + 1;
      increments.push(n);
      return { n };
    },
  });
  const after = createStep({
    id: 'after',
    inputSchema: Value,
    outputSchema: Value,
    execute: async ({ inputData }) => {
      afterInputs.push(inputData.n);
      return { n: inputData.n + 1 };
    },
  });
  const factory = engine === 'evented' ? createEventedWorkflow : createWorkflow;
  const nested = factory({ id: 't56-nested', inputSchema: Value, outputSchema: Value }).then(gate).then(inc).commit();
  const workflow = factory({ id: 't56-wf', inputSchema: Value, outputSchema: Value })
    .then(before)
    .dountil(nested, { predicate: { op: 'gte', left: { path: 'inputData.n' }, right: { literal: 3 } } })
    .then(after)
    .commit();
  const mastra = new Mastra({
    logger: false,
    storage: new MockStore(),
    ...(driver ? { pubsub: driver.pubsub } : {}),
    workflows: { [nested.id]: nested, [workflow.id]: workflow },
  });
  try {
    if (engine === 'evented') await mastra.startWorkers();
    driver?.assertEvented(workflow);
    const runId = `t56-${engine}-${mode ?? 'fault-free'}`;
    const run = await workflow.createRun({ runId });
    const started = await run.start({ inputData: { n: 0 } });
    expect(started.status).toBe('suspended');
    expect(increments).toEqual([]);
    expect(afterInputs).toEqual([]);
    const firstResume = await run.resume({ step: [nested.id, 'gate'], resumeData: { ok: true } });
    expect(firstResume.status).toBe('suspended');
    expect(increments).toEqual([2]);
    expect(afterInputs).toEqual([]);
    const result = await run.resume({ step: [nested.id, 'gate'], resumeData: { ok: true } });
    expect([started.status, firstResume.status, result.status]).toEqual(['suspended', 'suspended', 'success']);
    expect(result.result).toEqual({ n: 4 });
    expect(increments).toEqual([2, 3]);
    expect(afterInputs).toEqual([3]);
    if (driver && mode) {
      const match = { spec: 't56-wf@2', runId } as const;
      expect(driver.stepRuns(match).at(-1)?.data).toMatchObject({ workflowId: 't56-wf', runId, executionPath: [2] });
      await redeliverAndDrain(driver, match, mode);
      expectRedeliveryParity(
        { increments, afterInputs },
        { increments: [2, 3], afterInputs: [3] },
        mode === 'same-id'
          ? undefined
          : {
              reason: 'COR-1307 / COR-1394: completed after executes again on fresh-ID or expired replay.',
              expect: correct => ({ ...correct, afterInputs: [...correct.afterInputs, 3] }),
            },
      );
    }
  } finally {
    if (engine === 'evented') await mastra.stopWorkers();
    driver?.dispose();
    vi.useRealTimers();
  }
}

describe('T56 wf-nested-suspend-loop', () => {
  it.each(['default', 'evented'] as const)('%s: resumes the nested suspend/inc loop', engine => runCell(engine));
  it.each(REDELIVERY_MODES)('wf-evented-redeliver / %s: executes after once', mode => runCell('evented', mode));
});
