import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { Memory } from "@mastra/memory";
import { z } from "zod";
import {
  ApprovalRequestSchema,
  decisionReasons,
  invoiceWorkflow,
  signInvoiceSubmission,
} from "../workflows/invoice.ts";
import {
  DecisionReasonSchema,
  InvoiceDraftSchema,
  InvoiceResultSchema,
} from "../invoice/schema.ts";
import { validateExtraction } from "../invoice/validation.ts";

const toolResult = z.object({
  status: z.enum(["processed", "needs_extraction_review", "failed"]),
  runId: z.string().nullable().default(null),
  executionStatus: z.string().nullable().default(null),
  disposition: z.string().nullable().default(null),
  approvalPending: z.boolean().default(false),
  reasons: z.array(DecisionReasonSchema).default([]),
  error: z.string().nullable().default(null),
});
type ToolResult = z.infer<typeof toolResult>;
type WorkflowResult = {
  status: string;
  result?: unknown;
  suspendPayload?: unknown;
};
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const response = (values: z.input<typeof toolResult>): ToolResult => toolResult.parse(values);

const buildExtractionReviewResult = (issues: string[]) =>
  response({
    status: "needs_extraction_review",
    disposition: "verify_extraction",
    reasons: issues.map((message) => ({ code: "EXTRACTION_VALIDATION_FAILED", message })),
  });

const summarize = (result: WorkflowResult, runId: string) => {
  if (result.status === "suspended") {
    const payload = (isRecord(result.suspendPayload) ? Object.values(result.suspendPayload) : [])
      .map((value) => ApprovalRequestSchema.safeParse(value))
      .find((candidate) => candidate.success)?.data;
    if (!payload) throw new Error("Approval workflow suspended without a valid request");
    return response({
      ...payload,
      status: "processed",
      runId,
      executionStatus: "approval_required",
      approvalPending: true,
    });
  }
  if (result.status !== "success") {
    return response({
      status: "failed",
      runId,
      error: `Workflow ended ${result.status}`,
    });
  }
  const workflowResult = InvoiceResultSchema.parse(result.result);
  return response({
    status: "processed",
    runId,
    executionStatus: workflowResult.executionStatus,
    disposition: workflowResult.disposition,
    reasons: decisionReasons(workflowResult),
    error: workflowResult.postingError,
  });
};

const submitInvoice = createTool({
  id: "submit-invoice-for-processing",
  description:
    "Submit fields extracted from one attached invoice into the deterministic AP workflow. Never invent unreadable values.",
  inputSchema: z.object({
    documentId: z.string().trim().min(1).default("chat-upload"),
    source: z.enum(["PDF", "image"]).default("PDF"),
    draft: InvoiceDraftSchema,
  }),
  outputSchema: toolResult,
  execute: async ({ documentId, source, draft }) => {
    const checked = validateExtraction({ ...draft, source });
    if (!checked.extracted) {
      return buildExtractionReviewResult(checked.issues);
    }
    const document = {
      id: documentId,
      mimeType: source === "PDF" ? "application/pdf" : "image/jpeg",
      source,
    } as const;
    const unsignedWorkflowInput = {
      rawDocumentRef: document,
      extractedResult: checked.extracted,
    };
    const workflowInput = {
      ...unsignedWorkflowInput,
      submissionSignature: signInvoiceSubmission(unsignedWorkflowInput),
    };
    const run = await invoiceWorkflow.createRun();
    const result = await run.start({ inputData: workflowInput });
    return summarize(result, run.runId);
  },
});

const resumeApproval = createTool({
  id: "resolve-invoice-approval",
  description:
    "Approve or reject a previously suspended invoice-processing run after reviewing its result.",
  inputSchema: z.object({
    runId: z.string().trim().min(1),
    approved: z.boolean(),
    comment: z.string().trim().max(1000).optional(),
  }),
  outputSchema: toolResult,
  execute: async ({ runId, approved, comment }) => {
    const run = await invoiceWorkflow.createRun({ runId });
    const result = await run.resume({
      step: "approve-invoice",
      resumeData: { approved, comment },
    });
    return summarize(result, runId);
  },
});

export const accountsPayableAgent = new Agent({
  id: "accounts-payable-agent",
  name: "Accounts Payable Agent",
  model: process.env.INVOICE_READER_MODEL ?? "openai/gpt-5.6-sol",
  instructions: `You process one invoice attachment at a time.

For a PDF, PNG, or JPEG:
- Read only values visible in the document. Leave unreadable optional fields empty.
- Include honest overall and field-level confidence. Use indexed line fields such as lines[0].qty.
- Judge confidence from the rendered document, not whether a PDF has a text layer.
- Call submit-invoice-for-processing once, then report its decision and evidence.

Never invent invoice values or accounting IDs.

For approval or rejection, require the run ID in the user's message. Call resolve-invoice-approval once with that run ID and decision. Never infer approval from conversation memory.`,
  memory: new Memory({ options: { lastMessages: 20 } }),
  tools: { submitInvoice, resumeApproval },
});
