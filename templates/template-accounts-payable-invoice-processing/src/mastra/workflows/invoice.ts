import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { activeInvoiceRuntime, type InvoiceRuntime } from "../accounting/providers.ts";
import { normalizeInvoice } from "../invoice/money.ts";
import {
  DecisionReasonSchema,
  FinalAssessmentSchema,
  InvoiceWorkflowInputSchema,
  NormalizedInvoiceSchema,
  InvoiceResultSchema,
  PostingRequestSchema,
  UnsignedInvoiceWorkflowInputSchema,
  type ApprovalEvidence,
  type FinalAssessment,
  type InvoiceResult,
  type UnsignedInvoiceWorkflowInput,
} from "../invoice/schema.ts";
import { makeDuplicateDetection } from "../invoice/controls/duplicates.ts";
import { makeInvoiceMatch } from "../invoice/controls/matching.ts";
import { makePolicyRouting } from "../invoice/controls/policy.ts";
import { makeVendorValidation } from "../invoice/controls/vendor.ts";

const submissionSecret = randomBytes(32);

const submissionPayload = (input: UnsignedInvoiceWorkflowInput) =>
  JSON.stringify(UnsignedInvoiceWorkflowInputSchema.parse(input));

export const signInvoiceSubmission = (input: UnsignedInvoiceWorkflowInput) =>
  createHmac("sha256", submissionSecret).update(submissionPayload(input)).digest("hex");

const isTrustedSubmission = (input: z.infer<typeof InvoiceWorkflowInputSchema>) => {
  const expected = Buffer.from(signInvoiceSubmission(input), "hex");
  const received = Buffer.from(input.submissionSignature, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
};

const normalizeStep = createStep({
  id: "normalize-invoice",
  inputSchema: InvoiceWorkflowInputSchema,
  outputSchema: NormalizedInvoiceSchema,
  execute: async ({ inputData }) => {
    if (!isTrustedSubmission(inputData)) {
      throw new Error("Invoice processing requires a server-validated document submission");
    }
    return normalizeInvoice(inputData);
  },
});

const makeAssessmentStep = (runtime: InvoiceRuntime) => {
  const validateVendor = makeVendorValidation(runtime);
  const matchPurchaseOrder = makeInvoiceMatch(runtime);
  const detectDuplicates = makeDuplicateDetection(runtime);
  const applyPolicy = makePolicyRouting(runtime);
  return createStep({
    id: "assess-invoice",
    inputSchema: NormalizedInvoiceSchema,
    outputSchema: FinalAssessmentSchema,
    execute: async ({ inputData }) => {
      const vendorAssessment = await validateVendor(inputData);
      const matchedAssessment = await matchPurchaseOrder(vendorAssessment);
      const duplicateAssessment = await detectDuplicates(matchedAssessment);
      return applyPolicy(duplicateAssessment);
    },
  });
};

const approvalDecisionSchema = z.object({
  approved: z.boolean(),
  comment: z.string().trim().max(1000).optional(),
});

export const ApprovalRequestSchema = z.object({
  invoiceNumber: z.string(),
  vendorName: z.string(),
  currency: z.string(),
  totalMinor: z.number().int().safe(),
  disposition: z.literal("approval_required"),
  reasons: z.array(DecisionReasonSchema),
  invoiceDigest: z.string().regex(/^[a-f0-9]{64}$/),
});

export const decisionReasons = (assessment: FinalAssessment) =>
  assessment.decisions.flatMap(({ reasons }) => reasons);

const invoiceDigest = (assessment: FinalAssessment) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        invoice: assessment.invoice,
        decisions: assessment.decisions,
        disposition: assessment.disposition,
        policy: assessment.policy,
      }),
    )
    .digest("hex");

const approvalEvidence = (
  assessment: FinalAssessment,
  values: Partial<ApprovalEvidence>,
): ApprovalEvidence => ({
  status: "not_requested",
  reviewerId: null,
  decidedAt: null,
  invoiceDigest: invoiceDigest(assessment),
  comment: null,
  ...values,
});

