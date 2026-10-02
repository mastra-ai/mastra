import { createStep } from '@mastra/core/workflows';

import { createLibSqlOperationalStore } from '../../db/libsql-operational-store.js';
import type { OperationalStore } from '../../db/operational-store.js';
import { DomainError } from '../../domain/errors.js';
import type { ContainmentActionType } from '../../schemas/containment.js';
import { canonicalJson } from '../../evidence/canonicalize.js';
import { CorrelationSchema, type Correlation } from '../../evidence/contracts.js';
import { loadDecisionContext, type DecisionContext } from '../../triage/decision-context.js';
import {
  ClassificationStepResultSchema,
  SeverityAnalysisCandidateSchema,
  type ClassificationStepResult,
  type TriageReasonCode,
} from '../../triage/decision-contracts.js';
import { appendTriageTimeline } from '../../triage/decision-timeline.js';
import { buildSeverityDecision } from '../../triage/decision-validation.js';
import { evaluateSeverityPolicy } from '../../triage/policy.js';
import { projectDecisionContext, type ResponsePlannerInvoker } from '../../triage/prompt-safe-decision.js';
import { generateWithOneSchemaRetry } from '../agents/investigator-output.js';
import { invokeResponsePlanner } from '../agents/response-planner.js';
import { RunbookRetrievedSchema } from './retrieve-runbook.js';
import { withinWorkflowBoundary } from '../workflow-trace.js';

export type TriageStepDependencies = Readonly<{
  openStore?: () => OperationalStore;
  planner?: ResponsePlannerInvoker;
  runbookRoot?: string;
  containmentActionTypes?: readonly ContainmentActionType[];
}>;

export function createClassifySeverityStep(dependencies: TriageStepDependencies = {}) {
  return createStep({
    id: 'classify-severity',
    description: 'Applies authoritative runbook policy to integrity-verified evidence.',
    inputSchema: RunbookRetrievedSchema,
    outputSchema: ClassificationStepResultSchema,
    execute: async ({ inputData, getStepResult, abortSignal }) => {
      const store = (dependencies.openStore ?? createLibSqlOperationalStore)();
      try {
        const correlation = CorrelationSchema.parse(getStepResult<Correlation>('correlate-events'));
        let context: DecisionContext;
        try {
          context = await loadDecisionContext(store, inputData, correlation, dependencies);
        } catch (error) {
          return buildTriageStopResult('blocked', correlation.context.incidentId, [
            error instanceof DomainError && error.code === 'CONFLICT' ? 'SCOPE_CHECK_FAILED' : 'INTEGRITY_CHECK_FAILED',
          ]);
        }
        const result = await withinWorkflowBoundary(
          store,
          {
            tenantId: context.correlation.context.tenantId,
            incidentId: context.correlation.context.incidentId,
            workflowRunId: context.correlation.context.workflowRunId,
            correlationId: context.correlation.context.correlationId,
            boundary: 'severity.policy',
            stepId: 'classify-severity',
            provider: 'response-planner',
          },
          () => classifySeverity(context, dependencies.planner, abortSignal),
        );
        // The classification step, rather than a caller observing its result,
        // owns the operational severity projection.  This keeps dashboard and
        // workflow readbacks tied to the exact policy decision that produced
        // the approval plan.
        if (result.status === 'classified' || result.status === 'benign') {
          const persisted = await store.execute({
            sql: `UPDATE incidents SET severity = ?
              WHERE tenant_id = ? AND id = ? AND (severity IS NULL OR severity = ?)`,
            args: [
              result.status === 'benign' ? 'low' : result.decision.severity,
              context.correlation.context.tenantId,
              context.correlation.context.incidentId,
              result.status === 'benign' ? 'low' : result.decision.severity,
            ],
          });
          if (persisted.rowsAffected !== 1) throw new DomainError('CONFLICT');
        }
        await appendTriageTimeline(
          store,
          context,
          'classification',
          result.status === 'classified' || result.status === 'benign' ? 'completed' : result.status,
          {
            result: result.status,
            reasonCodes:
              result.status === 'classified'
                ? result.decision.reasonCodes.join(',') || 'none'
                : result.reasonCodes.join(','),
            evidenceCount: context.evidence.length,
          },
        );
        return result;
      } finally {
        store.close();
      }
    },
  });
}

export async function classifySeverity(
  context: DecisionContext,
  planner: ResponsePlannerInvoker = invokeResponsePlanner,
  signal?: AbortSignal,
): Promise<ClassificationStepResult> {
  const evaluation = evaluateSeverityPolicy(
    context.correlation.context,
    context.evidence,
    context.correlation.contradictions.length,
  );
  if (evaluation.outcome === 'manual-review')
    return buildTriageStopResult('manual-review', context.correlation.context.incidentId, [...evaluation.reasonCodes]);
  if (evaluation.rationaleCode === 'benign-explanation') {
    return ClassificationStepResultSchema.parse({
      status: 'benign',
      incidentId: context.correlation.context.incidentId,
      reasonCodes: ['BENIGN_EXPLANATION'],
    });
  }
  const factTokens = evaluation.requiredEvidence.map(item => {
    const index = context.evidence.findIndex(candidate => candidate.evidenceId === item.evidenceId);
    if (index < 0) throw new DomainError('VALIDATION_FAILED');
    return `fact-${index + 1}`;
  });
  const candidate = SeverityAnalysisCandidateSchema.parse({
    schemaVersion: 1,
    assessment: 'supports-policy',
    factTokens,
    rationaleCode: evaluation.rationaleCode,
  });
  let generated;
  try {
    generated = await generateWithOneSchemaRetry(
      attempt =>
        planner(
          {
            task: 'severity',
            projection: projectDecisionContext(context),
            candidate,
          },
          attempt,
          signal,
        ),
      SeverityAnalysisCandidateSchema,
    );
  } catch {
    return buildTriageStopResult('manual-review', context.correlation.context.incidentId, ['MODEL_UNAVAILABLE']);
  }
  if (generated.status !== 'success')
    return buildTriageStopResult('manual-review', context.correlation.context.incidentId, ['MODEL_SCHEMA_INVALID']);
  if (canonicalJson(generated.output) !== canonicalJson(candidate))
    return buildTriageStopResult('manual-review', context.correlation.context.incidentId, ['MODEL_DIVERGENCE']);
  return {
    status: 'classified',
    decision: buildSeverityDecision(context),
  };
}

/** Builds an early outcome that later steps pass through to finalization. */
export function buildTriageStopResult(
  status: 'manual-review' | 'blocked',
  incidentId: string,
  reasonCodes: readonly TriageReasonCode[],
) {
  return ClassificationStepResultSchema.parse({
    status,
    incidentId,
    reasonCodes,
  });
}

/** Compatibility alias; this creates a result and does not abort the workflow. */
export const stop = buildTriageStopResult;
