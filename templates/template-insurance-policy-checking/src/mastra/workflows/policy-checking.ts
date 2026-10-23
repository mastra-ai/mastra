import { createStep, createWorkflow } from '@mastra/core/workflows';
import { RequestContext } from '@mastra/core/request-context';
import { z } from 'zod';
import { reviewCheckpointSchema, reportRequestSchema } from '../domain/reports.js';
import {
  compareRequestSchema,
  comparisonResultSchema,
  type ComparisonRunner,
} from '../domain/reconciliation-contracts.js';
import { failureSchema, IntakeError, safely } from '../domain/errors.js';
import type { CaseService } from '../services/case-service.js';
import type { ReconciliationService } from '../services/reconciliation-service.js';
import type { ReportService } from '../services/report-service.js';
import { operationContext } from '../tools/tool-context.js';

export function createPolicyCheckingWorkflow(
  service: ReconciliationService,
  cases: CaseService,
  operatorId: string,
  reports?: ReportService,
) {
  const outputSchema = z.union([comparisonResultSchema, failureSchema]);
  const step = createStep({
    id: 'reconcile-insurance-evidence',
    inputSchema: compareRequestSchema,
    outputSchema,
    execute: async ({ inputData, requestContext, runId }) =>
      safely(() =>
        service.process(operationContext(cases, operatorId, requestContext), inputData, runId, Boolean(reports)),
      ),
  });
  const reviewCheckpoint = createStep({
    id: 'publish-and-await-broker-review',
    inputSchema: outputSchema,
    outputSchema,
    resumeSchema: z.unknown(),
    suspendSchema: reviewCheckpointSchema,
    execute: async ({ inputData, requestContext, runId, suspend }) => {
      if ('ok' in inputData || !reports) return inputData;
      const frozen = await reports.repository.forRun(runId);
      const context = frozen?.context ?? operationContext(cases, operatorId, requestContext);
      const publication = frozen ?? (await reports.prepare(context, inputData.analysisId, runId));
      // Every entry, including direct public resume, reads the immutable domain record.
      // F3 accepts no review authority and cannot produce a final artifact.
      await safely(() => reports.publish(publication));
      const result = await reports.current(context, { caseId: publication.snapshot.caseId });
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
  const definition = createWorkflow({
    id: 'policy-checking-workflow',
    inputSchema: compareRequestSchema,
    outputSchema,
    options: { shouldPersistSnapshot: () => true, autoRestartActiveRuns: false },
  }).then(step);
  const workflow = (reports ? definition.then(reviewCheckpoint) : definition).commit();
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
        const pending = await reports.pending(context);
        if (pending) return report(context, { caseId: request.caseId });
        const record = await cases.repository.requireCase(context, request.caseId);
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
  async function report(context: import('../domain/contracts.js').OperationContext, input: unknown) {
    if (!reports)
      throw new IntakeError(
        'REPORT_UNAVAILABLE',
        'Draft reports are not configured.',
        'Register a draft output provider.',
      );
    const request = reportRequestSchema.parse(input);
    await cases.repository.requireCase(context, request.caseId);
    const publication = await reports.repository.get(context, request.reportId);
    const completed = await service.completed(context, publication?.snapshot.workflowRunId);
    if (!publication && completed && !request.retryPublication)
      throw new IntakeError(
        'DRAFT_INTERRUPTED',
        'The completed comparison has no published draft checkpoint.',
        'Use /report with retryPublication true to recover the original workflow without another comparison.',
        409,
      );
    if (request.retryPublication && (publication || completed)) {
      const requestContext = new RequestContext();
      requestContext.set('insuranceThreadId', context.threadId);
      const runId = publication?.snapshot.workflowRunId ?? completed!.result.workflowRunId;
      const run = await workflow.createRun({ runId, resourceId: operatorId });
      const snapshot = await workflow.getWorkflowRunById(runId);
      if (!snapshot || snapshot.status === 'pending')
        await run.start({ inputData: completed!.request, requestContext });
      else if (snapshot.status === 'running') await run.restart({ requestContext });
      else if (snapshot.status === 'failed' || snapshot.status === 'success')
        await run.timeTravel({ step: 'publish-and-await-broker-review', inputData: completed!.result, requestContext });
      else
        await run.resume({
          step: 'publish-and-await-broker-review',
          resumeData: { retryPublication: true },
          requestContext,
        });
    }
    const current = await reports.current(context, request);
    const checkpoint = await workflow.getWorkflowRunById(current.workflowRunId);
    return {
      ...current,
      checkpointState: checkpoint?.status === 'suspended' ? 'SUSPENDED' : 'INTERRUPTED',
      ...(checkpoint?.status !== 'suspended'
        ? {
            message:
              'The draft record is saved, but its workflow checkpoint was interrupted. Use /report with retryPublication true to repair the same run. No approval was inferred.',
          }
        : {}),
    };
  }
  return { workflow, runner, report };
}
