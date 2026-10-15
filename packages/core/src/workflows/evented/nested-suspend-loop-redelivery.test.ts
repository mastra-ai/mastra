/**
 * Port of durability harness case T56 (wf-nested-suspend-loop).
 *
 * Includes the default-engine parity leg and completed-transition redelivery
 * contracts, with stale-detecting known differences for COR-1307/COR-1394.
 */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createEventedWorkflow, createWorkflow } from '../create';
import { createStep } from '../workflow';
import { REDELIVERY_MODES, expectRedeliveryParity, redeliverAndDrain } from './test-utils/redelivery-contract';
import { RedeliveryDriver } from './test-utils/redelivery-driver';

const Value = z.object({ value: z.number() });
const Resume = z.object({ add: z.number() });

type Engine = 'default' | 'evented';

function build(engine: Engine, executed: number[]) {
  const gate = createStep({
    id: 'gate',
    inputSchema: Value,
    outputSchema: Value,
    resumeSchema: Resume,
    execute: async ({ inputData, resumeData, suspend }) => {
      if (!resumeData) return suspend({ value: inputData.value });
      executed.push(inputData.value);
      return { value: inputData.value + resumeData.add };
    },
  });
  const nestedFactory = engine === 'evented' ? createEventedWorkflow : createWorkflow;
  const nested = nestedFactory({ id: `t56-nested-${engine}`, inputSchema: Value, outputSchema: Value })
    .then(gate)
    .commit();
  const parentFactory = engine === 'evented' ? createEventedWorkflow : createWorkflow;
  const parent = parentFactory({ id: `t56-parent-${engine}`, inputSchema: Value, outputSchema: Value })
    .dountil(nested, {
      predicate: { op: 'gte', left: { path: 'inputData.value' }, right: { literal: 2 } },
    })
    .commit();
  return { nested, parent };
}

async function runCell(engine: Engine) {
  const executed: number[] = [];
  const { nested, parent } = build(engine, executed);
  const mastra = new Mastra({
    logger: false,
    storage: new MockStore(),
    workflows: { [nested.id]: nested, [parent.id]: parent },
  });
  if (engine === 'evented') await mastra.startWorkers();
  try {
    const run = await parent.createRun({ runId: `t56-${engine}-run` });
    const started = await run.start({ inputData: { value: 0 } });
    expect(started.status).toBe('suspended');
    if (engine === 'default') expect(started.suspendPayload).toEqual({ [nested.id]: { value: 0 } });
    expect(executed).toEqual([]);
    const firstResume = await run.resume({ step: [nested.id, 'gate'], resumeData: { add: 1 } });
    expect(firstResume.status).toBe('suspended');
    if (engine === 'default') expect(firstResume.suspendPayload).toEqual({ [nested.id]: { value: 1 } });
    expect(executed).toEqual([0]);
    const result = await run.resume({ step: [nested.id, 'gate'], resumeData: { add: 1 } });
    expect(result.status).toBe('success');
    expect(result.result).toEqual({ value: 2 });
    expect(executed).toEqual([0, 1]);
  } finally {
    if (engine === 'evented') await mastra.stopWorkers();
  }
}

describe('T56 wf-nested-suspend-loop', () => {
  it.each(['default', 'evented'] as const)('%s: resumes every nested loop suspension', runCell);

  it.each(REDELIVERY_MODES)('wf-evented-redeliver / %s: executes each completed transition once', async mode => {
    const driver = new RedeliveryDriver();
    const executed: number[] = [];
    const { nested, parent } = build('evented', executed);
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      pubsub: driver.pubsub,
      workflows: { [nested.id]: nested, [parent.id]: parent },
    });
    try {
      await mastra.startWorkers();
      driver.assertEvented(parent);
      const runId = 't56-redeliver-run';
      const run = await parent.createRun({ runId });
      const started = await run.start({ inputData: { value: 0 } });
      expect(started.status).toBe('suspended');
      expect(executed).toEqual([]);
      const firstResume = await run.resume({ step: [nested.id, 'gate'], resumeData: { add: 1 } });
      expect(firstResume.status).toBe('suspended');
      expect(executed).toEqual([0]);
      const result = await run.resume({ step: [nested.id, 'gate'], resumeData: { add: 1 } });
      expect(result.status).toBe('success');
      expect(result.result).toEqual({ value: 2 });
      expect(executed).toEqual([0, 1]);

      const match = { spec: `${parent.id}@0`, runId } as const;
      const original = driver.stepRuns(match).at(-1)!;
      expect(original.data).toMatchObject({ workflowId: parent.id, runId, executionPath: [0] });
      const outcome = await redeliverAndDrain(driver, match, mode);
      expect(outcome.event.data).toEqual(original.data);
      expectRedeliveryParity(
        { executed },
        { executed: [0, 1] },
        mode === 'same-id'
          ? undefined
          : {
              reason:
                'COR-1307 / COR-1394: a completed nested transition executes again on fresh-ID or expired replay.',
              expect: correct => ({ ...correct, executed: [...correct.executed, 1] }),
            },
      );
    } finally {
      await mastra.stopWorkers();
      driver.dispose();
      vi.useRealTimers();
    }
  });
});
