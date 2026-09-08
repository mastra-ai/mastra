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
import type { MessageList } from '../../../agent/message-list';
import type { GoalConfig, ToolsInput } from '../../../agent/types';
import type { MastraScorer } from '../../../evals';
import { resolveModelConfig } from '../../../llm';
import type { MastraLanguageModel } from '../../../llm/model/shared.types';
import type { Mastra } from '../../../mastra';
import type { MastraMemory } from '../../../memory';
import type { ProcessorStreamWriterOptions } from '../../../processors';
import { createProcessorSendSignal } from '../../../processors/send-signal';
import { RequestContext } from '../../../request-context';
import type { GoalObjectiveRecord } from '../../../storage/domains/thread-state/base';
import type { ChunkType, GoalEvaluationActivity } from '../../../stream/types';
import { ChunkFrom } from '../../../stream/types';
import { runStreamCompletionScorers } from '../../network/validation';
import type { StreamCompletionContext } from '../../network/validation';

/** Outcome of a goal evaluation, projected back onto engine state by the glue. */
export type GoalOutcome =
  /** A skip-guard fired (or no judge resolves) — the iteration is untouched. */
  | { evaluated: false }
  /**
   * An `active` record re-entered already at/over budget — the loop must stop
   * without burning a judge call. No signal was sent and no message rotation
   * happened, so callers only need to flip `isContinued`.
   */
  | { evaluated: true; kind: 'budget-guard'; shouldContinue: false }
  /**
   * The judge ran (or failed and was converted into a paused verdict). The
   * transcript gained the goal feedback signal and the response message id may
   * have rotated — callers must project `shouldContinue` + `messageId` back
   * onto their state (and re-serialize the message list on the durable side).
   */
  | { evaluated: true; kind: 'judged'; shouldContinue: boolean; messageId: string };

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
 * Shared goal-step behavior (PHASE3 Step 3): judge a settled iteration against
 * the thread's active durable objective. Handles the skip-guards, the budget
 * guard, judge/scorer resolution, judge activity streaming, the tri-state
 * verdict (done / waiting / keep working, with judge failure → paused), record
 * persistence, feedback signal injection, and `goal` chunk emission. Callers
 * own how the verdict projects back onto their state shape (flipping
 * `isContinued`, updating `messageId`, serializing the message list).
 *
 * Grading is skipped when: the iteration errored (`reason === 'error'`); no
 * goal is configured; a background task result was just injected or the LLM is
 * still mid-tool-loop; the iteration only updated working memory; there is no
 * active objective record; or no judge model resolves (the judge is the
 * activation switch).
 *
 * Adjudicated drift (previously engine-specific):
 * - A judge model-resolver returning `undefined` now falls back to the
 *   effective `judgeModelId` (record override → agent config) on both engines
 *   (previously main-only).
 * - The default judge scorer always receives an isolated copy of the request
 *   context so judge-side mutations can't leak into the parent run
 *   (previously main-only).
 * - Judge activity streaming is wrapped so a scorer stream failure can't turn
 *   into an unhandled rejection (previously durable-only).
 * - Chunk emission is best-effort via the injected transport on both engines.
 */
