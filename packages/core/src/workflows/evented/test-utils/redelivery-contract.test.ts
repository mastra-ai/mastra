import { setImmediate as yieldToLoop } from 'node:timers/promises';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';
import { createEventedWorkflow } from '../../create';
import { createStep } from '../../workflow';
import { expectRedeliveryParity, redeliverAndDrain } from './redelivery-contract';
import { RedeliveryDriver } from './redelivery-driver';

const correct = { executions: 1, approvals: 1 };
const duplicate = {
  reason: 'COR-1307: a completed step executes again.',
  expect: (value: typeof correct) => ({ ...value, executions: value.executions + 1 }),
};

describe('redelivery known-difference contracts', () => {
  it('requires the correct outcome without a declaration', () => {
    expectRedeliveryParity(correct, correct);
    expect(() => expectRedeliveryParity({ ...correct, executions: 2 }, correct)).toThrow();
  });

  it('accepts only the exact declared divergence', () => {
    expectRedeliveryParity({ ...correct, executions: 2 }, correct, duplicate);
    expect(() => expectRedeliveryParity({ ...correct, executions: 3 }, correct, duplicate)).toThrow();
  });

  it('rejects changes outside the declaration', () => {
    expect(() => expectRedeliveryParity({ executions: 2, approvals: 2 }, correct, duplicate)).toThrow();
  });

  it('requires removal when the runtime converges', () => {
    expect(() => expectRedeliveryParity(correct, correct, duplicate)).toThrow('no longer differs');
  });

  it('detects partial convergence independently for each declared field', () => {
    expect(() =>
      expectRedeliveryParity({ executions: 2, approvals: 1 }, correct, {
        reason: 'COR-1307: duplicate execution and approval.',
        expect: value => ({ executions: value.executions + 1, approvals: value.approvals + 1 }),
      }),
    ).toThrow("'approvals' no longer differs");
  });

  it('rejects empty declarations', () => {
    expect(() => expectRedeliveryParity(correct, correct, { ...duplicate, expect: value => value })).toThrow(
      'empty difference',
    );
  });

  it('requires a nonblank reason', () => {
    expect(() => expectRedeliveryParity({ ...correct, executions: 2 }, correct, { ...duplicate, reason: ' ' })).toThrow(
      'must cite its cause',
    );
  });

  it('tracks a declared property removal', () => {
    const baseline: { executions: number; approval?: number } = { executions: 1, approval: 1 };
    const difference = {
      reason: 'COR-1307: replay drops the approval field.',
      expect: (value: typeof baseline) => {
        delete value.approval;
        return value;
      },
    };
    expectRedeliveryParity({ executions: 1 }, baseline, difference);
    expect(() => expectRedeliveryParity(baseline, baseline, difference)).toThrow("'approval' no longer differs");
  });

  it('detects convergence of a removed property alongside another changed field', () => {
    const baseline: { executions: number; approval?: number } = { executions: 1, approval: 1 };
    expect(() =>
      expectRedeliveryParity({ executions: 2, approval: 1 }, baseline, {
        reason: 'COR-1307: replay repeats execution and drops approval.',
        expect: value => {
          value.executions++;
          delete value.approval;
          return value;
        },
      }),
    ).toThrow("'approval' no longer differs");
  });

  it('distinguishes missing properties from explicit undefined', () => {
    const baseline: { executions: number; approval?: number } = { executions: 1, approval: undefined };
    expectRedeliveryParity({ executions: 1 }, baseline, {
      reason: 'COR-1307: replay drops the approval field.',
      expect: value => {
        delete value.approval;
        return value;
      },
    });
    expect(() => expectRedeliveryParity({ executions: 1 }, baseline)).toThrow();
  });

  it('does not let a difference transform mutate the correct outcome', () => {
    const baseline = { executed: ['before', 'after'] };
    expectRedeliveryParity({ executed: ['before', 'after', 'after'] }, baseline, {
      reason: 'COR-1307: the completed step executes again.',
      expect: value => {
        value.executed.push('after');
        return value;
      },
    });
    expect(baseline).toEqual({ executed: ['before', 'after'] });
  });
});

describe('redelivery processor draining', () => {
  it('drains timers scheduled after asynchronous work in the replay and its descendants', async () => {
    const executed: string[] = [];
    const step = (id: string) =>
      createStep({
        id,
        inputSchema: z.number(),
        outputSchema: z.number(),
        execute: async ({ inputData }) => {
          await yieldToLoop();
          await new Promise<void>(resolve => setTimeout(resolve, 5));
          executed.push(id);
          return inputData + 1;
        },
      });
    const workflow = createEventedWorkflow({ id: 'drain-contract', inputSchema: z.number(), outputSchema: z.number() })
      .then(step('before'))
      .then(step('after'))
      .commit();
    const driver = new RedeliveryDriver();
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      pubsub: driver.pubsub,
      workflows: { [workflow.id]: workflow },
    });
    try {
      await mastra.startWorkers();
      const run = await workflow.createRun({ runId: 'drain-contract-run' });
      expect((await run.start({ inputData: 0 })).status).toBe('success');
      await redeliverAndDrain(driver, { spec: `${workflow.id}@0`, runId: run.runId }, 'publish');
      expectRedeliveryParity(
        { executed },
        { executed: ['before', 'after'] },
        {
          reason: 'COR-1307: completed transitions execute again.',
          expect: correct => ({ executed: [...correct.executed, ...correct.executed] }),
        },
      );
    } finally {
      await mastra.stopWorkers();
      driver.dispose();
      vi.useRealTimers();
    }
  });

  it('restores the clock and timers after an expired replay rejects', async () => {
    const driver = new RedeliveryDriver();
    const originalNow = Date.now;
    const runId = 'rejected-replay';
    try {
      await driver.pubsub.publish('workflows', {
        type: 'workflow.step.run',
        runId,
        data: { workflowId: 'rejected', runId, executionPath: [0] },
      });
      const original = driver.stepRuns({ spec: 'rejected@0', runId })[0]!;
      await driver.pubsub.acquireLease(`workflow-step-run:${runId}:${original.id}`, 'owner', 30_000);
      vi.spyOn(driver, 'redeliver').mockRejectedValue(new Error('replay rejected'));
      await expect(redeliverAndDrain(driver, { spec: 'rejected@0', runId }, 'expired')).rejects.toThrow(
        'replay rejected',
      );
      expect(Date.now).toBe(originalNow);
      expect(vi.isFakeTimers()).toBe(false);
    } finally {
      driver.dispose();
      vi.useRealTimers();
    }
  });
});
