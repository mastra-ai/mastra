/**
 * A tool for the agent under evaluation, and a knob to make it misbehave.
 *
 * Exercise 10 is about tool mocking, and mocking is uninteresting unless the
 * real tool is genuinely a problem. So this one is deliberately a problem in
 * the way real tools are: it reads mutable state that lives outside the test.
 *
 * `setAccountUsage()` is the knob. It stands in for every reason a production
 * dependency returns something different today than it did yesterday — a row
 * changed, a cache expired, someone ran a migration, the account actually got
 * used. Nothing about the agent changes when you turn it, and every unmocked
 * eval that touches it moves anyway.
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

type Account = {
  plan: string;
  storageUsedGb: number;
  storageLimitGb: number;
};

/** The "production database". Mutable on purpose — see setAccountUsage. */
const ACCOUNTS: Record<string, Account> = {
  'acct-42': { plan: 'Free', storageUsedGb: 11.2, storageLimitGb: 15 },
};

/**
 * Change what the tool will report next time it is called.
 *
 * Used by exercise 10 to run the same eval twice against "different production
 * data" without touching the agent, which is the entire argument for mocks.
 */
export function setAccountUsage(accountId: string, storageUsedGb: number): void {
  const account = ACCOUNTS[accountId];
  if (!account) throw new Error(`unknown account: ${accountId}`);
  account.storageUsedGb = storageUsedGb;
}

/** Reset to the value the workshop's expected answers were written against. */
export function resetAccounts(): void {
  ACCOUNTS['acct-42'] = { plan: 'Free', storageUsedGb: 11.2, storageLimitGb: 15 };
}

/** Counts real executions, so an exercise can prove a mock was served instead. */
export let liveToolCallCount = 0;
export function resetLiveToolCallCount(): void {
  liveToolCallCount = 0;
}

export const lookupAccount = createTool({
  id: 'lookupAccount',
  description: "Look up a Nimbus customer's plan and current storage usage.",
  inputSchema: z.object({
    accountId: z.string().describe('The customer account id, e.g. acct-42'),
  }),
  outputSchema: z.object({
    plan: z.string(),
    storageUsedGb: z.number(),
    storageLimitGb: z.number(),
  }),
  execute: async input => {
    liveToolCallCount += 1;
    const account = ACCOUNTS[input.accountId];
    if (!account) throw new Error(`unknown account: ${input.accountId}`);
    // Returned by value — the mock in the dataset item is a snapshot of this.
    return { ...account };
  },
});
