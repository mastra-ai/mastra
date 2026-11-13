import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';

/**
 * Regression tests for #29757.
 *
 * Time travelling into a `.branch()` that has more than one condition used to
 * drop everything after the branch: the run reported `success` with an empty
 * result (the post-branch `.parallel()` arms never ran), and a nested workflow
 * that suspended after the recovered step could never be resumed — the run
 * stayed `suspended` with no suspended step and every further `resume()` threw
 * `This workflow step "..." was not suspended. Available suspended steps: []`.
 *
 * A single-condition branch already worked, so every shape below runs with both
 * one and two conditions to pin the two paths identical.
 */
const num = z.object({ x: z.number() });

/** A step that fails on its first call and succeeds afterwards, so a run can be time travelled into it. */
function flakyStep(executed: string[]) {
  let calls = 0;
  return createStep({
    id: 'flaky',
    inputSchema: num,
    outputSchema: num,
    execute: async ({ inputData }) => {
      executed.push('flaky');
      calls += 1;
      if (calls === 1) throw new Error('flaky boom');
      return { x: inputData.x + 1 };
    },
  });
}

/** The non-selected branch arm, used to force the branch to have two conditions. */
function otherStep(executed: string[]) {
  return createStep({
    id: 'other',
    inputSchema: num,
    outputSchema: num,
    execute: async () => {
      executed.push('other');
      return { x: -1 };
    },
  });
}

/** Records that it ran and passes its input straight through. */
function passThroughStep(id: string, executed: string[]) {
  return createStep({
    id,
    inputSchema: z.any(),
    outputSchema: z.any(),
    execute: async ({ inputData }) => {
      executed.push(id);
      return inputData;
    },
  });
}

/** Suspends until resumed, then adds the resumed `value` to its input `x`. */
function askStep(executed: string[]) {
  return createStep({
    id: 'ask',
    inputSchema: num,
    outputSchema: num,
    resumeSchema: z.object({ value: z.number() }),
    execute: async ({ inputData, resumeData, suspend }) => {
      executed.push('ask');
      if (!resumeData) {
        await suspend({});
      }
      return { x: inputData.x + (resumeData?.value ?? 0) };
    },
  });
}

/** `[[true, first], [false, second]]` truncated to `count` conditions. */
function branchArms(count: number, first: unknown, second: unknown) {
  const arms = [
    [async () => true, first],
    [async () => false, second],
  ].slice(0, count);
  return arms as any;
}

/** `mid` = `.branch(...).parallel([report, audit])`, used as a nested step of a wrapper workflow. */
function midWorkflow(count: number, executed: string[]) {
  const flaky = flakyStep(executed);
  const other = otherStep(executed);
  const report = passThroughStep('report', executed);
  const audit = passThroughStep('audit', executed);
  return createWorkflow({ id: 'mid', inputSchema: num, outputSchema: z.any(), steps: [flaky, other, report, audit] })
    .branch(branchArms(count, flaky, other))
    .parallel([report, audit])
    .commit();
}

const conditions = [1, 2];

