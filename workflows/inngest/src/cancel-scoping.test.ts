/**
 * A cancel event must only cancel the run it names.
 *
 * The Inngest function registered `cancelOn: [{ event: 'cancel.workflow.<id>' }]`
 * with no `match`, so the event cancelled every in-flight run of the function.
 * All durable agents share a single function, so cancelling one run tore down
 * every other run in the deployment — and only the targeted run's snapshot was
 * marked canceled, so the rest died silently.
 */
import { Inngest } from 'inngest';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { init } from './index';

function createFunctionConfigs(workflowId: string, opts: Record<string, unknown> = {}) {
  const inngest = new Inngest({ id: 'cancel-scoping-test' });
  const configs: any[] = [];
  vi.spyOn(inngest, 'createFunction').mockImplementation(((config: any, ...rest: any[]) => {
    configs.push(config);
    return { id: config.id, rest } as any;
  }) as any);

  const { createWorkflow, createStep } = init(inngest);
  const step = createStep({
    id: 'step1',
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ value: z.string() }),
    execute: async ({ inputData }) => inputData,
  });
  const workflow = createWorkflow({
    id: workflowId,
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ value: z.string() }),
    steps: [step],
    ...opts,
  } as any)
    .then(step)
    .commit();

  return { workflow: workflow as any, configs };
}

describe('inngest cancel event scoping', () => {
  it('scopes cancellation to the run named by the cancel event', () => {
    const { workflow, configs } = createFunctionConfigs('scoped-workflow');
    workflow.getFunction();

    const config = configs.find(c => c.id === 'workflow.scoped-workflow');
    expect(config).toBeDefined();
    expect(config.cancelOn).toEqual([{ event: 'cancel.workflow.scoped-workflow', match: 'data.runId' }]);
  });

  it('matches on the same field the run sends when cancelling', async () => {
    // `Run.cancel()` sends `{ name: 'cancel.workflow.<id>', data: { runId } }`,
    // so the match expression has to point at `data.runId` for Inngest to pair
    // the cancel event with the run's trigger event.
    const { workflow, configs } = createFunctionConfigs('field-workflow');
    workflow.getFunction();

    const config = configs.find(c => c.id === 'workflow.field-workflow');
    const [cancelOn] = config.cancelOn;
    expect(cancelOn.match).toBe('data.runId');
    expect(config.triggers).toEqual({ event: 'workflow.field-workflow' });
  });
});
