/**
 * COR-1497: a run restarted while a loop's nested workflow was mid-step must
 * keep looping after the restarted child finishes. With step guards enabled,
 * the child's completion has to settle the loop leaf under its stored
 * occurrence; otherwise the leaf stays `running` under the pre-crash event id,
 * the next iteration's step.run is rejected as stale and silently acked, and
 * the run never finishes.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { withStepGuards } from './test-utils/step-guards';
import { createStep, createWorkflow } from '.';

const Value = z.object({ n: z.number() });
const hosts: Mastra[] = [];

afterEach(async () => {
  await Promise.all(hosts.splice(0).map(host => host.stopWorkers()));
});

async function makeHost(workflows: Record<string, any>, storage: MockStore) {
  const mastra = new Mastra({ logger: false, storage, workflows, pubsub: new EventEmitterPubSub() });
  await mastra.startWorkers();
  hosts.push(mastra);
  return mastra;
}

function build(incExecute: (n: number) => Promise<{ n: number }>) {
  const inc = createStep({
    id: 'inc',
    inputSchema: Value,
    outputSchema: Value,
    execute: async ({ inputData }) => incExecute(inputData.n),
  });
  const body = createWorkflow({ id: 'restart-loop-body', inputSchema: Value, outputSchema: Value }).then(inc).commit();
  const outer = createWorkflow({ id: 'restart-loop-outer', inputSchema: Value, outputSchema: Value })
    .dountil(body, async ({ inputData }) => inputData.n >= 3)
    .commit();
  return { [body.id]: body, [outer.id]: outer };
}

describe('evented restart of a nested loop body', () => {
  it('keeps looping after the restarted child completes under the stored occurrence', async () => {
    const storage = new MockStore();
    await withStepGuards(storage);
    const runId = `restart-loop-${Date.now()}`;

    // Host A: the second iteration's step hangs, as if the process died mid-step.
    const crashed = Promise.withResolvers<void>();
    const hostA = build(async n => {
      if (n === 1) {
        crashed.resolve();
        await new Promise<never>(() => {});
      }
      return { n: n + 1 };
    });
    await makeHost(hostA, storage);
    const runA = await hostA['restart-loop-outer'].createRun({ runId });
    runA.start({ inputData: { n: 0 } }).catch(() => {});
    await crashed.promise;

    // The crashed iteration's leaf is guarded: `running` under a stored occurrence.
    const workflows = (await storage.getStore('workflows'))!;
    const crashedSnapshot = await workflows.loadWorkflowSnapshot({ workflowName: 'restart-loop-outer', runId });
    const crashedLeaf = crashedSnapshot?.context['restart-loop-body'];
    expect(crashedLeaf?.status).toBe('running');
    expect(crashedLeaf?.metadata?.startedBy).toEqual(expect.any(String));

    // Host B: fresh instances over the same storage restart the run.
    const seen: number[] = [];
    const hostB = build(async n => {
      seen.push(n);
      return { n: n + 1 };
    });
    await makeHost(hostB, storage);
    const runB = await hostB['restart-loop-outer'].createRun({ runId });
    const result = await Promise.race([
      runB.restart(),
      new Promise<{ status: 'hung' }>(resolve => setTimeout(() => resolve({ status: 'hung' }), 10_000)),
    ]);

    const snapshot = await workflows.loadWorkflowSnapshot({ workflowName: 'restart-loop-outer', runId });
    expect(result.status, `loop leaf: ${JSON.stringify(snapshot?.context['restart-loop-body'])}`).toBe('success');
    expect(result).toMatchObject({ result: { n: 3 } });
    expect(seen).toEqual([1, 2]);
    expect(snapshot?.context['restart-loop-body']?.status).not.toBe('running');
  }, 20_000);
});
