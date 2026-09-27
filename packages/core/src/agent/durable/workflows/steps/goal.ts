import { z } from 'zod';
import type { PubSub } from '../../../../events/pubsub';
import { evaluateGoal } from '../../../../loop/shared/steps/goal-core';
import { RequestContext } from '../../../../request-context';
import type { ChunkType } from '../../../../stream/types';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import { createStep } from '../../../../workflows/workflow';
import { globalRunRegistry } from '../../run-registry';
import { emitChunkEvent } from '../../stream-adapter';
import { createRunMessageList } from '../../utils/run-message-list';

/**
 * Create the durable goal step.
 *
 * Behavior lives in the shared `evaluateGoal` core; this glue owns
 * registry/init-data access, request-context reconstruction, message-list
 * rehydration/serialization, and projection back onto the IterationState.
 *
 * The `goal` config (judge, scorer, tools closures) comes from the in-process
 * run registry — closures can't survive the wire, so cross-process engines
 * without this slot fall back to the agent's own config or skip goal
 * evaluation. The objective and its progress are isolated by thread and
 * loaded from storage inside the core.
 */
export function createDurableGoalStep() {
  return createStep({
    id: 'durable-goal',
    inputSchema: z.any(),
    outputSchema: z.any(),
    execute: async params => {
      const { inputData, mastra, getInitData } = params;
      const state = inputData as {
        runId: string;
        iterationCount: number;
        messageListState: any;
        messageId: string;
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
      // This is shared agent configuration (judge, scorer, tools, defaults), not per-goal state.
      // The objective and its progress are isolated by thread and loaded from storage in the core.
      let goalConfig = registryEntry?.goal;
      if (!goalConfig && initData.agentId) {
        goalConfig = (mastra as any)?.getAgentById?.(initData.agentId)?.__getGoalConfig?.();
      }

      // Reconstruct requestContext from serialized entries for resolvers.
      const requestContext = new RequestContext();
      if (initData.requestContextEntries) {
        for (const [key, value] of Object.entries(initData.requestContextEntries)) {
          requestContext.set(key, value);
        }
      }

      // Rehydrate the message list lazily — only when the core actually judges
      // this iteration does it read the transcript / append the feedback
      // signal. Memoized so the scorer context and signal injection share one
      // instance, which is then serialized back into state.
      let messageList: ReturnType<ReturnType<typeof createRunMessageList>['deserialize']> | undefined;
      const list = () => {
        if (!messageList) {
          messageList = createRunMessageList({ mastra }).deserialize(state.messageListState);
        }
        return messageList;
      };

      const lastStep = state.accumulatedSteps[state.accumulatedSteps.length - 1];
      const outcome = await evaluateGoal({
        goal: goalConfig,
        stepReason: state.lastStepResult?.reason,
        backgroundTaskPending: state.backgroundTaskPending,
        isContinued: state.lastStepResult?.isContinued,
        toolCalls: lastStep?.toolCalls ?? [],
        toolResults: lastStep?.toolResults ?? [],
        currentText: lastStep?.text || '',
        runId: state.runId,
        agentId: initData.agentId,
        agentName: initData.agentName,
        threadId: initData.state?.threadId,
        resourceId: initData.state?.resourceId,
        customContext: initData.requestContextEntries,
        mastra,
        requestContext,
        messageList: list,
        messageId: state.messageId,
        rotateMessageId: current => list().rotateResponseMessageId(current),
        writeSignal: pubsub
          ? async data => {
              await emitChunkEvent(pubsub, state.runId, data as ChunkType);
            }
          : undefined,
        emitChunk: chunk => {
          if (!pubsub) return;
          return emitChunkEvent(pubsub, state.runId, chunk as any);
        },
      });

      if (!outcome.evaluated) {
        return state;
      }

      const nextState: typeof state = { ...state };
      if (nextState.lastStepResult) {
        nextState.lastStepResult = {
          ...nextState.lastStepResult,
          isContinued: outcome.shouldContinue,
        };
      }
      if (outcome.kind === 'judged') {
        // The transcript gained the feedback signal (and the response message
        // id may have rotated) — persist both back into serialized state.
        nextState.messageId = outcome.messageId;
        nextState.messageListState = list().serialize();
      }
      return nextState;
    },
  });
}
