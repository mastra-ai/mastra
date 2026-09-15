import { z } from 'zod';
import type { IsTaskCompleteRunResult, MastraDBMessage } from '../../../../agent';
import type { PubSub } from '../../../../events/pubsub';
import type { StreamCompletionContext } from '../../../../loop/network/validation';
import { formatStreamCompletionFeedback, runStreamCompletionScorers } from '../../../../loop/network/validation';
import { ChunkFrom } from '../../../../stream/types';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import { createStep } from '../../../../workflows/workflow';
import { MessageList } from '../../../message-list';
import { DurableAgentDefaults, DurableStepIds } from '../../constants';
import { globalRunRegistry } from '../../run-registry';
import { emitChunkEvent } from '../../stream-adapter';

/**
 * Create the durable isTaskComplete step.
 *
 * Mirrors the non-durable `createIsTaskCompleteStep` contract:
 *  - Runs after each agentic iteration has settled its tool calls.
 *  - Only scores iterations where the LLM has signaled it is done
 *    (`lastStepResult.isContinued === false`) so we don't interrupt mid-loop
 *    tool execution.
 *  - Skips working-memory-only iterations (same heuristic as the non-durable
 *    step) — those are bookkeeping, not user-visible task progress.
 *  - Pulls the scorer instances + `onComplete` closure from the in-process run
 *    registry. They can't survive the wire, so cross-process engines (Inngest
 *    after a worker restart) simply skip this step and fall back to
 *    `maxSteps` + `stopWhen`.
 *  - On a verdict it flips `state.lastStepResult.isContinued` so the outer
 *    `dowhile` predicate either stops the loop (passed) or runs one more LLM
 *    iteration (not passed). Feedback (when not suppressed) is appended as an
 *    assistant message so the next LLM call can see it.
 *  - Emits an `is-task-complete` chunk via pubsub so external observers see
 *    the verdict and payload exactly like the non-durable path.
 */
