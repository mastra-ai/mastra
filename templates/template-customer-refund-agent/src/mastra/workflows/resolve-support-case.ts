import { createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { resolveSupportCaseInputSchema } from "./resolve-support-case-context";
import { classifyStep } from "./resolve-support-case-classify";
import { draftResponseStep } from "./resolve-support-case-draft-response";
import { resolveCaseStep } from "./resolve-support-case-finalize";
import { inspectOrderStep } from "./resolve-support-case-inspect-order";
import {
  REQUEST_APPROVAL_STEP_ID,
  requestApprovalStep,
} from "./resolve-support-case-request-approval";
import { retrievePolicyStep } from "./resolve-support-case-retrieve-policy";
import {
  explicitNoRefundCancellation,
  scheduleCancellationStep,
} from "./resolve-support-case-schedule-subscription-cancellation";

export const resolveSupportCaseWorkflow = createWorkflow({
  id: "resolve-support-case",
  description:
    "The core resolution pipeline: classify -> retrieve policy -> inspect order -> draft response -> human refund approval -> finalize an executed effect or escalate.",
  inputSchema: resolveSupportCaseInputSchema,
  outputSchema: z.object({
    caseId: z.string(),
    turnId: z.string(),
    status: z.enum(["resolved", "escalated"]),
  }),
})
  .then(classifyStep)
  .then(retrievePolicyStep)
  .then(inspectOrderStep)
  .then(draftResponseStep)
  .then(scheduleCancellationStep)
  .then(requestApprovalStep)
  .then(resolveCaseStep)
  .commit();

export { REQUEST_APPROVAL_STEP_ID, explicitNoRefundCancellation };
