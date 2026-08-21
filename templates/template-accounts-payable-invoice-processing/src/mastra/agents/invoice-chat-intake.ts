import { Agent } from '@mastra/core/agent';
import { randomUUID } from 'node:crypto';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { apDecisionWorkflow } from '../phase2/workflow.ts';
import { Phase3ResultSchema } from '../phase2/schemas.ts';
import { ApprovalRequestSchema, apExecutionWorkflow } from '../phase3/workflow.ts';
import { InvoiceDraftSchema, type DocumentRef, type ReviewerContext } from '../schemas/invoice.ts';
import { validateExtraction } from '../validation/extraction-checks.ts';
import { recordApKpi } from '../monitoring/ap-kpis.ts';

const toolResult = z.object({
  status: z.enum(['processed', 'needs_extraction_review', 'failed']),
  runId: z.string().nullable(),
  executionStatus: z.string().nullable(),
  disposition: z.string().nullable().default(null),
  approvalPending: z.boolean(),
  reasons: z.array(z.string()),
  reasonDetails: z
    .array(
      z.object({
        code: z.string(),
        message: z.string(),
        evidence: z.record(z.unknown()).optional(),
      }),
    )
    .default([]),
  reviewTypes: z.array(z.string()),
  signals: z.array(z.string()),
  adaptations: z.array(z.string()),
  error: z.string().nullable(),
});
type ToolResult = z.infer<typeof toolResult>;
type WorkflowResult = {
  status: string;
  result?: unknown;
  suspendPayload?: unknown;
};
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const buildExtractionReviewResult = (issues: string[]): ToolResult =>
  toolResult.parse({
    status: 'needs_extraction_review',
    runId: null,
    executionStatus: null,
    disposition: 'verify_extraction',
    approvalPending: false,
    reasons: ['EXTRACTION_VALIDATION_FAILED'],
    reasonDetails: issues.map(message => ({ code: 'EXTRACTION_VALIDATION_FAILED', message })),
    reviewTypes: ['verify_extraction'],
    signals: [],
    adaptations: [],
    error: null,
  });

export const buildSuspendedApprovalResult = (result: WorkflowResult, runId: string): ToolResult => {
  const payload = (isRecord(result.suspendPayload) ? Object.values(result.suspendPayload) : [])
    .map(value => ApprovalRequestSchema.safeParse(value))
    .find(candidate => candidate.success)?.data;
  if (!payload) throw new Error('Approval workflow suspended without a valid approval request');
  return toolResult.parse({
    status: 'processed',
    runId,
    executionStatus: 'approval_required',
    disposition: 'approval_required',
    approvalPending: true,
    reasons: payload.reasons,
    reasonDetails: payload.reasonDetails,
    reviewTypes: payload.reviewTypes,
    signals: payload.signals,
    adaptations: payload.adaptations,
    error: null,
  });
};

const summarize = async (result: WorkflowResult, runId: string, approvalAttempt = false) => {
  if (result.status === 'suspended') {
    const output = buildSuspendedApprovalResult(result, runId);
    await recordApKpi({
      ...output,
      recordedAt: new Date().toISOString(),
      postingStatus: null,
      integrationFailure: false,
      approvalState: 'pending',
    });
    return output;
  }
  if (result.status !== 'success') {
    const output = toolResult.parse({
      status: 'failed',
      runId,
      executionStatus: null,
      approvalPending: approvalAttempt,
      reasons: [],
      reviewTypes: [],
      signals: [],
      adaptations: [],
      error: `Workflow ended ${result.status}`,
    });
    await recordApKpi({
      ...output,
      recordedAt: new Date().toISOString(),
      disposition: approvalAttempt ? 'approval_required' : null,
      postingStatus: null,
      integrationFailure: true,
      approvalState: approvalAttempt ? 'resume_failed' : 'not_applicable',
    });
    return output;
  }
  const workflowResult = Phase3ResultSchema.parse(result.result);
  const reasonDetails = workflowResult.decisions.flatMap(decision => decision.reasons);
  const output = toolResult.parse({
    status: 'processed',
    runId,
    executionStatus: workflowResult.executionStatus,
    disposition: workflowResult.disposition,
    approvalPending: false,
    reasons: reasonDetails.map(reason => reason.code),
    reasonDetails,
    reviewTypes: workflowResult.decisions.flatMap(decision => (decision.reviewType ? [decision.reviewType] : [])),
    signals: workflowResult.decisions.flatMap(decision => decision.signals),
    adaptations: workflowResult.decisions.flatMap(decision => decision.adaptations.map(adaptation => adaptation.code)),
    error: workflowResult.postingError,
  });
  const approvalState =
    workflowResult.approval.status === 'approved'
      ? 'approved'
      : workflowResult.approval.status === 'rejected'
        ? 'rejected'
        : 'not_applicable';
  await recordApKpi({
    ...output,
    recordedAt: new Date().toISOString(),
    disposition: workflowResult.disposition,
    postingStatus: workflowResult.posting?.status ?? null,
    integrationFailure:
      Boolean(workflowResult.postingError) ||
      output.executionStatus === 'posting_failed' ||
      output.executionStatus === 'posting_unavailable',
    approvalState,
  });
  return output;
};

