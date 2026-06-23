import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

import { refundLedger, userBalances } from '../tools/billing-tools.js';

/**
 * A small refund workflow that mirrors the billing-agent demo, but as a
 * WORKFLOW the agent can call. When an agent has a workflow in its `workflows`
 * config, that workflow is exposed to the model as a tool named
 * `workflow-<workflowName>` and runs through the same `beforeToolCall` boundary
 * as any other tool — so it is mockable with item-level tool mocks.
 *
 * Demo flow in Studio:
 * 1. Run an experiment against the billing agent and have it call the refund
 *    workflow → balances mutate, console prints "💸 LIVE refund".
 * 2. Add a `workflow-refundWorkflow` mock to the dataset item → re-run → the
 *    workflow (and its inner agent + refund side effect) never runs, the mocked
 *    result is returned, and the tool mock report shows the call was served.
 *
 * Note: workflow tools receive a `{ inputData, initialState? }` envelope, so a
 * strict mock's `args` must match that envelope. For free-text/nested args,
 * `matchArgs: 'ignore'` (toolName-only) is usually the practical choice.
 */

const lookupBalanceStep = createStep({
  id: 'lookup-balance',
  description: "Ask the balance sub-agent for the user's current balance.",
  inputSchema: z.object({
    user: z.string().describe('The user to refund, e.g. "YJ"'),
    amount: z.number().describe('The refund amount in dollars'),
  }),
  outputSchema: z.object({
    user: z.string(),
    amount: z.number(),
    priorBalanceText: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const { user, amount } = inputData;
    const balanceAgent = mastra!.getAgent('balanceAgent');
    const { text } = await balanceAgent.generate(`What is ${user}'s current account balance?`);
    return { user, amount, priorBalanceText: text };
  },
});

const issueRefundStep = createStep({
  id: 'issue-refund',
  description: 'Issue the refund via the refundUser tool (has a side effect).',
  inputSchema: z.object({
    user: z.string(),
    amount: z.number(),
    priorBalanceText: z.string(),
  }),
  outputSchema: z.object({
    refundId: z.string(),
    user: z.string(),
    amount: z.number(),
    newBalance: z.number(),
    priorBalanceText: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { user, amount, priorBalanceText } = inputData;

    // Loud, irreversible side effect: mutate the persisted balance (mirrors the
    // refundUser tool). Mocking the workflow skips this entirely.
    const previous = userBalances[user] ?? 0;
    const newBalance = previous + amount;
    userBalances[user] = newBalance;

    const refundId = `refund_${Date.now()}`;
    refundLedger.push({ user, amount, refundId, at: new Date().toISOString() });
    console.log(
      `💸 LIVE refund (workflow): ${user} $${amount} — balance ${previous} → ${newBalance} (refundId=${refundId})`,
    );

    return { refundId, user, amount, newBalance, priorBalanceText };
  },
});

export const refundWorkflow = createWorkflow({
  id: 'refundWorkflow',
  description:
    'Refunds a user a dollar amount: looks up their balance via the balance sub-agent, then issues the refund. Has a side effect — mock this workflow during experiments to keep it deterministic.',
  inputSchema: z.object({
    user: z.string().describe('The user to refund, e.g. "YJ"'),
    amount: z.number().describe('The refund amount in dollars'),
  }),
  outputSchema: z.object({
    refundId: z.string(),
    user: z.string(),
    amount: z.number(),
    newBalance: z.number(),
    priorBalanceText: z.string(),
  }),
})
  .then(lookupBalanceStep)
  .then(issueRefundStep)
  .commit();