describe('timeTravel into a multi-condition .branch() — #29757', () => {
  it.each(conditions)('continues after a plain-step arm with %i condition(s)', async count => {
    const executed: string[] = [];
    const flaky = flakyStep(executed);
    const other = otherStep(executed);
    const report = passThroughStep('report', executed);
    const audit = passThroughStep('audit', executed);

    const workflow = createWorkflow({
      id: `tt-conditional-plain-${count}`,
      inputSchema: num,
      outputSchema: z.any(),
      steps: [flaky, other, report, audit],
    })
      .branch(branchArms(count, flaky, other))
      .parallel([report, audit])
      .commit();

    new Mastra({ logger: false, storage: new MockStore(), workflows: { workflow } });

    const run = await workflow.createRun();
    expect((await run.start({ inputData: { x: 0 } })).status).toBe('failed');

    const result = await run.timeTravel({ step: 'flaky' });

    expect(result.status).toBe('success');
    expect(executed).toEqual(['flaky', 'flaky', 'report', 'audit']);
    expect(result.result).toEqual({ report: { flaky: { x: 1 } }, audit: { flaky: { x: 1 } } });
  });

  it.each(conditions)('continues after a nested-workflow arm with %i condition(s)', async count => {
    const executed: string[] = [];
    const flaky = flakyStep(executed);
    const inner = createWorkflow({ id: 'inner', inputSchema: num, outputSchema: num, steps: [flaky] })
      .then(flaky)
      .commit();
    const other = otherStep(executed);
    const report = passThroughStep('report', executed);
    const audit = passThroughStep('audit', executed);

    const workflow = createWorkflow({
      id: `tt-conditional-nested-${count}`,
      inputSchema: num,
      outputSchema: z.any(),
      steps: [inner, other, report, audit],
    })
      .branch(branchArms(count, inner, other))
      .parallel([report, audit])
      .commit();

    new Mastra({ logger: false, storage: new MockStore(), workflows: { workflow } });

    const run = await workflow.createRun();
    expect((await run.start({ inputData: { x: 0 } })).status).toBe('failed');

    const result = await run.timeTravel({ step: ['inner', 'flaky'] });

    expect(result.status).toBe('success');
    expect(executed).toEqual(['flaky', 'flaky', 'report', 'audit']);
    expect(result.result).toEqual({ report: { inner: { x: 1 } }, audit: { inner: { x: 1 } } });
  });

  it.each(conditions)(
    'resumes a nested-workflow arm that suspends after the recovered step with %i condition(s)',
    async count => {
      const executed: string[] = [];
      const flaky = flakyStep(executed);
      const ask = askStep(executed);
      const inner = createWorkflow({ id: 'inner', inputSchema: num, outputSchema: num, steps: [flaky, ask] })
        .then(flaky)
        .then(ask)
        .commit();
      const other = otherStep(executed);
      const report = passThroughStep('report', executed);

      const workflow = createWorkflow({
        id: `tt-conditional-suspend-${count}`,
        inputSchema: num,
        outputSchema: z.any(),
        steps: [inner, other, report],
      })
        .branch(branchArms(count, inner, other))
        .then(report)
        .commit();

      new Mastra({ logger: false, storage: new MockStore(), workflows: { workflow } });

      const run = await workflow.createRun();
      expect((await run.start({ inputData: { x: 0 } })).status).toBe('failed');

      const travelled = await run.timeTravel({ step: ['inner', 'flaky'] });
      expect(travelled.status).toBe('suspended');
      expect(travelled.suspended).toEqual([['inner', 'ask']]);

      const resumed = await run.resume({ step: travelled.suspended![0]!, resumeData: { value: 10 } });

      expect(resumed.status).toBe('success');
      expect(executed).toContain('report');
      expect(resumed.result).toEqual({ inner: { x: 11 } });
    },
  );

  it.each(conditions)('keeps the branch output through a .then() wrapper with %i condition(s)', async count => {
    const executed: string[] = [];
    const mid = midWorkflow(count, executed);
    const after = passThroughStep('after', executed);

    const outer = createWorkflow({
      id: `tt-conditional-wrapper-then-${count}`,
      inputSchema: num,
      outputSchema: z.any(),
      steps: [mid, after],
    })
      .then(mid)
      .then(after)
      .commit();

    new Mastra({ logger: false, storage: new MockStore(), workflows: { outer } });

    const run = await outer.createRun();
    expect((await run.start({ inputData: { x: 0 } })).status).toBe('failed');

    const result = await run.timeTravel({ step: ['mid', 'flaky'] });

    expect(result.status).toBe('success');
    expect(executed).toEqual(['flaky', 'flaky', 'report', 'audit', 'after']);
    expect(result.result).toEqual({ report: { flaky: { x: 1 } }, audit: { flaky: { x: 1 } } });
  });

  it.each(conditions)('keeps the branch output through a .parallel() wrapper with %i condition(s)', async count => {
    const executed: string[] = [];
    const mid = midWorkflow(count, executed);
    const side = passThroughStep('side', executed);
    const after = passThroughStep('after', executed);

    const outer = createWorkflow({
      id: `tt-conditional-wrapper-parallel-${count}`,
      inputSchema: num,
      outputSchema: z.any(),
      steps: [mid, side, after],
    })
      .parallel([mid, side])
      .then(after)
      .commit();

    new Mastra({ logger: false, storage: new MockStore(), workflows: { outer } });

    const run = await outer.createRun();
    expect((await run.start({ inputData: { x: 0 } })).status).toBe('failed');

    const result = await run.timeTravel({ step: ['mid', 'flaky'] });

    expect(result.status).toBe('success');
    expect(executed).toEqual(expect.arrayContaining(['flaky', 'report', 'audit', 'side', 'after']));
    expect(executed.filter(id => id === 'flaky')).toHaveLength(2);
    expect(result.result).toEqual({
      mid: { report: { flaky: { x: 1 } }, audit: { flaky: { x: 1 } } },
      side: { x: 0 },
    });
  });

  it.each(conditions)('keeps the branch output through a .dowhile() wrapper with %i condition(s)', async count => {
    const executed: string[] = [];
    const mid = midWorkflow(count, executed);
    const after = passThroughStep('after', executed);

    const outer = createWorkflow({
      id: `tt-conditional-wrapper-dowhile-${count}`,
      inputSchema: num,
      outputSchema: z.any(),
      steps: [mid, after],
    })
      .dowhile(mid, async ({ inputData }: { inputData: unknown }) => {
        void inputData;
        return false;
      })
      .then(after)
      .commit();

    new Mastra({ logger: false, storage: new MockStore(), workflows: { outer } });

    const run = await outer.createRun();
    expect((await run.start({ inputData: { x: 0 } })).status).toBe('failed');

    const result = await run.timeTravel({ step: ['mid', 'flaky'] });

    expect(result.status).toBe('success');
    expect(executed).toEqual(['flaky', 'flaky', 'report', 'audit', 'after']);
    expect(result.result).toEqual({ report: { flaky: { x: 1 } }, audit: { flaky: { x: 1 } } });
  });
});
