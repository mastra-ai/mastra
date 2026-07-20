import { z } from 'zod';
import type { MastraScorer } from '../../../../evals';
import type { PubSub } from '../../../../events/pubsub';
import { resolveModelConfig } from '../../../../llm';
import type { MastraLanguageModel } from '../../../../llm/model/shared.types';
import { runStreamCompletionScorers } from '../../../../loop/network/validation';
import type { StreamCompletionContext } from '../../../../loop/network/validation';
import { createProcessorSendSignal } from '../../../../processors/send-signal';
import { RequestContext } from '../../../../request-context';
import type { GoalObjectiveRecord } from '../../../../storage/domains/thread-state/base';
import type { ChunkType, GoalEvaluationActivity } from '../../../../stream/types';
import { ChunkFrom } from '../../../../stream/types';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import { createStep } from '../../../../workflows/workflow';
import type { ResolvedGoalStore } from '../../../goal';
import {
  createGoalScorer,
  GOAL_SCORE_WAITING,
  GOAL_SCORER_ID,
  readObjective,
  resolveEffectiveGoalSettings,
  resolveGoalStore,
  writeObjective,
} from '../../../goal';
import { MessageList } from '../../../message-list';
import type { ToolsInput } from '../../../types';
import { globalRunRegistry } from '../../run-registry';
import { emitChunkEvent } from '../../stream-adapter';

function isWorkingMemoryTool(name: string): boolean {
  return name === 'updateWorkingMemory' || name === 'setWorkingMemory' || name === 'update-working-memory';
}

function formatJudgeActivityName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  if (name === 'view') return 'read';
  if (name === 'search_content') return 'search';
  if (name === 'find_files') return 'find files';
  if (name === 'file_stat') return 'stat';
  if (name === 'lsp_inspect') return 'inspect';
  return name;
}

function getStringArg(args: unknown, key: string): string | undefined {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return undefined;
  const value = (args as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function truncateActivityDetail(value: string): string {
  return value.length > 80 ? `${value.slice(0, 77)}...` : value;
}

function extractPartialReasonFromStructuredText(text: string): string | undefined {
  const match = text.match(/"reason"\s*:\s*"((?:\\.|[^"\\])*)/);
  const partialReason = match?.[1];
  if (!partialReason) return undefined;
  return partialReason.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim();
}

function formatJudgeActivityMessage(name: string | undefined, args: unknown): string | undefined {
  const label = formatJudgeActivityName(name);
  if (!label) return undefined;

  if (name === 'view' || name === 'file_stat') {
    const path = getStringArg(args, 'path');
    return path ? `${label} ${truncateActivityDetail(path)}` : label;
  }

  if (name === 'search_content') {
    const pattern = getStringArg(args, 'pattern');
    const path = getStringArg(args, 'path');
    const detail = [pattern, path].filter(Boolean).join(' in ');
    return detail ? `${label} ${truncateActivityDetail(detail)}` : label;
  }

  if (name === 'find_files') {
    const path = getStringArg(args, 'path');
    const pattern = getStringArg(args, 'pattern');
    const detail = [path, pattern].filter(Boolean).join(' ');
    return detail ? `${label} ${truncateActivityDetail(detail)}` : label;
  }

  if (name === 'lsp_inspect') {
    const path = getStringArg(args, 'path');
    const line =
      !args || typeof args !== 'object' || Array.isArray(args) ? undefined : (args as Record<string, unknown>).line;
    const detail = path ? `${path}${typeof line === 'number' ? `:${line}` : ''}` : undefined;
    return detail ? `${label} ${truncateActivityDetail(detail)}` : label;
  }

  return label;
}

