import { createStep } from '@mastra/core/workflows';
import { StudioLocalDecisionSchema, resolveStudioLocalDecision } from '../../approval/studio-local-decision.js';

import { ApprovalRequestedResultSchema, ApprovalResolvedResultSchema } from '../../approval/contracts.js';
import { readConsumedResumeReceipt } from '../../db/approval-operations.js';
import { createLibSqlOperationalStore } from '../../db/libsql-operational-store.js';
import type { OperationalStore } from '../../db/operational-store.js';
import type { Clock } from '../../domain/clock.js';
import { ApprovalResumePayloadSchema, ApprovalSuspendPayloadSchema } from '../../schemas/approval.js';
import { startWorkflowBoundary } from '../observability.js';
import { advanceWorkflowTrace, readWorkflowTrace } from '../workflow-trace.js';

export function createAwaitApprovalStep(
  dependencies: Readonly<{
    openStore?: () => OperationalStore;
    clock?: Clock;
    studioLocalDecisions?: boolean;
  }> = {},
) {
  return createStep({
    id: 'await-approval',
    description: 'Suspends with a minimal public payload and resumes only by consuming a bound one-shot token.',
    inputSchema: ApprovalRequestedResultSchema,
    outputSchema: ApprovalResolvedResultSchema,
    suspendSchema: ApprovalSuspendPayloadSchema,
    resumeSchema: dependencies.studioLocalDecisions
      ? ApprovalResumePayloadSchema.or(StudioLocalDecisionSchema)
      : ApprovalResumePayloadSchema,
    execute: async ({ inputData, resumeData, suspend }) => {
      if (inputData.status !== 'approval-requested') return inputData;
      if (!resumeData) {
        const store = (dependencies.openStore ?? createLibSqlOperationalStore)();
        let context;
        try {
          context = await readWorkflowTrace(store, {
            tenantId: inputData.plan.tenantId,
            incidentId: inputData.plan.incidentId,
            workflowRunId: inputData.workflowRunId,
          });
          const trace = startWorkflowBoundary({
            boundary: 'approval.await',
            tenantId: inputData.plan.tenantId,
            incidentId: inputData.plan.incidentId,
            runId: inputData.workflowRunId,
            correlationId: inputData.correlationId,
            requestId: context?.requestId ?? inputData.workflowRunId,
            ...(context ? { context } : {}),
            identifiers: { stepId: 'await-approval', provider: 'linear' },
          });
          trace.span.end({ attributes: { success: true } as never });
          if (context)
            await advanceWorkflowTrace(store, {
              tenantId: inputData.plan.tenantId,
              incidentId: inputData.plan.incidentId,
              workflowRunId: inputData.workflowRunId,
              previous: context,
              next: {
                ...trace.context,
                runId: inputData.workflowRunId,
                requestId: context.requestId,
              },
            });
          return suspend({
            incidentId: inputData.plan.incidentId,
            workflowRunId: inputData.workflowRunId,
            approvalId: inputData.approval.approvalId,
            planHashVersion: 1,
            planHash: inputData.plan.planHash,
            expiresAt: inputData.approval.expiresAt,
          });
        } finally {
          store.close();
        }
      }
      const store = (dependencies.openStore ?? createLibSqlOperationalStore)();
      let trace: ReturnType<typeof startWorkflowBoundary> | undefined;
      try {
        const localDecision = dependencies.studioLocalDecisions
          ? StudioLocalDecisionSchema.safeParse(resumeData)
          : undefined;
        const parsedResume = localDecision?.success
          ? {
              resumeReceiptId: await resolveStudioLocalDecision(
                store,
                inputData,
                localDecision.data,
                dependencies.clock,
              ),
            }
          : ApprovalResumePayloadSchema.parse(resumeData);
        const context = await readWorkflowTrace(store, {
          tenantId: inputData.plan.tenantId,
          incidentId: inputData.plan.incidentId,
          workflowRunId: inputData.workflowRunId,
        });
        trace = startWorkflowBoundary({
          boundary: 'approval.resume',
          tenantId: inputData.plan.tenantId,
          incidentId: inputData.plan.incidentId,
          runId: inputData.workflowRunId,
          correlationId: inputData.correlationId,
          requestId: inputData.workflowRunId,
          ...(context ? { context } : {}),
        });
        const authoritative = await readConsumedResumeReceipt(store, {
          resumeReceiptId: parsedResume.resumeReceiptId,
          tenantId: inputData.plan.tenantId,
          incidentId: inputData.plan.incidentId,
          workflowRunId: inputData.workflowRunId,
          approvalId: inputData.approval.approvalId,
        });
        const result = ApprovalResolvedResultSchema.parse({
          status: 'approval-resolved',
          decision: inputData.decision,
          summary: inputData.summary,
          plan: inputData.plan,
          approval: inputData.approval,
          authoritative,
          workflowRunId: inputData.workflowRunId,
          correlationId: inputData.correlationId,
        });
        trace.span.end({ attributes: { success: true } as never });
        if (context)
          await advanceWorkflowTrace(store, {
            tenantId: inputData.plan.tenantId,
            incidentId: inputData.plan.incidentId,
            workflowRunId: inputData.workflowRunId,
            previous: context,
            next: {
              ...trace.context,
              runId: inputData.workflowRunId,
              requestId: context.requestId,
            },
          });
        return result;
      } catch (error) {
        trace?.span.error({ error: error as Error, endSpan: true });
        throw error;
      } finally {
        store.close();
      }
    },
  });
}