export async function evaluateGoal(deps: {
  goal: GoalConfig | undefined;
  stepReason: string | undefined;
  backgroundTaskPending: boolean | undefined;
  /** Truthy while the LLM is mid-tool-loop — the goal only judges settled turns. */
  isContinued: boolean | undefined;
  toolCalls: Array<{ toolName?: string; args?: unknown }>;
  toolResults: Array<{ toolName?: string; result?: unknown }>;
  currentText: string;
  runId: string;
  agentId?: string;
  agentName?: string;
  threadId?: string;
  resourceId?: string;
  customContext?: Record<string, unknown>;
  mastra?: Mastra;
  /** Parent request context — passed as-is to `judge`/`tools` resolvers, copied for the judge scorer. */
  requestContext?: RequestContext;
  /** Main-only: fork the default judge into its own memory thread. */
  memory?: MastraMemory;
  /**
   * Live (main) or rehydrated-from-state (durable) transcript; the feedback
   * signal is appended here. Lazy so the durable engine only deserializes when
   * the iteration is actually judged (all skip-guards run first). Must be
   * memoized by the caller: it is resolved once for the scorer context and
   * reused for signal injection.
   */
  messageList: () => MessageList;
  /** Current response message id — rotated via `rotateMessageId` when the signal lands. */
  messageId: string;
  rotateMessageId: (current: string) => string;
  /** Engine transport for the injected feedback signal's data part (optional, like the underlying writers). */
  writeSignal?: (data: unknown, options: ProcessorStreamWriterOptions & { messageId: string }) => Promise<void>;
  emitChunk: (chunk: unknown) => void | Promise<void>;
}): Promise<GoalOutcome> {
  const { goal, mastra, requestContext } = deps;

  if (deps.stepReason === 'error') return { evaluated: false };

  // No goal configured on the agent → nothing to do.
  if (!goal) return { evaluated: false };

  // Same gating as isTaskComplete: skip background results, mid-tool-loop
  // continuations, and working-memory-only iterations.
  if (deps.backgroundTaskPending || deps.isContinued) {
    return { evaluated: false };
  }
  if (deps.toolCalls.length > 0 && deps.toolCalls.every(tc => isWorkingMemoryTool(tc.toolName ?? ''))) {
    return { evaluated: false };
  }

  const threadId = deps.threadId;
  const store = (await resolveGoalStore(mastra as any)) as ResolvedGoalStore | undefined;
  const record = await readObjective(store, threadId);

  // No active objective → no gating, no chunk.
  if (!record || record.status !== 'active' || !store || !threadId) {
    return { evaluated: false };
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
  // the budget — stop the loop and emit a terminal goal chunk.
  if (record.runsUsed >= effective.maxRuns) {
    try {
      await Promise.resolve(
        deps.emitChunk({
          type: 'goal',
          runId: deps.runId,
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
        }),
      );
    } catch {
      // Best-effort — the transport may be closed.
    }
    return { evaluated: true, kind: 'budget-guard', shouldContinue: false };
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
  // judge configured) → fall back to the effective id, then no-op.
  let judgeModelConfig: unknown = nonStringAgentJudge ?? effective.judgeModelId;
  if (typeof judgeModelConfig === 'function') {
    judgeModelConfig =
      (await (judgeModelConfig as (args: any) => unknown)({ requestContext, mastra })) ?? effective.judgeModelId;
  }
  if (!judgeModelConfig) {
    return { evaluated: false };
  }

  // Evaluate the goal. EVERYTHING from here — resolving the judge model,
  // resolving `goal.tools`, building the scorer, and running it — can throw
  // (e.g. a gateway returning "Bad Request", a credential/tools resolver
  // failing). A throw here must NOT escape: if it did, the loop would have
  // already produced the turn's model output but never get the chance to set
  // `isContinued = false`, so it would re-run the model and re-hit the failing
  // judge every iteration — an effective infinite loop. Catch any failure and
  // convert it into the same errored scorer result the in-`scorer.run` path
  // produces, so the single judge-failure → paused path below handles it
  // uniformly regardless of where the failure originated.
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
      void Promise.resolve(
        deps.emitChunk({
          type: 'goal',
          runId: deps.runId,
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
        }),
      ).catch(() => {});
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
            // tool-result is intentionally skipped — the tool-call already
            // communicates what the judge is doing; the result would only
            // produce a duplicate activity line in the TUI.
          }
        } catch {
          // The scorer owns structured-output fallback and error reporting.
          // Judge activity streaming is best-effort UI feedback and must not
          // turn a recoverable scorer stream failure into an unhandled rejection.
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
          ? await resolveModelConfig(judgeModelConfig, requestContext as RequestContext, mastra)
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
        ...(deps.memory
          ? {
              memory: deps.memory,
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
                ...(deps.resourceId ? { resource: deps.resourceId } : {}),
              },
            }
          : {}),
      });
    }

    // Build the scorer context: the objective is the task being judged.
    const goalContext: StreamCompletionContext = {
      iteration: record.runsUsed + 1,
      maxIterations: effective.maxRuns,
      originalTask: record.objective,
      currentText: deps.currentText || '',
      toolCalls: deps.toolCalls.map(tc => ({
        name: tc.toolName || '',
        args: (tc.args || {}) as Record<string, unknown>,
      })),
      messages: deps.messageList().get.all.db(),
      toolResults: deps.toolResults.map(tr => ({
        name: tr.toolName || '',
        result: (tr.result as Record<string, unknown>) ?? {},
      })),
      agentId: deps.agentId || '',
      agentName: deps.agentName || '',
      runId: deps.runId,
      threadId,
      resourceId: deps.resourceId,
      customContext: deps.customContext,
    };

    // Emit a pending chunk so consumers (the TUI judge display) can show a
    // loading indicator while the scorer runs.
    void Promise.resolve(
      deps.emitChunk({
        type: 'goal',
        runId: deps.runId,
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
      }),
    ).catch(() => {});

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

  // Inject feedback into the transcript via signal so the next LLM call sees it.
  let currentMessageId = deps.messageId;
  const sendSignal = createProcessorSendSignal({
    messageList: deps.messageList(),
    writer: deps.writeSignal
      ? {
          custom: async (data, options) => {
            await deps.writeSignal!(data, { ...options, messageId: currentMessageId });
          },
        }
      : undefined,
    rotateResponseMessageId: () => {
      currentMessageId = deps.rotateMessageId(currentMessageId);
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

  // Emit the final goal chunk for external observers.
  try {
    await Promise.resolve(
      deps.emitChunk({
        type: 'goal',
        runId: deps.runId,
        from: ChunkFrom.AGENT,
        payload: goalEvaluationPayload,
      }),
    );
  } catch {
    // Best-effort — the transport may be closed.
  }

  return { evaluated: true, kind: 'judged', shouldContinue, messageId: currentMessageId };
}
