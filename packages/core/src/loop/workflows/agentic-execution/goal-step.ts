import type { ToolSet } from '@internal/ai-sdk-v5';
import type { MastraDBMessage } from '../../../agent';
import {
  createGoalScorer,
  readObjective,
  resolveEffectiveGoalSettings,
  resolveGoalStore,
  writeObjective,
} from '../../../agent/goal';
import type { ResolvedGoalStore } from '../../../agent/goal';
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

      // Budget already exhausted on a prior run: an objective stays `active` when
      // it stops at the run budget (so raising `maxRuns` can resume it), but it
      // must not re-evaluate. Without this guard a subsequent run on the same
      // thread would burn another judge call and push `runsUsed` past the budget
      // every time. Stop the loop and emit a terminal goal chunk without scoring.
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
        scorer = createGoalScorer({ judgeModel, prompt: effective.prompt });
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

      const result = await runStreamCompletionScorers([scorer], goalContext, { strategy: 'all' });

      // Increment runs and update status. Complete → done. Budget exhausted →
      // stop but stay active (resumable). Otherwise keep going.
      const runsUsed = record.runsUsed + 1;
      const maxRunsReached = runsUsed >= effective.maxRuns;
      let status: GoalObjectiveRecord['status'] = record.status;
      if (result.complete) {
        status = 'done';
      }

      const updated: GoalObjectiveRecord = { ...record, runsUsed, status, updatedAt: Date.now() };
      await writeObjective(store, threadId, updated, requestContext);

      // The goal gate makes the final continuation decision: complete or budget
      // reached → stop; otherwise force another iteration toward the goal.
      if (inputData.stepResult) {
        inputData.stepResult.isContinued = !result.complete && !maxRunsReached;
      }

      const suppressFeedback = false;
      const feedback = formatStreamCompletionFeedback(result, maxRunsReached);
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
          results: result.scorers,
          reason: result.completionReason,
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
