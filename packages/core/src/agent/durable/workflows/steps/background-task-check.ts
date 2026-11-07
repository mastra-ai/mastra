import { z } from 'zod';
import type { PubSub } from '../../../../events/pubsub';
import { checkBackgroundTasks } from '../../../../loop/shared/steps/background-task-check-core';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import { createStep } from '../../../../workflows/workflow';
import { DurableStepIds } from '../../constants';
import { getRunRegistryEntry, globalRunRegistry } from '../../run-registry';
import { emitChunkEvent } from '../../stream-adapter';
import { createRunMessageList } from '../../utils/run-message-list';
import {
  foldBackgroundResults,
  hasAppliedBackgroundResults,
  settleFinishedBackgroundResults,
} from '../shared/background-results';
import { readMessageListState, storeMessageListState } from '../shared/message-list-state';

const BG_CHECK_STEP_ID = `${DurableStepIds.AGENTIC_EXECUTION}-bg-task-check`;

/**
 * The background task check step accepts the output of llmMappingStep
 * and passes it through, adding backgroundTaskPending if tasks are running.
 */
const bgCheckInputSchema = z.any();
const bgCheckOutputSchema = z.any();

/**
 * Create a durable background task check step. Behavior lives in the shared
 * `checkBackgroundTasks` core; this glue owns registry/init-data access, the
 * durable wait gate, and pubsub emission.
 *
 * The durable wait gate differs from the main loop's on purpose: the regular
 * agent can skip waiting because background tool-result chunks are pushed
 * directly into the live ReadableStream controller — that works even after
 * this step returns. The durable agent emits tool-result chunks via pubsub,
 * and the subscription is torn down when the stream closes. If this step
 * returned without waiting, the workflow would finish, FINISH would fire,
 * cleanup would run, and the subscriber would be gone before the background
 * task could deliver its result. Therefore the durable agent must always
 * wait when tasks are running — using the configured waitTimeoutMs, or a 1 s
 * default to keep the workflow (and pubsub) alive. It only signals pending
 * without blocking on retryCount 0 when an explicit timeout is configured
 * (meaning the caller drives continuation externally).
 */
export function createDurableBackgroundTaskCheckStep() {
  return createStep({
    id: BG_CHECK_STEP_ID,
    inputSchema: bgCheckInputSchema,
    outputSchema: bgCheckOutputSchema,
    execute: async params => {
      const { inputData, getInitData, retryCount } = params;
      const pubsub = (params as any)[PUBSUB_SYMBOL] as PubSub | undefined;
      const typedInput = inputData as Record<string, any>;
      if (typedInput.stepResult?.signalPreempted && !typedInput.stepResult.isContinued) return typedInput;

      const initData = getInitData<{
        runId: string;
        agentId: string;
        options?: { skipBgTaskWait?: boolean };
        state?: { threadId?: string; resourceId?: string };
      }>();
      const { runId, agentId } = initData;

      const registryEntry = getRunRegistryEntry(runId, params.mastra);
      const bgManager = registryEntry?.backgroundTaskManager;
      const waitTimeoutMs = registryEntry?.backgroundTasksConfig?.waitTimeoutMs ?? bgManager?.config?.waitTimeoutMs;

      const outcome = await checkBackgroundTasks({
        bgManager,
        runId,
        agentId,
        threadId: initData.state?.threadId,
        resourceId: initData.state?.resourceId,
        skipWait: initData.options?.skipBgTaskWait,
        retryCount,
        resolveWaitMs: rc => (rc === 0 && waitTimeoutMs ? undefined : (waitTimeoutMs ?? 1000)),
        emitChunk: chunk => {
          if (!pubsub) return;
          return emitChunkEvent(pubsub, runId, chunk as any);
        },
      });

      // A task's status turns terminal before its onResult hook runs, so wait for the hooks of
      // finished tasks. Cancelled tasks never call it.
      if (bgManager) {
        await settleFinishedBackgroundResults(
          registryEntry,
          async taskId => {
            const status = (await bgManager.getTask(taskId))?.status;
            return status === 'completed' || status === 'failed' || status === 'timed_out';
          },
          waitTimeoutMs ?? 1000,
        );
      }
      // onResult wrote finished results into the tool-call step's message list, not into the
      // transcript in workflow state that the next model call reads.
      let output = typedInput;
      if (hasAppliedBackgroundResults(registryEntry)) {
        const transcript = await readMessageListState(params, typedInput);
        const list = createRunMessageList({ mastra: params.mastra }).deserialize(transcript);
        if (await foldBackgroundResults(registryEntry, list)) {
          output = { ...typedInput, ...(await storeMessageListState(params, list.serialize())) };
        }
      }

      switch (outcome.status) {
        case 'pass-through':
        case 'timeout':
          return output;
        case 'pending':
          return { ...output, backgroundTaskPending: true };
        case 'completed':
          if (output.stepResult) {
            return {
              ...output,
              backgroundTaskPending: true,
              stepResult: { ...output.stepResult, isContinued: true },
            };
          }
          return { ...output, backgroundTaskPending: true };
      }
    },
  });
}