const submitInvoice = createTool({
  id: 'submit-invoice-for-processing',
  description:
    'Submit fields extracted from one attached invoice into the deterministic AP workflow. Never invent unreadable values.',
  inputSchema: z.object({
    documentId: z.string().trim().min(1).default('chat-upload'),
    source: z.enum(['PDF', 'image']).default('PDF'),
    draft: InvoiceDraftSchema,
  }),
  outputSchema: toolResult,
  execute: async ({ documentId, source, draft }, context) => {
    const requestContext = context?.requestContext as RequestContext<ReviewerContext> | undefined;
    const candidate = { ...draft, source };
    const checked = validateExtraction(candidate);
    if (!checked.extracted) {
      const output = buildExtractionReviewResult(checked.issues);
      await recordApKpi({
        ...output,
        runId: `extraction-${randomUUID()}`,
        recordedAt: new Date().toISOString(),
        postingStatus: null,
        integrationFailure: false,
        approvalState: 'not_applicable',
      });
      return output;
    }
    const document: DocumentRef = {
      id: documentId,
      mimeType: source === 'PDF' ? 'application/pdf' : 'image/jpeg',
      source,
      sha256: undefined,
    };
    const phase1 = {
      rawDocumentRef: document,
      extractedResult: checked.extracted,
      checks: { passed: true, issues: [] },
      reviewerId: null,
      snapshot: { rawDocumentRef: document, extractedResult: checked.extracted },
    };
    const decisionRun = await apDecisionWorkflow.createRun();
    const decision = await decisionRun.start({ inputData: phase1 });
    if (decision.status !== 'success') {
      const output = toolResult.parse({
        status: 'failed',
        runId: decisionRun.runId,
        executionStatus: null,
        approvalPending: false,
        reasons: [],
        reviewTypes: [],
        signals: [],
        adaptations: [],
        error: `Decision workflow ended ${decision.status}`,
      });
      await recordApKpi({
        ...output,
        recordedAt: new Date().toISOString(),
        disposition: null,
        postingStatus: null,
        integrationFailure: true,
        approvalState: 'not_applicable',
      });
      return output;
    }
    const executionRun = await apExecutionWorkflow.createRun();
    const execution = await executionRun.start({ inputData: decision.result, requestContext });
    return await summarize(execution, executionRun.runId);
  },
});

const resumeApproval = createTool({
  id: 'resolve-invoice-approval',
  description: 'Approve or reject a previously suspended invoice-processing run after reviewing its result.',
  inputSchema: z.object({
    runId: z.string().trim().min(1),
    approved: z.boolean(),
    comment: z.string().trim().max(1000).optional(),
  }),
  outputSchema: toolResult,
  execute: async ({ runId, approved, comment }, context) => {
    const requestContext = context?.requestContext as RequestContext<ReviewerContext> | undefined;
    const run = await apExecutionWorkflow.createRun({ runId });
    const result = await run.resume({
      step: 'approve-invoice',
      resumeData: { approved, comment },
      requestContext,
    });
    return await summarize(result, runId, true);
  },
});

export const invoiceChatIntakeAgent = new Agent({
  id: 'accounts-payable-agent',
  name: 'Accounts Payable Agent',
  model: process.env.INVOICE_READER_MODEL ?? 'openai/gpt-5.6-sol',
  instructions: `An explicit approval or rejection for an existing run takes priority over invoice intake. If the user says approve or reject and supplies a run ID, do not request an attachment: call resolve-invoice-approval exactly once with that run ID, approved true for approval or false for rejection, and the supplied comment if any. That action requires an authenticated reviewer but no invoice attachment.

Otherwise, process one invoice attachment at a time. Read only values visibly printed on the attached PDF, PNG, or JPEG; use null or omit fields that are unreadable. Always include an honest overallConfidence and field-level confidence entries. Name line confidence fields with indexed paths such as lines[0].description, lines[0].qty, and lines[0].unitPrice. A missing PDF text layer alone is not low confidence: judge the visible rendered page. Use low confidence (below 0.8) only for fields that are visually degraded, such as blur, noise, skew, cropping, occlusion, or ambiguous/unreadable characters. Then call submit-invoice-for-processing exactly once with the extracted draft. Never invent vendor IDs, PO IDs, accounting IDs, or values. Report the disposition, review types, all reason details and evidence, and adaptations returned by the tool; do not invent an adaptation. If it reports approvalPending, present the runId and wait for an authenticated reviewer to explicitly approve or reject it; only then call resolve-invoice-approval.`,
  tools: { submitInvoice, resumeApproval },
});
