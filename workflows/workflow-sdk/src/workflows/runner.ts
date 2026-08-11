import { createHook, sleep } from 'workflow';
import type { MastraRunnerResult } from '../types';
import { emitMastraEvents, executeMastraOp } from './steps';
import { runMastraGraph, type WalkerParams } from './walker';

/**
 * The single durable workflow every Mastra workflow runs on.
 *
 * Rather than compiling one Workflow SDK workflow per Mastra workflow, the whole
 * integration shares this one generic runner and drives it from the serialized
 * step graph passed in as run input. That is what lets consumers keep authoring
 * plain Mastra workflows: there is no build step that turns each
 * `createWorkflow()` call into its own `"use workflow"` function.
 *
 * Everything reachable from here must stay sandbox-safe — see `walker.ts`.
 */
export async function mastraRunner(params: WalkerParams): Promise<MastraRunnerResult> {
  'use workflow';

  return runMastraGraph(params, {
    runOp: request => executeMastraOp(request),
    sleepMs: ms => sleep(ms),
    awaitResume: async (token, onRegistered) => {
      const hook = createHook<unknown>({ token });
      // `createHook()` on its own does not register anything — registration
      // commits when the workflow suspends. Awaiting `getConflict()` forces
      // that commit without waiting for a payload, which is what makes it safe
      // to announce the suspension before blocking on the value.
      const conflict = await hook.getConflict();
      if (conflict) {
        throw new Error(
          `Cannot suspend on "${token}": run ${conflict.runId} already holds that hook. ` +
            `Two Mastra runs sharing a run id would collide here.`,
        );
      }
      await onRegistered();
      return await hook;
    },
    emit: events => emitMastraEvents(params.runId, events),
  });
}
