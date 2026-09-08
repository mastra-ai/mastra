import { z } from 'zod';
import type { PubSub } from '../../../../events/pubsub';
import { checkBackgroundTasks } from '../../../../loop/shared/steps/background-task-check-core';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import { createStep } from '../../../../workflows/workflow';
import { DurableStepIds } from '../../constants';
import { globalRunRegistry } from '../../run-registry';
import { emitChunkEvent } from '../../stream-adapter';

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

      const initData = getInitData<{
        runId: string;
        agentId: string;
        options?: { skipBgTaskWait?: boolean };
        state?: { threadId?: string; resourceId?: string };
      }>();
      const { runId, agentId } = initData;

      const registryEntry = globalRunRegistry.get(runId);
      const bgManager = registryEntry?.backgroundTaskManager;

      const outcome = await checkBackgroundTasks({
        bgManager,
        runId,
        agentId,
        threadId: initData.state?.threadId,
        resourceId: initData.state?.resourceId,
        skipWait: initData.options?.skipBgTaskWait,
        retryCount,
        resolveWaitMs: rc => {
          const waitTimeoutMs = registryEntry?.backgroundTasksConfig?.waitTimeoutMs ?? bgManager?.config?.waitTimeoutMs;
          return rc === 0 && waitTimeoutMs ? undefined : (waitTimeoutMs ?? 1000);
        },
        emitChunk: chunk => {
          if (!pubsub) return;
          return emitChunkEvent(pubsub, runId, chunk as any);
        },
      });

      switch (outcome.status) {
        case 'pass-through':
        case 'timeout':
          return typedInput;
        case 'pending':
          return { ...typedInput, backgroundTaskPending: true };
        case 'completed':
          if (typedInput.stepResult) {
            return {
              ...typedInput,
              backgroundTaskPending: true,
              stepResult: { ...typedInput.stepResult, isContinued: true },
            };
          }
          return { ...typedInput, backgroundTaskPending: true };
      }
    },
  });
}
