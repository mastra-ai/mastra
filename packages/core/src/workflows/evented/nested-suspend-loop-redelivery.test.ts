/**
 * Port of durability harness case T56 (wf-nested-suspend-loop).
 *
 * This file intentionally includes the default-engine parity leg. COR-1307
 * owns the fresh-id completed-transition replay pinned by the redelivery cell.
 */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createEventedWorkflow, createWorkflow } from '../create';
import { createStep } from '../workflow';
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
    expect((await run.start({ inputData: { value: 0 } })).status).toBe('suspended');
    expect((await run.resume({ step: [nested.id, 'gate'], resumeData: { add: 1 } })).status).toBe('suspended');
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

  it('wf-evented-redeliver: pins the harness fresh-id replay', async () => {
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
      expect((await run.start({ inputData: { value: 0 } })).status).toBe('suspended');
      expect((await run.resume({ step: [nested.id, 'gate'], resumeData: { add: 1 } })).status).toBe('suspended');
      const result = await run.resume({ step: [nested.id, 'gate'], resumeData: { add: 1 } });
      expect(result.status).toBe('success');
      expect(result.result).toEqual({ value: 2 });
      expect(executed).toEqual([0, 1]);

      const match = { spec: `${parent.id}@0`, runId } as const;
      const original = driver.stepRuns(match).at(-1)!;
      expect(original.data).toMatchObject({ workflowId: parent.id, runId, executionPath: [0] });
      const before = driver.deliveryCount(match);
      const outcome = await driver.redeliver(match, { viaPublish: true });
      expect(outcome.event.id).not.toBe(original.id);
      expect(outcome.event.deliveryAttempt).toBe(1);
      expect(outcome.handled).toHaveLength(1);
      expect(outcome.handled[0]!.result.ok).toBe(true);
      expect(driver.deliveryCount(match)).toBe(before + 1);
      await vi.waitFor(() => expect(executed).toEqual([0, 1, 1]));
    } finally {
      await mastra.stopWorkers();
      driver.dispose();
    }
  });
});
