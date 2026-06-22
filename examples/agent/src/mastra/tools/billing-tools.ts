import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * In-memory user account balances, keyed by user name.
 *
 * This is the persisted state that makes the tool-mocks demo visible: every
 * LIVE `refundUser` call adds to `userBalances[user]`, so the agent can report
 * a balance that *increases* across runs. A MOCKED run never touches this
 * state, so the real balance stays put — that's the contrast the demo shows.
 */
export const userBalances: Record<string, number> = {
  YJ: 0,
  Ada: 0,
  Alan: 0,
};

/**
 * In-memory refund ledger — append-only log of refunds that actually executed.
 * A loud, secondary side effect alongside the balance mutation.
 */
export const refundLedger: Array<{ user: string; amount: number; refundId: string; at: string }> = [];

export const getUserBalance = createTool({
  id: 'getUserBalance',
  description: 'Get a user\'s current account balance by name. Read-only; safe to call during evals.',
  inputSchema: z.object({
    user: z.string().describe('The user name, e.g. "YJ"'),
  }),
  outputSchema: z.object({
    user: z.string(),
    balance: z.number(),
  }),
  execute: async ({ user }) => {
    const balance = userBalances[user];
    if (balance === undefined) {
      throw new Error(`User '${user}' not found`);
    }
    return { user, balance };
  },
});

/**
 * Read-only balance lookup used by the `balanceAgent` sub-agent.
 *
 * This is the tool that runs INSIDE the sub-agent on a live delegation. When you
 * mock the sub-agent's response (the `agent-balanceAgent` tool), this tool never
 * runs — the sub-agent is skipped entirely as a black box.
 */
export const lookupBalance = createTool({
  id: 'lookupBalance',
  description: 'Look up a user\'s current account balance by name. Read-only.',
  inputSchema: z.object({
    user: z.string().describe('The user name, e.g. "YJ"'),
  }),
  outputSchema: z.object({
    user: z.string(),
    balance: z.number(),
  }),
  execute: async ({ user }) => {
    const balance = userBalances[user];
    if (balance === undefined) {
      throw new Error(`User '${user}' not found`);
    }
    console.log(`🔎 LIVE balance lookup (sub-agent): ${user} → $${balance}`);
    return { user, balance };
  },
});

export const refundUser = createTool({
  id: 'refundUser',
  description:
    'Refund a user a dollar amount. THIS HAS A SIDE EFFECT: it subtracts the amount from the user\'s account balance and records the refund. Mock this tool during experiments to keep it deterministic.',
  inputSchema: z.object({
    user: z.string().describe('The user to refund, e.g. "YJ"'),
    amount: z.number().describe('The refund amount in dollars'),
  }),
  outputSchema: z.object({
    refundId: z.string(),
    user: z.string(),
    amount: z.number(),
    newBalance: z.number().describe('The user\'s account balance after this refund'),
  }),
  execute: async ({ user, amount }) => {
    // Loud, irreversible side effect: mutate the persisted balance.
    const previous = userBalances[user] ?? 0;
    const newBalance = previous + amount;
    userBalances[user] = newBalance;

    const refundId = `refund_${Date.now()}`;
    refundLedger.push({ user, amount, refundId, at: new Date().toISOString() });
    console.log(
      `💸 LIVE refund issued: ${user} $${amount} — balance ${previous} → ${newBalance} (refundId=${refundId})`,
    );
    return { refundId, user, amount, newBalance };
  },
});
