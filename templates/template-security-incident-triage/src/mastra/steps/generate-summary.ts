import { createStep } from '@mastra/core/workflows';

import { createLibSqlOperationalStore } from '../../db/libsql-operational-store.js';
import { CorrelationSchema, type Correlation } from '../../evidence/contracts.js';
import { buildIncidentSummary, createSummaryCandidate, validateSummaryReferences } from '../../triage/claims.js';
import { loadDecisionContext } from '../../triage/decision-context.js';
import { ClassificationStepResultSchema, SummaryStepResultSchema } from '../../triage/decision-contracts.js';
import { appendTriageTimeline } from '../../triage/decision-timeline.js';
import { assertSeverityDecision } from '../../triage/decision-validation.js';
import type { TriageStepDependencies } from './classify-severity.js';
import { RunbookRetrievedSchema } from './retrieve-runbook.js';

export function createGenerateSummaryStep(dependencies: TriageStepDependencies = {}) {
  return createStep({
    id: 'generate-summary',
    description: 'Builds a redacted summary with code-validated evidence references.',
    inputSchema: ClassificationStepResultSchema,
    outputSchema: SummaryStepResultSchema,
    execute: async ({ inputData, getStepResult }) => {
      if (inputData.status !== 'classified') return inputData;
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
          return SummaryStepResultSchema.parse({
            status: 'blocked',
            incidentId: inputData.decision.incidentId,
            reasonCodes: ['INTEGRITY_CHECK_FAILED'],
          });
        }
        const candidate = createSummaryCandidate(context);
        const summary = buildIncidentSummary(context, inputData.decision, candidate);
        validateSummaryReferences(summary, context, inputData.decision);
        await appendTriageTimeline(store, context, 'summary', 'completed', {
          result: 'summarized',
          factCount: summary.facts.length,
          hypothesisCount: summary.hypotheses.length,
        });
        return SummaryStepResultSchema.parse({
          status: 'summarized',
          decision: inputData.decision,
          summary,
        });
      } finally {
        store.close();
      }
    },
  });
}
