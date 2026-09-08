import { z } from 'zod';
import type { PubSub } from '../../../../events/pubsub';
import { evaluateTaskCompletion } from '../../../../loop/shared/steps/is-task-complete-core';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import { createStep } from '../../../../workflows/workflow';
import { MessageList } from '../../../message-list';
import { DurableAgentDefaults, DurableStepIds } from '../../constants';
import { globalRunRegistry } from '../../run-registry';
import { emitChunkEvent } from '../../stream-adapter';

/**
 * Create the durable isTaskComplete step. Behavior lives in the shared
 * `evaluateTaskCompletion` core; this glue owns registry/init-data access,
 * message-list rehydration/serialization, and projection back onto the
 * IterationState.
 *
 * The scorer instances + `onComplete` closure come from the in-process run
 * registry. They can't survive the wire, so cross-process engines (Inngest
 * after a worker restart) simply skip this step and fall back to
 * `maxSteps` + `stopWhen`.
 */
export function createDurableIsTaskCompleteStep(defaultMaxSteps: number = DurableAgentDefaults.MAX_STEPS) {
  // The step is a pass-through over the IterationState — we update
  // `lastStepResult.isContinued` and `messageListState` when a verdict
  // requires it. We use `z.any()` instead of the iteration schema to avoid
  // coupling this step to whichever extended schema each workflow uses
  // (core's IterationState extends the base shape with `modelList`).
  return createStep({
    id: DurableStepIds.IS_TASK_COMPLETE,
    inputSchema: z.any(),
    outputSchema: z.any(),
    execute: async params => {
      const { inputData, mastra, getInitData } = params;
      const state = inputData as {
        runId: string;
        iterationCount: number;
        messageListState: any;
        accumulatedSteps: Array<{
          text?: string;
          toolCalls?: Array<{ toolName?: string; args?: unknown }>;
          toolResults?: Array<{ toolName?: string; result?: unknown }>;
        }>;
        lastStepResult?: { isContinued?: boolean; reason?: string };
        options?: { maxSteps?: number };
        backgroundTaskPending?: boolean;
      };
      const pubsub = (params as any)[PUBSUB_SYMBOL] as PubSub | undefined;
      const initData = getInitData() as {
        agentId?: string;
        agentName?: string;
        state?: { threadId?: string; resourceId?: string };
        requestContextEntries?: Record<string, unknown>;
      };

      const registryEntry = globalRunRegistry.get(state.runId);

      // Rehydrate the message list lazily — only when the core actually
      // grades this iteration does it read the transcript / append feedback.
      let messageList: MessageList | undefined;
      const list = () => {
        if (!messageList) {
          messageList = new MessageList();
          messageList.deserialize(state.messageListState);
        }
        return messageList;
      };

      const lastStep = state.accumulatedSteps[state.accumulatedSteps.length - 1];
      const outcome = await evaluateTaskCompletion({
        policy: registryEntry?.isTaskComplete,
        iteration: state.iterationCount,
        maxIterations: state.options?.maxSteps ?? defaultMaxSteps,
        llmSignaledDone: state.lastStepResult?.isContinued === false,
        stepReason: state.lastStepResult?.reason,
        backgroundTaskPending: state.backgroundTaskPending,
        toolCalls: lastStep?.toolCalls ?? [],
        toolResults: lastStep?.toolResults ?? [],
        currentText: lastStep?.text || '',
        messageList: list,
        runId: state.runId,
        agentId: initData.agentId,
        agentName: initData.agentName,
        threadId: initData.state?.threadId,
        resourceId: initData.state?.resourceId,
        customContext: initData.requestContextEntries,
        generateId: () => mastra?.generateId?.(),
        emitChunk: chunk => {
          if (!pubsub) return;
          return emitChunkEvent(pubsub, state.runId, chunk as any);
        },
        logger: mastra?.getLogger?.(),
      });

      if (!outcome.evaluated) {
        return state;
      }

      // Flip isContinued based on the verdict so the outer dowhile predicate
      // continues (not complete) or stops (complete), and persist the
      // (possibly feedback-extended) transcript back into serialized state.
      const nextState: typeof state = { ...state };
      if (nextState.lastStepResult) {
        nextState.lastStepResult = {
          ...nextState.lastStepResult,
          isContinued: !outcome.complete,
        };
      }
      nextState.messageListState = list().serialize();
      return nextState;
    },
  });
}