/**
 * Create the durable goal step.
 *
 * Mirrors the non-durable `createGoalStep` contract:
 *  - Runs after `isTaskCompleteStep` in the `singleIterationWorkflow`.
 *  - Only evaluates iterations where the LLM has signaled it is done
 *    (`lastStepResult.isContinued === false`) so we don't interrupt mid-loop
 *    tool execution.
 *  - Skips background-pending, working-memory-only iterations (same
 *    heuristic as the non-durable step).
 *  - Pulls the `goal` config from the in-process run registry (closures
 *    like `judge`, `scorer`, `tools` can't survive the wire). Cross-process
 *    engines without this slot skip goal evaluation.
 *  - Reads/writes the `GoalObjectiveRecord` from/to thread state storage.
 *  - Emits `goal` chunks via pubsub so external observers see the verdict.
 *  - Injects system-reminder + goal feedback into `messageList` via
 *    `createProcessorSendSignal` so the next LLM iteration can see it.
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
      if (state.lastStepResult?.reason === 'error') return state;

      const pubsub = (params as any)[PUBSUB_SYMBOL] as PubSub | undefined;
      const initData = getInitData() as {
        agentId?: string;
        agentName?: string;
        state?: { threadId?: string; resourceId?: string };
        requestContextEntries?: Record<string, unknown>;
      };

      const registryEntry = globalRunRegistry.get(state.runId);
      // This is shared agent configuration (judge, scorer, tools, defaults), not per-goal state.
      // The objective and its progress are isolated by thread and loaded from storage below.
      let goalConfig = registryEntry?.goal;
      if (!goalConfig && initData.agentId) {
        goalConfig = (mastra as any)?.getAgentById?.(initData.agentId)?.__getGoalConfig?.();
      }

      // No goal mode configured → nothing to do.
      if (!goalConfig) return state;

      // Same gating as isTaskComplete: skip background results, mid-tool-loop
      // continuations, and working-memory-only iterations.
      if (state.backgroundTaskPending || state.lastStepResult?.isContinued) {
        return state;
      }

      const lastStep = state.accumulatedSteps[state.accumulatedSteps.length - 1];
      const iterationToolCalls = (lastStep?.toolCalls ?? []) as Array<{
        toolName?: string;
        args?: unknown;
      }>;
      if (iterationToolCalls.length > 0 && iterationToolCalls.every(tc => isWorkingMemoryTool(tc.toolName ?? ''))) {
        return state;
      }

      const threadId = initData.state?.threadId;

      // Reconstruct requestContext from serialized entries for resolvers.
      const requestContext = new RequestContext();
      if (initData.requestContextEntries) {
        for (const [key, value] of Object.entries(initData.requestContextEntries)) {
          requestContext.set(key, value);
        }
      }

      const store = (await resolveGoalStore(mastra as any)) as ResolvedGoalStore | undefined;
      const record = await readObjective(store, threadId);

      // No active objective → no gating, no chunk.
      if (!record || record.status !== 'active' || !store || !threadId) {
        return state;
      }

      const effective = resolveEffectiveGoalSettings(record, {
        judgeModelId: typeof goalConfig.judge === 'string' ? goalConfig.judge : undefined,
        maxRuns: goalConfig.maxRuns,
        prompt: goalConfig.prompt,
        maxSteps: goalConfig.maxSteps,
      });

      // Defensive budget guard.
      const nextState: typeof state = { ...state };
      if (record.runsUsed >= effective.maxRuns) {
        if (nextState.lastStepResult) {
          nextState.lastStepResult = {
            ...nextState.lastStepResult,
            isContinued: false,
          };
        }
        if (pubsub) {
          try {
            await emitChunkEvent(pubsub, state.runId, {
              type: 'goal',
              runId: state.runId,
              from: ChunkFrom.AGENT,
              payload: {
                objective: record.objective,
                iteration: record.runsUsed,
                maxRuns: effective.maxRuns,
                passed: false,
                status: record.status,
                results: [],
                reason: undefined,
                duration: 0,
                timedOut: false,
                maxRunsReached: true,
                suppressFeedback: false,
                shouldContinue: false,
              },
            } as any);
          } catch {
            // PubSub may be closed — fall through.
          }
        }
        return nextState;
      }

      // Determine the judge model config. A non-string agent `goalConfig.judge` (a
      // resolved model or a model-resolver function) takes precedence.
      const nonStringAgentJudge =
        goalConfig.judge && typeof goalConfig.judge !== 'string' ? goalConfig.judge : undefined;

      let judgeModelConfig: unknown = nonStringAgentJudge ?? effective.judgeModelId;
      if (typeof judgeModelConfig === 'function') {
        judgeModelConfig = await (judgeModelConfig as (args: any) => unknown)({ requestContext, mastra });
      }
      if (!judgeModelConfig) {
        return state;
      }

      // Evaluate the goal. Catch any failure to prevent infinite loops.
      let result: Awaited<ReturnType<typeof runStreamCompletionScorers>>;
      try {
        const emitJudgeActivity = (activity: GoalEvaluationActivity, args?: unknown) => {
          const name =
            activity.type === 'reason' ? activity.name : formatJudgeActivityName(activity.name ?? activity.message);
          const message =
            activity.type === 'reason'
              ? activity.message
              : formatJudgeActivityMessage(activity.name ?? activity.message, args);
          if (!message || !pubsub) return;
          emitChunkEvent(pubsub, state.runId, {
            type: 'goal',
            runId: state.runId,
            from: ChunkFrom.AGENT,
            payload: {
              objective: record.objective,
              iteration: record.runsUsed + 1,
              maxRuns: effective.maxRuns,
              passed: false,
              status: record.status,
              results: [],
              duration: 0,
              timedOut: false,
              maxRunsReached: false,
              suppressFeedback: true,
              pending: true,
              activity: [{ ...activity, name, message }],
            },
          } as any).catch(() => {});
        };

        const observeJudgeStream = (stream: { fullStream?: AsyncIterable<ChunkType> }) => {
          if (!stream.fullStream) return;
          void (async () => {
            try {
              let streamedText = '';
              let lastReason = '';
              for await (const chunk of stream.fullStream!) {
                if (chunk.type === 'text-delta') {
                  streamedText += (chunk as any).payload?.text ?? '';
                  const reason = extractPartialReasonFromStructuredText(streamedText);
                  if (reason && reason !== lastReason) {
                    lastReason = reason;
                    emitJudgeActivity({ type: 'reason', message: reason });
                  }
                } else if (chunk.type === 'tool-call') {
                  emitJudgeActivity(
                    {
                      type: 'tool-call',
                      name: (chunk as any).payload?.toolName,
                      message: (chunk as any).payload?.toolName,
                    },
                    (chunk as any).payload?.args,
                  );
                }
              }
            } catch {
              // The scorer owns structured-output fallback and error reporting.
              // Judge activity streaming is best-effort UI feedback and must not
              // turn a recoverable scorer stream failure into an unhandled rejection.
            }
          })();
        };

        // Resolve the scorer.
        let scorer: MastraScorer<any, any, any, any> | undefined;
        if (goalConfig.scorer) {
          scorer =
            typeof goalConfig.scorer === 'string'
              ? (mastra?.getScorer?.(goalConfig.scorer as any) as MastraScorer<any, any, any, any> | undefined)
              : goalConfig.scorer;
        }
        if (!scorer) {
          const judgeModel = (
            typeof judgeModelConfig === 'string'
              ? await resolveModelConfig(judgeModelConfig, requestContext, mastra)
              : judgeModelConfig
          ) as MastraLanguageModel;

          const goalTools: ToolsInput | undefined =
            typeof goalConfig.tools === 'function'
              ? ((await (goalConfig.tools as (args: any) => unknown)({ requestContext, mastra })) as
                  ToolsInput | undefined)
              : goalConfig.tools;

          scorer = createGoalScorer({
            mastra,
            judgeModel,
            prompt: effective.prompt,
            tools: goalTools,
            requestContext,
            onStream: observeJudgeStream,
            ...(effective.maxSteps ? { maxSteps: effective.maxSteps } : {}),
          });
        }

        // Build scorer context.
        const messageList = new MessageList();
        messageList.deserialize(state.messageListState);

        const toolCalls = (lastStep?.toolCalls ?? []) as Array<{ toolName?: string; args?: unknown }>;
        const toolResults = (lastStep?.toolResults ?? []) as Array<{ toolName?: string; result?: unknown }>;
        const goalContext: StreamCompletionContext = {
          iteration: record.runsUsed + 1,
          maxIterations: effective.maxRuns,
          originalTask: record.objective,
          currentText: lastStep?.text || '',
          toolCalls: toolCalls.map(tc => ({
            name: tc.toolName || '',
            args: (tc.args || {}) as Record<string, unknown>,
          })),
          messages: messageList.get.all.db(),
          toolResults: toolResults.map(tr => ({
            name: tr.toolName || '',
            result: (tr.result as Record<string, unknown>) ?? {},
          })),
          agentId: initData.agentId || '',
          agentName: initData.agentName || '',
          runId: state.runId,
          threadId,
          resourceId: initData.state?.resourceId,
          customContext: initData.requestContextEntries,
        };

        // Emit a pending chunk so consumers can show a loading indicator.
        if (pubsub) {
          emitChunkEvent(pubsub, state.runId, {
            type: 'goal',
            runId: state.runId,
            from: ChunkFrom.AGENT,
            payload: {
              objective: record.objective,
              iteration: record.runsUsed + 1,
              maxRuns: effective.maxRuns,
              passed: false,
              status: record.status,
              results: [],
              duration: 0,
              timedOut: false,
              maxRunsReached: false,
              suppressFeedback: true,
              pending: true,
            },
          } as any).catch(() => {});
        }

        result = await runStreamCompletionScorers([scorer], goalContext, { strategy: 'all' });
      } catch (error: any) {
        const reason = `Goal evaluation failed: ${error?.message ?? String(error)}`;
        result = {
          complete: false,
          completionReason: undefined,
          scorers: [
            {
              score: 0,
              passed: false,
              reason,
              scorerId: GOAL_SCORER_ID,
              scorerName: 'Goal (LLM)',
              duration: 0,
              errored: true,
            },
          ],
          totalDuration: 0,
          timedOut: false,
        };
      }

      // Tri-state decision: done / waiting / keep working / errored.
      const erroredScorer = result.scorers.find(s => s.errored);
      const judgeFailed = !!erroredScorer;
      const waiting =
        !judgeFailed &&
        !result.complete &&
        result.scorers.some(s => s.scorerId === GOAL_SCORER_ID && s.score === GOAL_SCORE_WAITING);

      // Increment runs and update status.
      const runsUsed = record.runsUsed + 1;
      const maxRunsReached = runsUsed >= effective.maxRuns;
      let status: GoalObjectiveRecord['status'] = record.status;
      let pausedReason: string | undefined;
      if (judgeFailed) {
        status = 'paused';
        pausedReason = erroredScorer?.reason ?? 'The goal judge failed to evaluate the objective.';
      } else if (result.complete) {
        status = 'done';
      } else if (maxRunsReached && !waiting) {
        status = 'paused';
        pausedReason = `Ran out of evaluation budget (${effective.maxRuns} runs) before reaching the goal — raise maxRuns to resume.`;
      }

      const updated: GoalObjectiveRecord = {
        ...record,
        runsUsed,
        status,
        pausedReason: status === 'paused' ? pausedReason : undefined,
        updatedAt: Date.now(),
      };
      await writeObjective(store, threadId, updated, requestContext);

      // Continuation decision.
      const shouldContinue = !result.complete && !waiting && !judgeFailed && !maxRunsReached;
      if (nextState.lastStepResult) {
        nextState.lastStepResult = {
          ...nextState.lastStepResult,
          isContinued: shouldContinue,
        };
      }

      const suppressFeedback = false;
      const goalEvaluationPayload = {
        objective: record.objective,
        iteration: runsUsed,
        maxRuns: effective.maxRuns,
        passed: result.complete,
        status,
        pausedReason,
        judgeFailed,
        waitingForUser: waiting,
        results: result.scorers,
        reason: status === 'paused' ? pausedReason : result.completionReason,
        duration: result.totalDuration,
        timedOut: result.timedOut,
        maxRunsReached,
        suppressFeedback,
        shouldContinue,
      };

      // Inject feedback into messageList via signal so the next LLM call sees it.
      const messageList = new MessageList();
      messageList.deserialize(nextState.messageListState);

      let currentMessageId = nextState.messageId;
      const sendSignal = createProcessorSendSignal({
        messageList,
        writer: pubsub
          ? {
              custom: async (data, _options) => {
                await emitChunkEvent(pubsub, state.runId, data as ChunkType);
              },
            }
          : undefined,
        rotateResponseMessageId: () => {
          currentMessageId = mastra?.generateId?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          nextState.messageId = currentMessageId;
          return currentMessageId;
        },
      });

      const feedback = result.completionReason ?? 'The goal is not yet complete.';
      const continuation = shouldContinue
        ? `[Goal attempt ${runsUsed}/${effective.maxRuns}] The goal is not yet complete. Judge feedback: ${feedback}\n\nContinue working toward the goal: ${record.objective}`
        : `${status} (${runsUsed}/${effective.maxRuns})\n${goalEvaluationPayload.reason ?? ''}`;
      await sendSignal({
        type: 'system-reminder',
        contents: continuation,
        attributes: { type: 'goal-judge' },
        metadata: { goalEvaluation: goalEvaluationPayload },
      });

      // Re-serialize messageList after signal injection.
      nextState.messageListState = messageList.serialize();

      // Emit the final goal chunk for external observers.
      if (pubsub) {
        try {
          await emitChunkEvent(pubsub, state.runId, {
            type: 'goal',
            runId: state.runId,
            from: ChunkFrom.AGENT,
            payload: goalEvaluationPayload,
          } as any);
        } catch {
          // PubSub may be closed — fall through.
        }
      }

      return nextState;
    },
  });
}
