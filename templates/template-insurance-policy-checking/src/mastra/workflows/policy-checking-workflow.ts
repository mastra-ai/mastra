import { RequestContext } from '@mastra/core/request-context';
import { createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { failureSchema, IntakeError, safely } from '../domain/operation-errors.js';
import {
  compareRequestSchema,
  comparisonResultSchema,
  type ComparisonRunner,
} from '../domain/reconciliation-contracts.js';
import { reportRequestSchema } from '../domain/report-contracts.js';
import type { ReviewDecision } from '../domain/review-contracts.js';
import { operation } from '../runtime/operation-logger.js';
import type { CaseService } from '../services/case-service.js';
import type { ReconciliationService } from '../services/reconciliation-service.js';
import type { ReportService } from '../services/report-service.js';
import { createReconcileEvidenceStep } from './reconcile-evidence-step.js';
import { createReviewCheckpointStep } from './review-checkpoint-step.js';

export function createPolicyCheckingWorkflow(
  service: ReconciliationService,
  cases: CaseService,
  operatorId: string,
  reports?: ReportService,
) {
  const outputSchema = z.union([comparisonResultSchema, failureSchema]);
  const definition = createWorkflow({
    id: 'policy-checking-workflow',
    inputSchema: compareRequestSchema,
    outputSchema,
    options: { shouldPersistSnapshot: () => true, autoRestartActiveRuns: false },
  }).then(createReconcileEvidenceStep(service, cases, operatorId, reports));
  const workflow = (
    reports ? definition.then(createReviewCheckpointStep(cases, operatorId, reports)) : definition
  ).commit();
  const runner: ComparisonRunner = {
    async compare(context, input) {
      const request = compareRequestSchema.parse(input);
      if (context.operatorId !== operatorId)
        throw new IntakeError(
          'CASE_CONTEXT',
          'The configured operator does not match this request.',
          'Use the current local Studio operator.',
        );
      const requestContext = new RequestContext();
      requestContext.set('insuranceThreadId', context.threadId);
      if (reports) {
        const record = await cases.repository.requireCase(context, request.caseId);
        const pending = await reports.pending(context);
        if (pending && !record.revisionAuthority) return report(context, { caseId: request.caseId });
        if (record.state === 'PROCESSING' && record.latestAnalysisId)
          throw new IntakeError(
            'DRAFT_INTERRUPTED',
            'Comparison is saved, but draft publication was interrupted.',
            'Use /report with retryPublication true to recover the same report workflow without repeating comparison.',
            409,
          );
      }
      const run = await workflow.createRun({ resourceId: operatorId });
      const result = await run.start({ inputData: request, requestContext });
      if (reports && result.status === 'suspended') return report(context, { caseId: request.caseId });
      if (result.status !== 'success')
        throw new IntakeError(
          'WORKFLOW_INTERRUPTED',
          'The comparison workflow did not complete.',
          'Read case status before explicitly retrying.',
        );
      return result.result;
    },
  };
  async function report(context: import('../domain/case-contracts.js').OperationContext, input: unknown) {
    if (!reports)
      throw new IntakeError(
        'REPORT_UNAVAILABLE',
        'Draft reports are not configured.',
        'Register a draft output provider.',
      );
    const request = reportRequestSchema.parse(input);
    await cases.repository.requireCase(context, request.caseId);
    const publication = await reports.repository.get(context, request.reportId);
    const record = await cases.repository.requireCase(context, request.caseId);
    const completed = !publication ? await service.completed(context) : null;
    if (!publication && completed && !request.retryPublication)
      throw new IntakeError(
        'DRAFT_INTERRUPTED',
        'The completed comparison has no published draft checkpoint.',
        'Use /report with retryPublication true to recover the original workflow without another comparison.',
        409,
      );
    if (request.retryPublication && publication && reports.review && ['APPROVED', 'FINALIZED'].includes(record.state)) {
      await resumeApproved(context, publication.snapshot.id);
    } else if (request.retryPublication && (publication || completed)) {
      const saved = completed ?? (await service.completed(context));
      if (!saved)
        throw new IntakeError(
          'REPORT_RECOVERY',
          'This historical or revised report cannot restart the current analysis.',
          'Read /report and complete the current revision.',
          409,
        );
      const requestContext = new RequestContext();
      requestContext.set('insuranceThreadId', context.threadId);
      const runId = publication?.snapshot.workflowRunId ?? completed!.result.workflowRunId;
      const run = await workflow.createRun({ runId, resourceId: operatorId });
      const snapshot = await workflow.getWorkflowRunById(runId);
      if (!snapshot || snapshot.status === 'pending') await run.start({ inputData: saved.request, requestContext });
      else if (snapshot.status === 'running') await run.restart({ requestContext });
      else if (snapshot.status === 'failed' || snapshot.status === 'success')
        await run.timeTravel({ step: 'publish-and-await-broker-review', inputData: saved.result, requestContext });
      else
        await run.resume({
          step: 'publish-and-await-broker-review',
          resumeData: { retryPublication: true },
          requestContext,
        });
    }
    const current = await reports.current(context, request);
    if (request.retryPublication)
      operation({
        stage: 'draft',
        outcome: 'recovered',
        caseId: current.report.caseId,
        reportId: current.report.id,
        runId: current.workflowRunId,
        version: current.report.version,
        recovery: 'retry_publication',
        costMicros: null,
      });
    const checkpoint = await workflow.getWorkflowRunById(current.workflowRunId);
    return {
      ...current,
      checkpointState:
        checkpoint?.status === 'suspended'
          ? 'SUSPENDED'
          : checkpoint?.status === 'success'
            ? 'COMPLETED'
            : 'INTERRUPTED',
      ...(!['APPROVED', 'FINALIZED', 'REJECTED', 'REVISION_REQUESTED'].includes(record.state) &&
      current.current &&
      checkpoint?.status !== 'suspended'
        ? {
            message:
              'The draft record is saved, but its workflow checkpoint was interrupted. Use /report with retryPublication true to repair the same run. No approval was inferred.',
          }
        : {}),
    };
  }
  async function resumeApproved(context: import('../domain/case-contracts.js').OperationContext, reportId: string) {
    if (!reports?.review)
      throw new IntakeError(
        'REVIEW_UNAVAILABLE',
        'Broker review is not configured.',
        'Register approved output providers.',
      );
    const { publication } = await reports.review.finalizations.authority(context, reportId);
    const runId = publication.snapshot.workflowRunId;
    const requestContext = new RequestContext();
    requestContext.set('insuranceThreadId', context.threadId);
    const run = await workflow.createRun({ runId, resourceId: operatorId });
    const state = await workflow.getWorkflowRunById(runId);
    if (state?.status === 'success') {
      await reports.review.finalize(context, reportId);
      return;
    }
    if (state?.status === 'suspended') {
      await run.resume({ step: 'publish-and-await-broker-review', resumeData: {}, requestContext });
    } else if (state?.status === 'running') {
      // Native time travel refuses running snapshots. Restart recovers the active
      // step from its persisted input and respects Mastra's execution ownership.
      await run.restart({ requestContext });
    } else {
      const saved = publication.snapshot;
      const status = await reports.repository.reconciliation.status(context);
      const analysis = status.analyses.find(a => a.id === saved.analysisId);
      if (!analysis)
        throw new IntakeError(
          'REPORT_RECOVERY',
          'The approved report analysis is unavailable.',
          'Restore the paired records before retrying.',
          409,
        );
      await run.timeTravel({
        step: 'publish-and-await-broker-review',
        inputData: {
          analysisId: analysis.id,
          attemptId: analysis.attemptId,
          workflowRunId: runId,
          conclusion: analysis.conclusion,
          comparisons: analysis.comparisons.map(({ id, label, classification, observation }) => ({
            id,
            label,
            classification,
            observation,
          })),
          limitations: analysis.limitations,
        },
        requestContext,
      });
    }
    const completed = await workflow.getWorkflowRunById(runId);
    if (completed?.status !== 'success')
      throw new IntakeError(
        'WORKFLOW_INTERRUPTED',
        'Approval is saved, but its workflow has not completed final publication.',
        'Retry /report with retryPublication true to recover this same approved run.',
        503,
      );
  }
  const review: ReviewDecision = async (context, input, origin) => {
    if (!reports?.review)
      throw new IntakeError(
        'REVIEW_UNAVAILABLE',
        'Broker review is not configured.',
        'Register approved output providers.',
      );
    if (context.operatorId !== operatorId)
      throw new IntakeError(
        'REVIEWER_CONTEXT',
        'This reviewer does not match the configured local operator.',
        'Use the current local Studio operator.',
        403,
      );
    const receipt = await reports.review.record(context, input, origin);
    if (receipt.approvalId) {
      const outcome = await safely(() => resumeApproved(context, receipt.reportId));
      if (outcome && typeof outcome === 'object' && 'ok' in outcome)
        return {
          receipt,
          publicationFailure: outcome,
          report: await report(context, { caseId: receipt.caseId, reportId: receipt.reportId }),
        };
    }
    return { receipt, report: await report(context, { caseId: receipt.caseId, reportId: receipt.reportId }) };
  };
  return { workflow, runner, report, review };
}
