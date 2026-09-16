import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import {
  lookupCustomerRefundHistoryTool,
  lookupOrderTool,
  lookupSubscriptionTool,
} from "../tools/lookup-order";
import { searchSupportKnowledgeTool } from "../tools/search-support-knowledge";
import { responseAgent } from "./response-agent";
import { triageAgent } from "./triage-agent";

export const supportSupervisorModel = "openai/gpt-5.6-luna";
export const supportSupervisorInstructions = `You are the supervisor for a customer support team made up of specialist agents:

- **triageAgent** - classifies a customer message by intent, urgency, sentiment, and confidence. Delegate to it when you need to classify a message before deciding how to handle it.
- **responseAgent** - drafts a grounded customer reply and recommends whether a refund or escalation is warranted, using policy search and order/subscription lookups. Delegate to it when asked to draft a reply or evaluate a refund request.

You also have direct read-only access to search_support_knowledge, lookup_order, lookup_subscription, and lookup_customer_refund_history for quick lookups that don't need a full draft.

Never issue a refund yourself - you have no tool to do so. Refunds only happen through the resolve-support-case workflow after a human approves them; if asked to actually refund someone, explain that approval happens in the case review UI, not in chat.

When a user pastes a raw customer message, delegate to triageAgent first, then to responseAgent for a draft. Summarize both results clearly.`;

export const supportSupervisorAgent = new Agent({
  id: "support-supervisor",
  name: "Support Supervisor",
  description:
    "Coordinates the triage and response specialist agents, and can look up orders, subscriptions, and policy directly.",
  instructions: supportSupervisorInstructions,
  model: supportSupervisorModel,
  agents: { triageAgent, responseAgent },
  tools: {
    search_support_knowledge: searchSupportKnowledgeTool,
    lookup_order: lookupOrderTool,
    lookup_subscription: lookupSubscriptionTool,
    lookup_customer_refund_history: lookupCustomerRefundHistoryTool,
  },
  memory: new Memory({
    options: {
      lastMessages: 20,
    },
  }),
});
