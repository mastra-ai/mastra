/**
 * A loop whose nested workflow suspended mid-iteration must keep looping after
 * the child is resumed. With step guards enabled, the resumed child's completion
 * has to settle the loop leaf under its stored occurrence; otherwise the leaf
 * stays `running`, the next iteration's step.run is rejected as stale and
 * silently acked, and the run never finishes (#28932).
 */

import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage/mock';
import { assertWorkflowStepGuard } from '../../storage/workflow-step-guard';
import { createStep, createWorkflow } from '.';

const Value = z.object({ n: z.number() });
const hosts: Mastra[] = [];

afterEach(async () => {
  await Promise.all(hosts.splice(0).map(host => host.stopWorkers()));
});

/** Enforce step guards on the in-memory store the way guard-capable adapters (pg) do. */
async function withStepGuards(storage: InMemoryStore) {
  const workflows = (await storage.getStore('workflows'))!;
  const update = workflows.updateWorkflowResults.bind(workflows);
  let lock: Promise<unknown> = Promise.resolve();
  workflows.supportsWorkflowStepGuards = () => true;
  workflows.updateWorkflowResults = args => {
    const write = lock.then(async () => {
      const { startGuard, completionGuard, ...rest } = args;
      const { workflowName, runId, stepId, result } = rest;
      const snapshot = await workflows.loadWorkflowSnapshot({ workflowName, runId });
      assertWorkflowStepGuard({ snapshot, stepId, startGuard, completionGuard });
      const stored = snapshot?.context[stepId];
      const written = completionGuard?.pruneOnly
        ? { ...result, metadata: { ...stored?.metadata, ...result.metadata, __continuationStarted: true } }
        : result;
      const context = await update({ ...rest, result: written });
      const previous = startGuard?.previousStep;
      const previousResult = previous && context[previous.stepId];
      if (
        previous &&
        previous.stepId !== stepId &&
        previousResult?.status === 'success' &&
        previousResult.metadata?.startedBy === previous.eventId
      ) {
        return update({
          workflowName,
          runId,
          stepId: previous.stepId,
          result: {
            ...previous.result,
            metadata: { ...previousResult.metadata, ...previous.result.metadata, __continuationStarted: true },
          },
          requestContext: rest.requestContext,
        });
      }
      return context;
    });
    lock = write.catch(() => {});
    return write;
  };
}

describe('evented resume of a nested loop body', () => {
  // The resumed iteration either needs another one (the stall in #28932) or meets the exit
  // condition, so the condition must be evaluated on the resumed result, not a saved decision.
  it.each([
    { name: 'runs the next iteration', add: 1, seen: [0, 1, 1, 2] },
    { name: 'ends the loop', add: 2, seen: [0, 1, 1] },
  ])(
    '$name after the resumed child completes under the stored occurrence',
    async ({ add, seen: expected }) => {
      const storage = new InMemoryStore();
      await withStepGuards(storage);

      const seen: number[] = [];
      const inc = createStep({
        id: 'inc',
        inputSchema: Value,
        outputSchema: Value,
        resumeSchema: z.object({ add: z.number() }),
        execute: async ({ inputData, resumeData, suspend }) => {
          seen.push(inputData.n);
          if (inputData.n === 1 && !resumeData) {
            return suspend({});
          }
          return { n: inputData.n + (resumeData?.add ?? 1) };
        },
      });
      const body = createWorkflow({ id: 'resume-loop-body', inputSchema: Value, outputSchema: Value })
        .then(inc)
        .commit();
      const outer = createWorkflow({ id: 'resume-loop-outer', inputSchema: Value, outputSchema: Value })
        .dountil(body, async ({ inputData }) => inputData.n >= 3)
        .commit();

      const mastra = new Mastra({
        logger: false,
        storage,
        workflows: { [body.id]: body, [outer.id]: outer },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startWorkers();
      hosts.push(mastra);

      const run = await outer.createRun();
      const suspended = await run.start({ inputData: { n: 0 } });
      expect(suspended.status).toBe('suspended');

      const result = await Promise.race([
        run.resume({ step: [body.id, 'inc'], resumeData: { add } }),
        new Promise<{ status: 'hung' }>(resolve => setTimeout(() => resolve({ status: 'hung' }), 10_000)),
      ]);

      const workflows = (await storage.getStore('workflows'))!;
      const snapshot = await workflows.loadWorkflowSnapshot({ workflowName: outer.id, runId: run.runId });
      expect(result.status, `loop leaf: ${JSON.stringify(snapshot?.context[body.id])}`).toBe('success');
      expect(result).toMatchObject({ result: { n: 3 } });
      expect(seen).toEqual(expected);
    },
    20_000,
  );
});