export function createDurableIsTaskCompleteStep(defaultMaxSteps: number = DurableAgentDefaults.MAX_STEPS) {
  // The step is a pass-through over the IterationState — we mutate
  // `lastStepResult.isContinued` and `messageListState` in place when a
  // verdict requires it. We use `z.any()` instead of the iteration schema to
  // avoid coupling this step to whichever extended schema each workflow uses
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
        lastStepResult?: { isContinued?: boolean };
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
      const isTaskComplete = registryEntry?.isTaskComplete;
      const hasScorers = !!isTaskComplete?.scorers && isTaskComplete.scorers.length > 0;

      // Fast path — nothing to do without a registered policy.
      if (!hasScorers || !isTaskComplete) {
        return state;
      }

      // Don't interrupt mid-tool loops. The non-durable step has the same
      // guard via `inputData.stepResult?.isContinued`.
      const llmSignaledDone = state.lastStepResult?.isContinued === false;
      if (!llmSignaledDone) {
        return state;
      }

      // The background-task-check step may set backgroundTaskPending=true to
      // force one more LLM iteration after a task settles. Skip scoring in
      // that case so we don't double-score the same outcome.
      if (state.backgroundTaskPending) {
        return state;
      }

      const lastStep = state.accumulatedSteps[state.accumulatedSteps.length - 1];
      const iterationToolCalls = (lastStep?.toolCalls ?? []) as Array<{
        toolName?: string;
        args?: unknown;
      }>;
      const isWorkingMemoryToolName = (name?: string) =>
        name === 'updateWorkingMemory' || name === 'setWorkingMemory' || name === 'update-working-memory';
      const allWorkingMemory =
        iterationToolCalls.length > 0 && iterationToolCalls.every(tc => isWorkingMemoryToolName(tc.toolName));
      if (allWorkingMemory) {
        return state;
      }

      const runMaxSteps = state.options?.maxSteps ?? defaultMaxSteps;

      // Rehydrate the message list once so we can read the original task and
      // append feedback after scoring.
      const messageList = new MessageList();
      messageList.deserialize(state.messageListState);
      const userMessages = messageList.get.input.db();
      const firstUserMessage = userMessages[0];
      let originalTask = 'Unknown task';
      if (firstUserMessage) {
        if (typeof firstUserMessage.content === 'string') {
          originalTask = firstUserMessage.content;
        } else if ((firstUserMessage.content as any)?.parts?.[0]?.type === 'text') {
          originalTask = ((firstUserMessage.content as any).parts[0] as { text: string }).text;
        }
      }

      const toolResultsForCtx = (lastStep?.toolResults ?? []) as Array<{
        toolName?: string;
        result?: unknown;
      }>;

      const ctx: StreamCompletionContext = {
        iteration: state.iterationCount,
        maxIterations: runMaxSteps,
        originalTask,
        currentText: lastStep?.text || '',
        toolCalls: iterationToolCalls.map(tc => ({
          name: tc.toolName || '',
          args: (tc.args as Record<string, unknown>) ?? {},
        })),
        messages: messageList.get.all.db(),
        toolResults: toolResultsForCtx.map(tr => ({
          name: tr.toolName || '',
          result: (tr.result as Record<string, unknown>) ?? {},
        })),
        agentId: initData.agentId || '',
        agentName: initData.agentName || '',
        runId: state.runId,
        threadId: initData.state?.threadId,
        resourceId: initData.state?.resourceId,
        customContext: initData.requestContextEntries,
      };

      let result: IsTaskCompleteRunResult | undefined;
      try {
        result = await runStreamCompletionScorers(isTaskComplete.scorers!, ctx, {
          strategy: isTaskComplete.strategy,
          parallel: isTaskComplete.parallel,
          timeout: isTaskComplete.timeout,
        });
      } catch (err) {
        mastra?.getLogger?.()?.warn?.(`[DurableAgent] isTaskComplete scoring failed: ${err}`);
        return state;
      }

      if (!result) {
        return state;
      }

      if (isTaskComplete.onComplete) {
        try {
          await isTaskComplete.onComplete(result);
        } catch (err) {
          mastra?.getLogger?.()?.warn?.(`[DurableAgent] isTaskComplete onComplete callback failed: ${err}`);
        }
      }

      const maxIterationReached = runMaxSteps ? state.iterationCount >= runMaxSteps : false;

      // Flip isContinued based on the verdict so the outer dowhile predicate
      // continues (not complete) or stops (complete). This is the contract
      // the non-durable createIsTaskCompleteStep uses.
      const nextState: typeof state = { ...state };
      if (nextState.lastStepResult) {
        nextState.lastStepResult = {
          ...nextState.lastStepResult,
          isContinued: !result.complete,
        };
      }

      // Append the feedback as an assistant message so the next LLM iteration
      // can course-correct. Skipped when the check passes, mirroring the
      // non-durable createIsTaskCompleteStep.
      if (!result.complete) {
        const feedback = formatStreamCompletionFeedback(result, maxIterationReached);
        messageList.add(
          {
            id: mastra?.generateId?.(),
            createdAt: new Date(),
            type: 'text',
            role: 'assistant',
            content: {
              parts: [{ type: 'text', text: feedback }],
              metadata: {
                mode: 'stream',
                completionResult: {
                  passed: result.complete,
                  suppressFeedback: !!isTaskComplete.suppressFeedback,
                },
              },
              format: 2,
            },
          } as MastraDBMessage,
          'response',
        );
      }
      nextState.messageListState = messageList.serialize();

      if (pubsub) {
        try {
          await emitChunkEvent(pubsub, state.runId, {
            type: 'is-task-complete',
            runId: state.runId,
            from: ChunkFrom.AGENT,
            payload: {
              iteration: state.iterationCount,
              passed: result.complete,
              results: result.scorers,
              duration: result.totalDuration,
              timedOut: result.timedOut,
              reason: result.completionReason,
              maxIterationReached,
              suppressFeedback: !!isTaskComplete.suppressFeedback,
            },
          } as any);
        } catch {
          // PubSub may be closed — fall through.
        }
      }

      return nextState;
    },
  });
}
