import { createStep } from '@mastra/core/workflows';

import {
  createContainmentCandidate,
  normalizeContainmentCandidate,
  resolveContainmentActions,
} from '../../containment/action-registry.js';
import { buildValidatedContainmentPlan } from '../../containment/plan-builder.js';
import { createLibSqlOperationalStore } from '../../db/libsql-operational-store.js';
import { persistAuthoritativeTriageResult } from '../../db/triage-result-operations.js';
import { DomainError } from '../../domain/errors.js';
import { canonicalJson } from '../../evidence/canonicalize.js';
import { CorrelationSchema, type Correlation } from '../../evidence/contracts.js';
import { validateSummaryReferences } from '../../triage/claims.js';
import { loadDecisionContext } from '../../triage/decision-context.js';
import { TriageResultSchema, ProposalStepResultSchema } from '../../triage/decision-contracts.js';
import { appendTriageTimeline } from '../../triage/decision-timeline.js';
import { assertSeverityDecision } from '../../triage/decision-validation.js';
import type { TriageStepDependencies } from './classify-severity.js';
import { RunbookRetrievedSchema } from './retrieve-runbook.js';
import { withinWorkflowBoundary } from '../workflow-trace.js';

export function createValidateContainmentStep(dependencies: TriageStepDependencies = {}) {
  return createStep({
    id: 'validate-containment',
    description: 'Intersects candidate actions with code, runbook, scope, evidence, and canonical plan guards.',
    inputSchema: ProposalStepResultSchema,
    outputSchema: TriageResultSchema,
    execute: async ({ inputData, getStepResult }) => {
      if (inputData.status !== 'proposed') return inputData;
      const store = (dependencies.openStore ?? createLibSqlOperationalStore)();
      try {
        const correlation = CorrelationSchema.parse(getStepResult<Correlation>('correlate-events'));
        const retrieval = RunbookRetrievedSchema.parse(
          getStepResult<typeof RunbookRetrievedSchema._output>('retrieve-runbook'),
        );
        let context;
        try {
          context = await loadDecisionContext(store, retrieval, correlation, dependencies);
          assertSeverityDecision(context, inputData.decision);
        } catch {
          return TriageResultSchema.parse({
            status: 'blocked',
            incidentId: inputData.decision.incidentId,
            reasonCodes: ['INTEGRITY_CHECK_FAILED'],
          });
        }
        return await withinWorkflowBoundary(
          store,
          {
            tenantId: context.correlation.context.tenantId,
            incidentId: context.correlation.context.incidentId,
            workflowRunId: context.correlation.context.workflowRunId,
            correlationId: context.correlation.context.correlationId,
            boundary: 'guardrail.plan',
            stepId: 'validate-containment',
          },
          async () => {
            try {
              validateSummaryReferences(inputData.summary, context, inputData.decision);
              if (
                canonicalJson(normalizeContainmentCandidate(inputData.candidate)) !==
                canonicalJson(
                  normalizeContainmentCandidate(
                    createContainmentCandidate(context, inputData.decision, dependencies.containmentActionTypes),
                  ),
                )
              )
                throw new DomainError('VALIDATION_FAILED');
              const actions = resolveContainmentActions(
                context,
                inputData.decision,
                inputData.candidate,
                dependencies.containmentActionTypes,
              );
              const plan = buildValidatedContainmentPlan(context, actions);
              await appendTriageTimeline(store, context, 'validation', 'completed', {
                result: 'ready-for-approval',
                actionCount: plan.actions.length,
              });
              const result = TriageResultSchema.parse({
                status: 'ready-for-approval',
                decision: inputData.decision,
                summary: inputData.summary,
                plan,
              });
              await persistAuthoritativeTriageResult(store, {
                tenantId: context.correlation.context.tenantId,
                incidentId: context.correlation.context.incidentId,
                workflowRunId: context.correlation.context.workflowRunId,
                result,
              });
              return result;
            } catch {
              const stopped = {
                status: 'blocked' as const,
                incidentId: inputData.decision.incidentId,
                reasonCodes: ['PLAN_INVALID' as const],
              };
              await appendTriageTimeline(store, context, 'validation', 'blocked', {
                result: stopped.status,
                reasonCodes: stopped.reasonCodes.join(','),
              });
              return stopped;
            }
          },
        );
      } finally {
        store.close();
      }
    },
  });
}
