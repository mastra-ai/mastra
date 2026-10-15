/**
 * Port of durability harness case T57 (wf-parallel-suspend).
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

const Input = z.object({ seed: z.number() });
const Branch = z.object({ branch: z.string(), value: z.number() });
const Output = z.object({ left: Branch, right: Branch });

type Engine = 'default' | 'evented';

function build(engine: Engine, executed: string[]) {
  const branch = (id: string) =>
    createStep({
      id,
      inputSchema: Input,
      outputSchema: Branch,
      resumeSchema: z.number(),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (resumeData === undefined) return suspend({ branch: id, seed: inputData.seed });
        executed.push(id);
        return { branch: id, value: inputData.seed + resumeData };
      },
    });
  const factory = engine === 'evented' ? createEventedWorkflow : createWorkflow;
  const workflow = factory({ id: `t57-parallel-${engine}`, inputSchema: Input, outputSchema: Output })
    .parallel([branch('left'), branch('right')])
    .commit();
  return workflow;
}

async function runCell(engine: Engine) {
  const executed: string[] = [];
  const workflow = build(engine, executed);
  const mastra = new Mastra({ logger: false, storage: new MockStore(), workflows: { [workflow.id]: workflow } });
  if (engine === 'evented') await mastra.startWorkers();
  try {
    const run = await workflow.createRun({ runId: `t57-${engine}-run` });
    expect((await run.start({ inputData: { seed: 10 } })).status).toBe('suspended');
    expect(executed).toEqual([]);
    expect((await run.resume({ step: 'left', resumeData: 1 })).status).toBe('suspended');
    expect(executed).toEqual(['left']);
    const result = await run.resume({ step: 'right', resumeData: 2 });
    expect(result.status).toBe('success');
    expect(result.result).toEqual({
      left: { branch: 'left', value: 11 },
      right: { branch: 'right', value: 12 },
    });
    expect(executed.sort()).toEqual(['left', 'right']);
  } finally {
    if (engine === 'evented') await mastra.stopWorkers();
  }
}

describe('T57 wf-parallel-suspend', () => {
  it.each(['default', 'evented'] as const)('%s: resumes both parallel branches', runCell);

  it.each(REDELIVERY_MODES)('wf-evented-redeliver / %s: executes each completed branch once', async mode => {
    const driver = new RedeliveryDriver();
    const executed: string[] = [];
    const workflow = build('evented', executed);
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      pubsub: driver.pubsub,
      workflows: { [workflow.id]: workflow },
    });
    try {
      await mastra.startWorkers();
      driver.assertEvented(workflow);
      const runId = 't57-redeliver-run';
      const run = await workflow.createRun({ runId });
      expect((await run.start({ inputData: { seed: 10 } })).status).toBe('suspended');
      expect(executed).toEqual([]);
      expect((await run.resume({ step: 'left', resumeData: 1 })).status).toBe('suspended');
      expect(executed).toEqual(['left']);
      const result = await run.resume({ step: 'right', resumeData: 2 });
      expect(result.status).toBe('success');
      expect(result.result).toEqual({
        left: { branch: 'left', value: 11 },
        right: { branch: 'right', value: 12 },
      });
      expect(executed.sort()).toEqual(['left', 'right']);

      const rightRun = driver.stepRuns({ spec: `${workflow.id}@0,1`, runId }).at(-1);
      const path = rightRun?.data?.executionPath as number[] | undefined;
      expect(path).toEqual([0, 1]);
      const match = { spec: `${workflow.id}@${path!.join(',')}`, runId } as const;
      const outcome = await redeliverAndDrain(driver, match, mode);
      expect(outcome.event.data).toEqual(rightRun!.data);
      expect(outcome.event.data).toMatchObject({ workflowId: workflow.id, runId, executionPath: path });
      expectRedeliveryParity(
        { executed: executed.sort() },
        { executed: ['left', 'right'] },
        mode === 'same-id'
          ? undefined
          : {
              reason: 'COR-1307 / COR-1394: a completed parallel branch executes again on fresh-ID or expired replay.',
              expect: correct => ({ ...correct, executed: [...correct.executed, 'right'] }),
            },
      );
    } finally {
      await mastra.stopWorkers();
      driver.dispose();
      vi.useRealTimers();
    }
  });
});
