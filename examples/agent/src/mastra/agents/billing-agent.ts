/**
 * Billing Agent — tool mocks demo
 *
 * This agent exists to demonstrate item-level static tool mocks in Studio,
 * including mocking a delegated SUB-AGENT's response.
 *
 * It has two tools and one sub-agent:
 * - `getUserBalance` — read-only, safe to call during evals.
 * - `refundUser` — has a side effect: it adds to a user's in-memory balance,
 *   logs "💸 LIVE refund issued", and returns the new balance.
 * - `balanceAgent` (sub-agent) — the billing agent DELEGATES balance lookups to
 *   it. The sub-agent runs `lookupBalance` internally.
 *
 * Demo flow in Studio:
 * 1. Run an experiment against this agent WITHOUT mocks → the user's balance
 *    INCREASES across runs (real, persisted mutation) and the dev server
 *    console prints "💸 LIVE refund".
 * 2. Add a `refundUser` mock to the dataset item → re-run → the balance the
 *    agent reports is frozen at the mock's value, the real balance is never
 *    touched, and the tool mock report shows the call was served.
 *
 * Sub-agent mock:
 * - The billing agent delegates balance questions to the `balanceAgent`
 *   sub-agent, which is exposed to the parent as a tool named
 *   `agent-balanceAgent`.
 * - Mock that tool (toolName `agent-balanceAgent`) to mock the sub-agent's
 *   WHOLE response — the sub-agent and its inner `lookupBalance` tool never run.
 *   The mock output matches the agent-tool output shape: `{ "text": "..." }`.
 *
 * Workflow mock:
 * - The agent also has a `refundWorkflow`, exposed to the model as a tool named
 *   `workflow-refundWorkflow`. Workflow tools run through the same
 *   `beforeToolCall` boundary as any other tool, so they are mockable too.
 * - Mock that tool (toolName `workflow-refundWorkflow`) to skip the WHOLE
 *   workflow — its inner balance-agent call and refund side effect never run.
 *   Workflow tools take a `{ inputData, ... }` envelope, so use
 *   `matchArgs: 'ignore'` (toolName-only match) for a robust mock.
 */

import { Agent } from '@mastra/core/agent';

import { getUserBalance, lookupBalance, refundUser } from '../tools/billing-tools.js';
import { refundWorkflow } from '../workflows/refund-workflow.js';

/**
 * Sub-agent that answers balance questions. The billing agent delegates to it.
 * Registered on the parent under the key `balanceAgent`, so the parent's
 * delegation tool is named `agent-balanceAgent` — that's the name you mock.
 */
export const balanceAgent = new Agent({
  id: 'balance-agent',
  name: 'Balance Agent',
  description: "Sub-agent that looks up a user's account balance. Delegated to by the billing agent.",
  instructions: `You are a balance lookup specialist.
When asked for a user's balance, use lookupBalance with the user name and report the balance.
Always call the tool rather than guessing.`,
  model: 'openai/gpt-5.4-mini',
  tools: {
    lookupBalance,
  },
});

export const billingAgent = new Agent({
  id: 'billing-agent',
  name: 'Billing Agent',
  description: 'A support agent that refunds users by dollar amount. Used to demo item-level tool mocks.',
  instructions: `You are a billing support agent that handles user refunds and balance questions.

When a user asks to refund someone (e.g. "refund user YJ $100"):
1. Use refundUser with the user name and dollar amount.
2. Tell the user the refund was issued, include the refundId, and ALWAYS state the
   user's new balance returned by refundUser (the "newBalance" field).

When a user asks about a balance, DELEGATE to the balance-agent sub-agent — pass the
user's name in your delegation prompt and report the balance it returns. Do NOT look
up balances yourself; always hand off to the sub-agent.

You also have a refundWorkflow that performs the whole refund flow (balance lookup
+ refund) in one step. When a user explicitly asks to "run the refund workflow" for
someone, call refundWorkflow with their name and amount and report the resulting
newBalance and refundId.

Always call the tools/sub-agents/workflows rather than guessing balances.`,
  model: 'openai/gpt-5.4-mini',
  tools: {
    getUserBalance,
    refundUser,
  },
  agents: {
    balanceAgent,
  },
  workflows: {
    refundWorkflow,
  },
});
