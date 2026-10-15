/** Port of durability harness T57: parallel suspended branches → join. */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createEventedWorkflow, createWorkflow } from '../create';
import { createStep } from '../workflow';
import { REDELIVERY_MODES, expectRedeliveryParity, redeliverAndDrain } from './test-utils/redelivery-contract';
import { RedeliveryDriver } from './test-utils/redelivery-driver';

const Value = z.object({ n: z.number() });
const Joined = z.object({ left: Value, right: Value });
type Engine = 'default' | 'evented';

async function runCell(engine: Engine, mode?: (typeof REDELIVERY_MODES)[number]) {
  const driver = mode ? new RedeliveryDriver() : undefined;
  const executed: string[] = [];
  const joinInputs: z.infer<typeof Joined>[] = [];
  const branch = (id: string) =>
    createStep({
      id,
      inputSchema: Value,
      outputSchema: Value,
      resumeSchema: z.object({ ok: z.literal(true) }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (!resumeData) return suspend({ branch: id });
        executed.push(id);
        return { n: inputData.n + 1 };
      },
    });
  const join = createStep({
    id: 'join',
    inputSchema: Joined,
    outputSchema: Value,
    execute: async ({ inputData }) => {
      joinInputs.push(structuredClone(inputData));
      return { n: inputData.left.n + inputData.right.n };
    },
  });
  const factory = engine === 'evented' ? createEventedWorkflow : createWorkflow;
  const workflow = factory({ id: 't57-wf', inputSchema: Value, outputSchema: Value })
    .parallel([branch('left'), branch('right')])
    .then(join)
    .commit();
  const mastra = new Mastra({
    logger: false,
    storage: new MockStore(),
    ...(driver ? { pubsub: driver.pubsub } : {}),
    workflows: { [workflow.id]: workflow },
  });
  try {
    if (engine === 'evented') await mastra.startWorkers();
    driver?.assertEvented(workflow);
    const runId = `t57-${engine}-${mode ?? 'fault-free'}`;
    const run = await workflow.createRun({ runId });
    const started = await run.start({ inputData: { n: 1 } });
    expect(started.status).toBe('suspended');
    expect(started.steps.left?.status).toBe('suspended');
    expect(started.steps.right?.status).toBe('suspended');
    expect(executed).toEqual([]);
    expect(joinInputs).toEqual([]);
    const leftResume = await run.resume({ step: 'left', resumeData: { ok: true } });
    expect(leftResume.status).toBe('suspended');
    expect(executed).toEqual(['left']);
    expect(joinInputs).toEqual([]);
    const result = await run.resume({ step: 'right', resumeData: { ok: true } });
    expect(result.status).toBe('success');
    expect(result.result).toEqual({ n: 4 });
    expect(executed).toEqual(['left', 'right']);
    const joined = { left: { n: 2 }, right: { n: 2 } };
    expect(joinInputs).toEqual([joined]);
    if (driver && mode) {
      const match = { spec: 't57-wf@1', runId } as const;
      expect(driver.stepRuns(match).at(-1)?.data).toMatchObject({ workflowId: 't57-wf', runId, executionPath: [1] });
      await redeliverAndDrain(driver, match, mode);
      expectRedeliveryParity(
        { executed, joinInputs },
        { executed: ['left', 'right'], joinInputs: [joined] },
        mode === 'same-id'
          ? undefined
          : {
              reason: 'COR-1307 / COR-1394: completed join executes again on fresh-ID or expired replay.',
              expect: correct => ({ ...correct, joinInputs: [...correct.joinInputs, joined] }),
            },
      );
    }
  } finally {
    if (engine === 'evented') await mastra.stopWorkers();
    driver?.dispose();
    vi.useRealTimers();
  }
}

describe('T57 wf-parallel-suspend', () => {
  it.each(['default', 'evented'] as const)('%s: joins both resumed branches', engine => runCell(engine));
  it.each(REDELIVERY_MODES)('wf-evented-redeliver / %s: executes join once', mode => runCell('evented', mode));
});
