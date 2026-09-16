import { Agent } from "@mastra/core/agent";
import { issueRefundTool } from "../tools/issue-refund";
import { issueSubscriptionCreditTool } from "../tools/issue-subscription-credit";

/** The only agent allowed to propose the financial tool.  The supervisor and
 * drafting specialists intentionally never receive this tool. */
export const refundExecutionAgent = new Agent({
  id: "refund-execution-agent",
  name: "Restricted Refund Execution Agent",
  description:
    "Proposes exactly one approved refund or subscription-credit command and no other action.",
  instructions:
    "Call exactly the supplied issue_refund or issue_subscription_credit tool once using its JSON command. Do not alter any value and do not answer with prose before the tool call.",
  model: "openai/gpt-5.6-luna",
  tools: {
    issue_refund: issueRefundTool,
    issue_subscription_credit: issueSubscriptionCreditTool,
  },
});
