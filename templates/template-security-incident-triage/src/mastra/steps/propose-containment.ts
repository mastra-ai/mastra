import { createStep } from '@mastra/core/workflows';

import { createContainmentCandidate, normalizeContainmentCandidate } from '../../containment/action-registry.js';
import { createLibSqlOperationalStore } from '../../db/libsql-operational-store.js';
import { canonicalJson } from '../../evidence/canonicalize.js';
import { CorrelationSchema, type Correlation } from '../../evidence/contracts.js';
import { validateSummaryReferences } from '../../triage/claims.js';
import { loadDecisionContext } from '../../triage/decision-context.js';
import {
  ContainmentAnalysisCandidateSchema,
  ProposalStepResultSchema,
  SummaryStepResultSchema,
} from '../../triage/decision-contracts.js';
import { appendTriageTimeline } from '../../triage/decision-timeline.js';
import { assertSeverityDecision } from '../../triage/decision-validation.js';
import { projectDecisionContext } from '../../triage/prompt-safe-decision.js';
import { generateWithOneSchemaRetry } from '../agents/investigator-output.js';
import { invokeResponsePlanner } from '../agents/response-planner.js';
import type { TriageStepDependencies } from './classify-severity.js';
import { RunbookRetrievedSchema } from './retrieve-runbook.js';
import { withinWorkflowBoundary } from '../workflow-trace.js';

export function createProposeContainmentStep(dependencies: TriageStepDependencies = {}) {
  return createStep({
    id: 'propose-containment',
    description: 'Proposes only tokenized actions from the active runbook allowlist.',
    inputSchema: SummaryStepResultSchema,
    outputSchema: ProposalStepResultSchema,
    execute: async ({ inputData, getStepResult, abortSignal }) => {
      if (inputData.status !== 'summarized') return inputData;
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
          validateSummaryReferences(inputData.summary, context, inputData.decision);
        } catch {
          return ProposalStepResultSchema.parse({
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
            boundary: 'containment.plan',
            stepId: 'propose-containment',
            provider: 'response-planner',
          },
          async () => {
            let candidate;
            try {
              candidate = createContainmentCandidate(context, inputData.decision, dependencies.containmentActionTypes);
            } catch {
              const stopped = {
                status: 'manual-review' as const,
                incidentId: inputData.decision.incidentId,
                reasonCodes: [
                  inputData.decision.severity === 'low'
                    ? ('BENIGN_EXPLANATION' as const)
                    : ('TARGET_NOT_PROVEN' as const),
                ],
              };
              await appendTriageTimeline(store, context, 'proposal', 'manual-review', {
                result: stopped.status,
                reasonCodes: stopped.reasonCodes.join(','),
              });
              return stopped;
            }
            let generated;
            try {
              generated = await generateWithOneSchemaRetry(
                attempt =>
                  (dependencies.planner ?? invokeResponsePlanner)(
                    {
                      task: 'containment',
                      projection: projectDecisionContext(context),
                      candidate,
                    },
                    attempt,
                    abortSignal,
                  ),
                ContainmentAnalysisCandidateSchema,
              );
            } catch {
              const stopped = {
                status: 'manual-review' as const,
                incidentId: inputData.decision.incidentId,
                reasonCodes: ['MODEL_UNAVAILABLE' as const],
              };
              await appendTriageTimeline(store, context, 'proposal', 'manual-review', {
                result: stopped.status,
                reasonCodes: stopped.reasonCodes.join(','),
              });
              return stopped;
            }
            let candidateMatches = false;
            if (generated.status === 'success') {
              try {
                candidateMatches =
                  canonicalJson(normalizeContainmentCandidate(generated.output)) ===
                  canonicalJson(normalizeContainmentCandidate(candidate));
              } catch {
                candidateMatches = false;
              }
            }
            if (!candidateMatches) {
              const stopped = {
                status: 'blocked' as const,
                incidentId: inputData.decision.incidentId,
                reasonCodes: [
                  generated.status === 'success' ? ('ACTION_NOT_ALLOWED' as const) : ('MODEL_SCHEMA_INVALID' as const),
                ],
              };
              await appendTriageTimeline(store, context, 'proposal', 'blocked', {
                result: stopped.status,
                reasonCodes: stopped.reasonCodes.join(','),
              });
              return stopped;
            }
            await appendTriageTimeline(store, context, 'proposal', 'completed', {
              result: 'proposed',
              actionCount: candidate.actions.length,
            });
            return ProposalStepResultSchema.parse({
              status: 'proposed',
              decision: inputData.decision,
              summary: inputData.summary,
              candidate,
            });
          },
        );
      } finally {
        store.close();
      }
    },
  });
}
