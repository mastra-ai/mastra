import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { failureSchema, IntakeError, safely } from '../domain/operation-errors.js';
import { comparisonResultSchema } from '../domain/reconciliation-contracts.js';
import { reviewCheckpointSchema } from '../domain/report-contracts.js';
import type { CaseService } from '../services/case-service.js';
import type { ReportService } from '../services/report-service.js';
import { operationContext } from '../tools/tool-context.js';

export const reviewedComparisonResultSchema = z.union([
  comparisonResultSchema.extend({
    reviewDecision: z
      .enum(['REVISION_REQUESTED', 'REJECTED', 'FINALIZED'])
      .optional()
      .describe('Persisted broker decision that closed this report workflow; completion does not imply approval.'),
  }),
  failureSchema,
]);

/** Publish the immutable draft and suspend until its recorded broker decision can be verified. */
export function createReviewCheckpointStep(cases: CaseService, operatorId: string, reports: ReportService) {
  const outputSchema = z.union([comparisonResultSchema, failureSchema]);
  return createStep({
    id: 'publish-and-await-broker-review',
    inputSchema: outputSchema,
    outputSchema: reviewedComparisonResultSchema,
    resumeSchema: z.unknown(),
    suspendSchema: reviewCheckpointSchema,
    execute: async ({ inputData, requestContext, runId, suspend }) => {
      if ('ok' in inputData) return inputData;
      const frozen = await reports.repository.forRun(runId);
      const context = frozen?.context ?? operationContext(cases, operatorId, requestContext);
      const publication = frozen ?? (await reports.prepare(context, inputData.analysisId, runId));
      const record = await cases.repository.requireCase(context, publication.snapshot.caseId);
      const decision = reports.review
        ? (await reports.review.repository.events(context)).find(
            event => event.reportId === publication.snapshot.id && ['revise', 'reject'].includes(event.action),
          )
        : undefined;
      // Only a committed, version-bound broker decision closes an obsolete draft.
      // Resume payloads never grant review authority or approve a superseded version.
      if (decision)
        return {
          ...inputData,
          reviewDecision: decision.action === 'revise' ? ('REVISION_REQUESTED' as const) : ('REJECTED' as const),
        };
      if (
        record.latestReportId !== publication.snapshot.id ||
        ['REJECTED', 'REVISION_REQUESTED'].includes(record.state)
      )
        throw new IntakeError(
          'STALE_REVIEW',
          'This workflow is bound to a rejected or superseded report.',
          'Read /report and use the current report workflow.',
          409,
        );
      // Resume payloads never establish authority. Every entry re-reads the bound approval.
      if (reports.review && ['APPROVED', 'FINALIZED'].includes(record.state)) {
        await reports.review.finalize(context, publication.snapshot.id);
        return { ...inputData, reviewDecision: 'FINALIZED' as const };
      }
      await safely(() => reports.publish(publication));
      const result = await reports.current(context, {
        caseId: publication.snapshot.caseId,
        reportId: publication.snapshot.id,
      });
      return suspend({
        caseId: publication.snapshot.caseId,
        reportId: publication.snapshot.id,
        version: publication.snapshot.version,
        workflowRunId: runId,
        snapshotHash: publication.hash,
        ...(result.available ? { artifactId: publication.artifactId } : {}),
        phase: result.available ? 'AWAITING_REVIEW' : 'PUBLICATION_FAILED',
        ...(result.failure ? { failure: result.failure } : {}),
      });
    },
  });
}
