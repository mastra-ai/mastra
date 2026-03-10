import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

import { createSandboxToken, getAccountBalance, getTransactions } from '../tools/plaid';

export const financeAgent = new Agent({
  id: 'finance-agent',
  name: 'Finance Agent',
  instructions:
    "You are a personal finance assistant. Use the Plaid tools to help users check account balances and transaction history. If the user doesn't have a Plaid session handle, use createSandboxToken first to generate one. Present all financial data clearly.",
  model: openai('gpt-5.4'),
  tools: {
    createSandboxToken,
    getAccountBalance,
    getTransactions,
  },
});
