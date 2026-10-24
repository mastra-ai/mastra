import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { failureSchema, IntakeError, safely } from '../domain/operation-errors.js';
import { compareRequestSchema, comparisonResultSchema } from '../domain/reconciliation-contracts.js';
import type { CaseService } from '../services/case-service.js';
import type { ReconciliationService } from '../services/reconciliation-service.js';
import type { ReportService } from '../services/report-service.js';
import { operationContext } from '../tools/tool-context.js';

export function createReconcileEvidenceStep(
  service: ReconciliationService,
  cases: CaseService,
  operatorId: string,
  reports?: ReportService,
) {
  const outputSchema = z.union([comparisonResultSchema, failureSchema]);
  return createStep({
    id: 'reconcile-insurance-evidence',
    inputSchema: compareRequestSchema,
    outputSchema,
    execute: async ({ inputData, requestContext, runId }) =>
      safely(async () => {
        const context = operationContext(cases, operatorId, requestContext);
        const record = await cases.repository.requireCase(context, inputData.caseId);
        if (reports && record.state === 'REVISION_REQUESTED' && record.revisionAuthority?.kind === 'presentation') {
          if (record.revision !== inputData.expectedRevision)
            throw new IntakeError(
              'STALE_CASE',
              'The case changed before the requested revision started.',
              'Read /status and use the current case revision.',
              409,
            );
          const saved = await service.completed(context);
          if (!saved)
            throw new IntakeError(
              'ANALYSIS_UNAVAILABLE',
              'The original analysis for this revision is unavailable.',
              'Restore the paired case records before retrying.',
              409,
            );
          await reports.repository.reconciliation.transaction(async transaction => {
            const current = await cases.repository.requireCase(context, inputData.caseId);
            if (
              current.state !== 'REVISION_REQUESTED' ||
              current.revision !== inputData.expectedRevision ||
              current.revisionAuthority?.kind !== 'presentation'
            )
              throw new IntakeError(
                'STALE_CASE',
                'Another workflow started this revision.',
                'Read /report for the active workflow.',
                409,
              );
            await transaction.execute({
              sql: 'UPDATE insurance_cases SET data=? WHERE id=? AND data=?',
              args: [
                JSON.stringify({
                  ...current,
                  state: 'PROCESSING',
                  revision: current.revision + 1,
                  revisionAuthority: { ...current.revisionAuthority, runId },
                }),
                current.id,
                JSON.stringify(current),
              ],
            });
          });
          return { ...saved.result, workflowRunId: runId };
        }
        return service.process(context, inputData, runId, Boolean(reports));
      }),
  });
}
