import { generateId } from '@internal/ai-sdk-v5';
import type { ToolSet } from '@internal/ai-sdk-v5';
import {
  createGoalScorer,
  GOAL_SCORE_WAITING,
  GOAL_SCORER_ID,
  readObjective,
  resolveEffectiveGoalSettings,
  resolveGoalStore,
  writeObjective,
} from '../../../agent/goal';
import type { ResolvedGoalStore } from '../../../agent/goal';
import type { ToolsInput } from '../../../agent/types';
import type { MastraScorer } from '../../../evals';
import { resolveModelConfig } from '../../../llm';
import type { MastraLanguageModel } from '../../../llm/model/shared.types';
import { createProcessorSendSignal } from '../../../processors/send-signal';
import { RequestContext } from '../../../request-context';
import type { GoalObjectiveRecord } from '../../../storage/domains/thread-state/base';
import { safeEnqueue } from '../../../stream/base';
import type { ChunkType, GoalEvaluationActivity } from '../../../stream/types';
import { ChunkFrom } from '../../../stream/types';
import { createStep } from '../../../workflows/workflow';
import { runStreamCompletionScorers } from '../../network/validation';
import type { StreamCompletionContext } from '../../network/validation';
import type { OuterLLMRun } from '../../types';
import { llmIterationOutputSchema } from '../schema';

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
 * In-loop goal step. Mirrors `is-task-complete-step.ts` but is driven by a
 * durable objective in the `threadState` `'goal'` slot rather than a per-call
 * scorer. Gating is identical (skip background / mid-tool-loop / WM-only
 * iterations), with the additional rule: if no judge model resolves (neither the
 * objective record nor the agent's `goal.judge`), the step is a complete no-op.
 */
export function createGoalStep<Tools extends ToolSet = ToolSet, OUTPUT = undefined>(
  params: OuterLLMRun<Tools, OUTPUT>,
) {
  const { goal, messageList, requestContext, mastra, controller, runId, _internal, agentId, agentName, outputWriter } =
    params;

  return createStep({
    id: 'goalStep',
    inputSchema: llmIterationOutputSchema,
    outputSchema: llmIterationOutputSchema,
    execute: async ({ inputData }) => {
      if (inputData.stepResult?.reason === 'error') return inputData;

      // No goal configured on the agent → nothing to do.
      if (!goal) return inputData;

      // Same gating as isTaskComplete: skip background results, mid-tool-loop
      // continuations, and working-memory-only iterations.
      if (inputData.backgroundTaskPending || inputData.stepResult?.isContinued) {
        return inputData;
      }
      const iterationToolCalls = (inputData.output.toolCalls || []) as Array<{ toolName: string }>;
      if (iterationToolCalls.length > 0 && iterationToolCalls.every(tc => isWorkingMemoryTool(tc.toolName))) {
        return inputData;
      }

      const threadId = _internal?.threadId;
      const store = (await resolveGoalStore(mastra as any)) as ResolvedGoalStore | undefined;
      const record = await readObjective(store, threadId);

      // No active objective → no gating, no chunk.
      if (!record || record.status !== 'active' || !store || !threadId) {
        return inputData;
      }

      const effective = resolveEffectiveGoalSettings(record, {
        judgeModelId: typeof goal.judge === 'string' ? goal.judge : undefined,
        maxRuns: goal.maxRuns,
        prompt: goal.prompt,
        maxSteps: goal.maxSteps,
      });

      // Defensive budget guard. Normally an objective that exhausts its budget is
      // parked as `paused` (below), and the `status !== 'active'` gate above stops
      // it re-entering. This guard only matters if an `active` record somehow
      // re-enters already at/over budget (e.g. maxRuns was lowered below the
      // current runsUsed): never burn another judge call or push runsUsed past
      // the budget — stop the loop and emit a terminal goal chunk without scoring.
      if (record.runsUsed >= effective.maxRuns) {
        if (inputData.stepResult) {
          inputData.stepResult.isContinued = false;
        }
        safeEnqueue(controller, {
          type: 'goal',
          runId,
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
        } as ChunkType<OUTPUT>);
        return inputData;
      }

      // Determine the judge model config. A non-string agent `goal.judge` (a
      // resolved model or a model-resolver function) is the consumer's own
      // resolver and takes precedence: it knows how to inject provider
      // credentials. Otherwise use the effective `judgeModelId` string (record
      // override → agent config). A judge model is the activation switch: if none
      // is configured, the goal step does nothing.
      const nonStringAgentJudge = goal.judge && typeof goal.judge !== 'string' ? goal.judge : undefined;

      // A model-resolver function is the consumer's own resolver: run it first so
      // it can inject provider credentials. It may return `undefined` (e.g. no
      // judge configured) → no-op.
      let judgeModelConfig: unknown = nonStringAgentJudge ?? effective.judgeModelId;
      if (typeof judgeModelConfig === 'function') {
        judgeModelConfig =
          (await (judgeModelConfig as (args: any) => unknown)({ requestContext, mastra })) ?? effective.judgeModelId;
      }
      if (!judgeModelConfig) {
        return inputData;
      }

      // Evaluate the goal. EVERYTHING from here — resolving the judge model,
      // resolving `goal.tools`, building the scorer, and running it — can throw
      // (e.g. a gateway returning "Bad Request", a credential/tools resolver
      // failing). A throw here must NOT escape the step: if it did, the loop
      // would have already produced the turn's model output but never get the
      // chance to set `isContinued = false`, so it would re-run the model and
      // re-hit the failing judge every iteration — an effective infinite loop.
      // Catch any failure and convert it into the same errored scorer result the
      // in-`scorer.run` path produces, so the single judge-failure → paused path
      // below handles it uniformly regardless of where the failure originated.
      let result: Awaited<ReturnType<typeof runStreamCompletionScorers>>;
      try {
        const emitJudgeActivity = (activity: GoalEvaluationActivity, args?: unknown) => {
          const name =
            activity.type === 'reason' ? activity.name : formatJudgeActivityName(activity.name ?? activity.message);
          const message =
            activity.type === 'reason'
              ? activity.message
              : formatJudgeActivityMessage(activity.name ?? activity.message, args);
          if (!message) return;
          safeEnqueue(controller, {
            type: 'goal',
            runId,
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
          } as ChunkType<OUTPUT>);
        };
        const observeJudgeStream = (stream: { fullStream?: AsyncIterable<ChunkType> }) => {
          if (!stream.fullStream) return;
          void (async () => {
            let streamedText = '';
            let lastReason = '';
            for await (const chunk of stream.fullStream!) {
              if (chunk.type === 'text-delta') {
                streamedText += chunk.payload.text;
                const reason = extractPartialReasonFromStructuredText(streamedText);
                if (reason && reason !== lastReason) {
                  lastReason = reason;
                  emitJudgeActivity({ type: 'reason', message: reason });
                }
              } else if (chunk.type === 'tool-call') {
                emitJudgeActivity(
                  { type: 'tool-call', name: chunk.payload.toolName, message: chunk.payload.toolName },
                  chunk.payload.args,
                );
              }
              // tool-result is intentionally skipped — the tool-call already
              // communicates what the judge is doing; the result would only
              // produce a duplicate activity line in the TUI.
            }
          })();
        };

        // Resolve the scorer: a custom `goal.scorer` (instance or registered id),
        // else a default goal scorer built with the resolved judge model + prompt.
        // The judge model is only resolved to a concrete model when the default
        // scorer needs it — a custom scorer brings its own judging, so we avoid
        // resolving (and potentially failing on) the judge model in that case.
        let scorer: MastraScorer<any, any, any, any> | undefined;
        if (goal.scorer) {
          scorer =
            typeof goal.scorer === 'string'
              ? (mastra?.getScorer?.(goal.scorer as any) as MastraScorer<any, any, any, any> | undefined)
              : goal.scorer;
        }
        if (!scorer) {
          // Resolve a bare model id (string) through the model router/gateways so
          // provider credentials are injected; a model object passes through.
          const judgeModel = (
            typeof judgeModelConfig === 'string'
              ? await resolveModelConfig(judgeModelConfig, requestContext, mastra)
              : judgeModelConfig
          ) as MastraLanguageModel;
          // Resolve optional read-only verification tools for the default judge.
          // Like `goal.judge`, `goal.tools` may be a static toolset or a resolver
          // function — use the function form when the tools depend on per-request
          // state (e.g. the active workspace). Only resolved for the default scorer;
          // a custom scorer brings its own judging.
          const goalTools: ToolsInput | undefined =
            typeof goal.tools === 'function'
              ? ((await (goal.tools as (args: any) => unknown)({ requestContext, mastra })) as ToolsInput | undefined)
              : goal.tools;
          const goalId = record.id ?? `${threadId}:${record.startedAt}`;
          const judgeRequestContext = requestContext ? new RequestContext(requestContext.entries()) : undefined;
          scorer = createGoalScorer({
            mastra,
            judgeModel,
            prompt: effective.prompt,
            tools: goalTools,
            requestContext: judgeRequestContext,
            onStream: observeJudgeStream,
            ...(effective.maxSteps ? { maxSteps: effective.maxSteps } : {}),
            ...(_internal?.memory
              ? {
                  memory: _internal.memory,
                  defaultMemoryOptions: {
                    thread: {
                      id: `${threadId ?? 'no-thread'}-${goalId}`,
                      title: `Goal judge: ${record.objective.slice(0, 80)}`,
                      metadata: {
                        forkedSubagent: true,
                        goalJudge: true,
                        parentThreadId: threadId,
                        goalId,
                      },
                    },
                    ...(_internal.resourceId ? { resource: _internal.resourceId } : {}),
                  },
                }
              : {}),
          });
        }

        // Build the scorer context: the objective is the task being judged.
        const toolCalls = (inputData.output.toolCalls || []) as Array<{ toolName: string; args?: unknown }>;
        const toolResults = (inputData.output.toolResults || []) as Array<{ toolName: string; result?: unknown }>;
        const goalContext: StreamCompletionContext = {
          iteration: record.runsUsed + 1,
          maxIterations: effective.maxRuns,
          originalTask: record.objective,
          currentText: inputData.output.text || '',
          toolCalls: toolCalls.map(tc => ({ name: tc.toolName, args: (tc.args || {}) as Record<string, unknown> })),
          messages: messageList.get.all.db(),
          toolResults: toolResults.map(tr => ({ name: tr.toolName, result: tr.result as Record<string, unknown> })),
          agentId: agentId || '',
          agentName: agentName || '',
          runId,
          threadId,
          resourceId: _internal?.resourceId,
          customContext: requestContext ? Object.fromEntries(requestContext.entries()) : undefined,
        };

        // Emit a pending chunk so consumers (the TUI judge display) can show a
        // loading indicator while the scorer runs.
        safeEnqueue(controller, {
          type: 'goal',
          runId,
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
        } as ChunkType<OUTPUT>);

        result = await runStreamCompletionScorers([scorer], goalContext, { strategy: 'all' });
      } catch (error: any) {
        // Synthesize the same shape runStreamCompletionScorers returns for a
        // thrown scorer (score 0, errored: true) so the judge-failure path below
        // pauses the goal instead of letting the throw escape and re-loop.
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

      // The default goal scorer encodes a tri-state decision in the score: 1 =
      // done, `GOAL_SCORE_WAITING` = the goal explicitly asked to stop and wait
      // for the user, 0 = keep working. `result.complete` already covers the
      // done case (score === 1). Detect the waiting score on the goal scorer so
      // we can stop the auto-loop (isContinued = false) without pausing the
      // record — the goal stays active so the next turn is still judged.
      // Custom scorers that never emit this score simply never trigger the
      // waiting path.
      // A scorer that *threw* (e.g. the judge model errored) reports score 0,
      // which is otherwise indistinguishable from a legitimate "keep working"
      // result — so without this the loop would silently iterate against a
      // broken judge until the budget is exhausted. Detect the explicit `errored`
      // flag and treat it as a dedicated failure: pause the objective with the
      // error reason so the user can fix the judge and `/goal resume`. This takes
      // precedence over done/waiting/continue: a judge that failed cannot have
      // validly decided the goal is complete.
      const erroredScorer = result.scorers.find(s => s.errored);
      const judgeFailed = !!erroredScorer;
      // Only the built-in goal scorer uses `GOAL_SCORE_WAITING` as a sentinel;
      // attribute it by scorer id so a custom `goal.scorer` that legitimately
      // returns 0.5 is not misread as an explicit "waiting" checkpoint.
      const waiting =
        !judgeFailed &&
        !result.complete &&
        result.scorers.some(s => s.scorerId === GOAL_SCORER_ID && s.score === GOAL_SCORE_WAITING);

      // Increment runs and update status. Precedence: judge failure → paused;
      // complete → done; budget exhausted → paused. A "waiting" decision does
      // NOT change the persisted status — the record stays `active` so the next
      // agent turn is still judged; only `isContinued` is set to false (below)
      // to stop the auto-loop and give the user a chance to provide input.
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
        // Budget exhausted without reaching the goal: park it (visibly) instead
        // of leaving it `active` but stuck. Raising maxRuns + setting status
        // back to `active` (updateObjectiveOptions) resumes evaluation.
        status = 'paused';
        pausedReason = `Ran out of evaluation budget (${effective.maxRuns} runs) before reaching the goal — raise maxRuns to resume.`;
      }

      const updated: GoalObjectiveRecord = {
        ...record,
        runsUsed,
        status,
        // Only persist a pause reason while parked; clear it otherwise so a
        // resumed/continuing objective does not carry a stale reason.
        pausedReason: status === 'paused' ? pausedReason : undefined,
        updatedAt: Date.now(),
      };
      await writeObjective(store, threadId, updated, requestContext);

      // The goal gate makes the final continuation decision: complete, parked,
      // waiting for user input, or budget reached → stop; otherwise force
      // another iteration toward the goal.
      const shouldContinue = !result.complete && !waiting && !judgeFailed && !maxRunsReached;
      if (inputData.stepResult) {
        inputData.stepResult.isContinued = shouldContinue;
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
        // Parked goals should render the pause cause, not the last continue
        // reason that happened to exhaust the budget.
        reason: status === 'paused' ? pausedReason : result.completionReason,
        duration: result.totalDuration,
        timedOut: result.timedOut,
        maxRunsReached,
        suppressFeedback,
        shouldContinue,
      };

      let currentMessageId = inputData.messageId;
      const sendSignal = createProcessorSendSignal({
        messageList,
        writer: outputWriter
          ? {
              custom: async (data, options) => {
                await outputWriter(data as ChunkType, { ...options, messageId: currentMessageId });
              },
            }
          : undefined,
        rotateResponseMessageId: () => {
          currentMessageId = _internal?.generateId?.() ?? generateId();
          inputData.messageId = currentMessageId;
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

      safeEnqueue(controller, {
        type: 'goal',
        runId,
        from: ChunkFrom.AGENT,
        payload: goalEvaluationPayload,
      } as ChunkType<OUTPUT>);

      return inputData;
    },
  });
}
