import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import {
  executeScoreRun,
  extractScoreRunTarget,
  getScoreRunId,
  SCORE_RUN_WORKFLOW_ID,
} from '../evals/scoreRun/executeScoreRun';
import type { ScoreRunInput } from '../evals/scoreRun/executeScoreRun';
import type { ScoringHookInput } from '../evals/types';
import { isScorerHookForMastra } from '../hooks/scorer-owner';
import type { Mastra } from '../mastra';

export { validateAndSaveScore } from '../evals/scoreRun/executeScoreRun';

export function createOnScorerHook(mastra: Mastra) {
  return async (hookData: ScoringHookInput) => {
    if (!isScorerHookForMastra(hookData, mastra)) {
      return;
    }

    const storage = mastra.getStorage();

    if (!storage) {
      mastra.getLogger()?.warn('Storage not found, skipping score validation and saving');
      return;
    }

    const entityId = hookData.entity.id as string;
    const entityType = hookData.entityType;
    const scorerId = hookData.scorer.id as string;

    if (!scorerId) {
      mastra.getLogger()?.warn('Scorer ID not found, skipping score validation and saving');
      return;
    }

    // Extract the serializable target span identity up front — the observability
    // context (tracing/tracingContext/loggerVNext/metrics) does not survive
    // serialization into a workflow run input.
    const target = extractScoreRunTarget(hookData);
    const {
      tracingContext: _tracingContext,
      tracing: _tracing,
      loggerVNext: _loggerVNext,
      metrics: _metrics,
      ...serializableHookData
    } = hookData as ScoringHookInput & {
      tracingContext?: unknown;
      tracing?: unknown;
      loggerVNext?: unknown;
      metrics?: unknown;
    };
    const input: ScoreRunInput = { hookData: serializableHookData as ScoringHookInput, ...target };

    // Durable path: run the scorer inside the internal `__score-run` workflow.
    // A `pending` intent row is persisted before the scorer executes, and the
    // terminal status (success/failed + error) is queryable per (scorer, span).
    let workflow;
    try {
      workflow = mastra.__getInternalWorkflow(SCORE_RUN_WORKFLOW_ID);
    } catch {
      // Workflow not registered (tests, custom hosts) — fall back below.
    }

    if (workflow) {
      try {
        // Deterministic runId: duplicate dispatches of the same (scorer, span)
        // upsert the same intent row instead of creating new runs.
        const runId = getScoreRunId({ scorerId, hookData, traceId: target.traceId, spanId: target.spanId });
        const run = await workflow.createRun({ runId });
        // Not awaited: dispatch stays fire-and-forget; the pending intent row
        // written by createRun records the orphan if start never completes.
        void run.start({ inputData: input }).catch((error: unknown) => {
          mastra
            .getLogger()
            ?.trackException(toScorerHookError(error, { scorerId, entityId, entityType: entityType as string }));
        });
        return;
      } catch (error) {
        mastra
          .getLogger()
          ?.trackException(toScorerHookError(error, { scorerId, entityId, entityType: entityType as string }));
        return;
      }
    }

    // Fallback: direct execution with legacy semantics (no durable run record).
    mastra
      .getLogger()
      ?.debug?.(`Internal workflow ${SCORE_RUN_WORKFLOW_ID} not registered, running scorer ${scorerId} directly`);
    try {
      await executeScoreRun({ mastra, input });
    } catch (error) {
      mastra
        .getLogger()
        ?.trackException(toScorerHookError(error, { scorerId, entityId, entityType: entityType as string }));
    }
  };
}

function toScorerHookError(
  error: unknown,
  details: { scorerId: string; entityId: string; entityType: string },
): MastraError {
  return new MastraError(
    {
      id: 'MASTRA_SCORER_FAILED_TO_RUN_HOOK',
      domain: ErrorDomain.SCORER,
      category: ErrorCategory.USER,
      details,
    },
    error,
  );
}
