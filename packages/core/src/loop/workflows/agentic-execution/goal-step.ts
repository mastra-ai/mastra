import type { ToolSet } from '@internal/ai-sdk-v5';
import type { MastraDBMessage } from '../../../agent';
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
import type { GoalObjectiveRecord } from '../../../storage/domains/thread-state/base';
import type { ChunkType } from '../../../stream/types';
import { ChunkFrom } from '../../../stream/types';
import { createStep } from '../../../workflows/workflow';
import { runStreamCompletionScorers, formatStreamCompletionFeedback } from '../../network/validation';
import type { StreamCompletionContext } from '../../network/validation';
import type { OuterLLMRun } from '../../types';
import { llmIterationOutputSchema } from '../schema';

function isWorkingMemoryTool(name: string): boolean {
  return name === 'updateWorkingMemory' || name === 'setWorkingMemory' || name === 'update-working-memory';
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
  const { goal, messageList, requestContext, mastra, controller, runId, _internal, agentId, agentName } = params;

  return createStep({
    id: 'goalStep',
    inputSchema: llmIterationOutputSchema,
    outputSchema: llmIterationOutputSchema,
    execute: async ({ inputData }) => {
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
        controller.enqueue({
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
        judgeModelConfig = await (judgeModelConfig as (args: any) => unknown)({ requestContext, mastra });
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
          scorer = createGoalScorer({
            judgeModel,
            prompt: effective.prompt,
            tools: goalTools,
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
      // we can park the objective as `paused` (so `/goal resume` can revive it)
      // instead of looping. Custom scorers that never emit this score simply
      // never trigger the waiting path.
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
      if (inputData.stepResult) {
        inputData.stepResult.isContinued = !result.complete && !waiting && !judgeFailed && !maxRunsReached;
      }

      const suppressFeedback = false;
      // The generic formatter renders any non-complete result as "🔄 keep
      // working", which is misleading when the goal is parked. Replace the
      // trailing guidance with a cause-specific note so the transcript reflects
      // that the goal is paused, not iterating.
      let feedback = formatStreamCompletionFeedback(result, maxRunsReached);
      if (judgeFailed) {
        feedback += `\n\n⏸️ Goal paused — the judge failed to evaluate: ${pausedReason}`;
      } else if (waiting) {
        feedback += `\n\n◌ Waiting for the user: ${result.completionReason ?? 'The goal asked to stop and wait for your input.'}`;
      } else if (status === 'paused' && maxRunsReached) {
        feedback += `\n\n⏸️ Goal paused — ${pausedReason}`;
      }
      messageList.add(
        {
          id: mastra?.generateId(),
          createdAt: new Date(),
          type: 'text',
          role: 'assistant',
          content: {
            parts: [{ type: 'text', text: feedback }],
            metadata: {
              mode: 'stream',
              completionResult: { passed: result.complete, suppressFeedback },
            },
            format: 2,
          },
        } as MastraDBMessage,
        'response',
      );

      controller.enqueue({
        type: 'goal',
        runId,
        from: ChunkFrom.AGENT,
        payload: {
          objective: record.objective,
          iteration: runsUsed,
          maxRuns: effective.maxRuns,
          passed: result.complete,
          status,
          pausedReason,
          judgeFailed,
          waitingForUser: waiting,
          results: result.scorers,
          // Prefer the completion reason, but fall back to the pause reason so a
          // parked goal (judge failure or budget) always surfaces a cause to
          // consumers that render `reason` (e.g. the TUI judge display).
          reason: result.completionReason ?? pausedReason,
          duration: result.totalDuration,
          timedOut: result.timedOut,
          maxRunsReached,
          suppressFeedback,
        },
      } as ChunkType<OUTPUT>);

      return inputData;
    },
  });
}
