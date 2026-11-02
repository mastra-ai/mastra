import { z } from 'zod';
import type { PubSub } from '../../../../events/pubsub';
import { evaluateTaskCompletion } from '../../../../loop/shared/steps/is-task-complete-core';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import { createStep } from '../../../../workflows/workflow';
import { MessageList } from '../../../message-list';
import { DurableAgentDefaults, DurableStepIds } from '../../constants';
import { getRunRegistryEntry, globalRunRegistry } from '../../run-registry';
import { emitChunkEvent } from '../../stream-adapter';
import type { SerializableDurableOptions } from '../../types';
import { restoreRequestContext } from '../../utils/resolve-runtime';
import { restoreCompletionPolicy } from '../../utils/restore-completion';
import { readMessageListState, storeMessageListState } from '../shared/message-list-state';

/**
 * Create the durable isTaskComplete step. Behavior lives in the shared
 * `evaluateTaskCompletion` core; this glue owns registry/init-data access,
 * message-list rehydration/serialization, and projection back onto the
 * IterationState.
 *
 * The scorer instances + `onComplete` closure come from the in-process run
 * registry. They can't survive the wire, so a process that did not prepare
 * the run rebuilds a policy taken from the agent defaults, and warns and falls
 * back to `maxSteps` + `stopWhen` for one it cannot rebuild.
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
        messageId?: string;
        iterationCount: number;
        /** Present only on runs that thread the transcript through step payloads. */
        messageListState?: any;
        accumulatedSteps: Array<{
          text?: string;
          toolCalls?: Array<{ toolName?: string; args?: unknown }>;
          toolResults?: Array<{ toolName?: string; result?: unknown }>;
        }>;
        lastStepResult?: { isContinued?: boolean; reason?: string; signalPreempted?: boolean };
        options?: { maxSteps?: number };
        backgroundTaskPending?: boolean;
      };
      if (state.lastStepResult?.signalPreempted) return state;
      const pubsub = (params as any)[PUBSUB_SYMBOL] as PubSub | undefined;
      const initData = getInitData() as {
        agentId?: string;
        agentName?: string;
        state?: { threadId?: string; resourceId?: string };
        requestContextEntries?: Record<string, unknown>;
        options?: Pick<SerializableDurableOptions, 'isTaskComplete'>;
      };

      const registryEntry = getRunRegistryEntry(state.runId, mastra);
      let policy = registryEntry?.isTaskComplete;
      // Preparation and recovery always set the key. Without it this process
      // never saw the run's policy, so rebuild it from the persisted shadow.
      if (initData.options?.isTaskComplete && !(registryEntry && 'isTaskComplete' in registryEntry)) {
        let agent: Parameters<typeof restoreCompletionPolicy>[0]['agent'];
        try {
          agent = initData.agentId ? mastra?.getAgentById(initData.agentId) : undefined;
        } catch {
          // Reported below as a policy that cannot be restored.
        }
        const restored = await restoreCompletionPolicy({
          agent,
          persisted: initData.options.isTaskComplete,
          requestContext: restoreRequestContext(initData.requestContextEntries, registryEntry?.requestContext),
          runId: state.runId,
          logger: mastra?.getLogger?.(),
        });
        if (registryEntry) registryEntry.isTaskComplete = restored;
        policy = restored;
      }
      // No scorers → nothing to grade.
      if (!policy?.scorers?.length) return state;

      // Build the message list lazily — only when the core actually grades
      // this iteration does it read the transcript / append feedback.
      const messageListState = await readMessageListState(params, state);
      let messageList: MessageList | undefined;
      const list = () => {
        if (!messageList) {
          messageList = new MessageList();
          messageList.deserialize(messageListState);
        }
        return messageList;
      };

      const lastStep = state.accumulatedSteps[state.accumulatedSteps.length - 1];
      const outcome = await evaluateTaskCompletion({
        policy,
        // Durable steps replay under at-least-once redelivery: a
        // throwing scorer/callback would fail the step and be re-invoked
        // against the same state forever, so failures are logged and grading
        // is skipped. Chunk emission is post-verdict publish —
        // best-effort by the same argument.
        errorPolicy: 'best-effort',
        // Durable shipped the errored-iteration grading skip (#21897)
        // pre-extraction — keep it here.
        engineMode: 'durable',
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
      // The retry turn needs its own response message (the non-durable loop
      // switches to a fresh id too). Reusing the graded turn's id folds the
      // retry into that earlier message, ahead of the feedback.
      if (!outcome.complete && nextState.messageId) {
        nextState.messageId = list().rotateResponseMessageId(nextState.messageId);
      }
      Object.assign(nextState, await storeMessageListState(params, list().serialize()));
      return nextState;
    },
  });
}