const workflowResult = (
  assessment: FinalAssessment,
  approval: ApprovalEvidence,
  executionStatus: InvoiceResult["executionStatus"],
): InvoiceResult => ({
  ...assessment,
  executionStatus,
  approval,
  posting: null,
  postingError: null,
});

const postingFailure = (
  result: InvoiceResult,
  executionStatus: "posting_unavailable" | "posting_failed",
  postingError: string,
): InvoiceResult => ({ ...result, executionStatus, postingError });

const approvalStep = createStep({
  id: "approve-invoice",
  inputSchema: FinalAssessmentSchema,
  outputSchema: InvoiceResultSchema,
  suspendSchema: ApprovalRequestSchema,
  resumeSchema: approvalDecisionSchema,
  execute: async ({ inputData, resumeData, suspend }) => {
    if (inputData.disposition === "auto_post") {
      return workflowResult(
        inputData,
        approvalEvidence(inputData, {
          status: "not_required",
          decidedAt: new Date().toISOString(),
        }),
        "ready_to_post",
      );
    }

    if (inputData.disposition !== "approval_required") {
      return workflowResult(inputData, approvalEvidence(inputData, {}), "not_postable");
    }

    if (!resumeData) {
      return await suspend({
        invoiceNumber: inputData.invoice.invoiceNumber,
        vendorName: inputData.invoice.vendorName,
        currency: inputData.invoice.currency,
        totalMinor: inputData.invoice.totalMinor,
        disposition: "approval_required",
        reasons: decisionReasons(inputData),
        invoiceDigest: invoiceDigest(inputData),
      });
    }

    const approval = approvalEvidence(inputData, {
      status: resumeData.approved ? "approved" : "rejected",
      reviewerId: "mastra-studio",
      decidedAt: new Date().toISOString(),
      comment: resumeData.comment ?? null,
    });

    return workflowResult(inputData, approval, resumeData.approved ? "ready_to_post" : "rejected");
  },
});

const makePostingStep = (runtime: InvoiceRuntime) => createStep({
  id: "post-invoice",
  inputSchema: InvoiceResultSchema,
  outputSchema: InvoiceResultSchema,
  execute: async ({ inputData }) => {
    if (inputData.executionStatus !== "ready_to_post") return inputData;

    const posting = runtime.provider.postBill;
    if (!posting)
      return postingFailure(
        inputData,
        "posting_unavailable",
        `${runtime.provider.id} is connected read-only`,
      );

    if (!inputData.vendor)
      return postingFailure(inputData, "posting_failed", "Validated vendor is missing");

    try {
      const request = PostingRequestSchema.parse({
        idempotencyKey: `ap-${inputData.approval.invoiceDigest}`,
        invoice: inputData.invoice,
        vendor: inputData.vendor,
        purchaseOrder: inputData.purchaseOrder,
        approval: inputData.approval,
      });
      const receipt = await posting(request);

      await runtime.history.save({
        id: receipt.externalBillId,
        vendorId: inputData.vendor.id,
        invoiceNumber: inputData.invoice.invoiceNumber,
        invoiceDate: inputData.invoice.invoiceDate,
        currency: inputData.invoice.currency,
        totalMinor: inputData.invoice.totalMinor,
      });

      return {
        ...inputData,
        executionStatus: "posted" as const,
        posting: receipt,
        postingError: null,
      };
    } catch (error) {
      return postingFailure(
        inputData,
        "posting_failed",
        error instanceof Error ? error.message : "Unknown posting failure",
      );
    }
  },
});

export const createInvoiceWorkflow = (runtime: InvoiceRuntime) =>
  createWorkflow({
    id: "process-invoice",
    inputSchema: InvoiceWorkflowInputSchema,
    outputSchema: InvoiceResultSchema,
    options: { shouldPersistSnapshot: () => true },
  })
    .then(normalizeStep)
    .then(makeAssessmentStep(runtime))
    .then(approvalStep)
    .then(makePostingStep(runtime))
    .commit();

export const invoiceWorkflow = createInvoiceWorkflow(activeInvoiceRuntime);
