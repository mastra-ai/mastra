import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { MnemoPayLite } from '@mnemopay/sdk';

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

const memorySchema = z.object({
  id: z.string().describe('Unique memory identifier'),
  content: z.string().describe('Memory content text'),
  importance: z.number().describe('Importance score 0-1'),
  tags: z.array(z.string()).describe('Associated tags'),
  timestamp: z.number().describe('Unix timestamp of creation'),
});

const balanceSchema = z.object({
  wallet: z.number().describe('Current wallet balance'),
  reputation: z.number().describe('Current reputation score'),
});

// ---------------------------------------------------------------------------
// Tool: mnemopay_remember
// ---------------------------------------------------------------------------

export function createRememberTool(agent: MnemoPayLite) {
  return createTool({
    id: 'mnemopay_remember',
    description:
      'Store a memory in the agent\'s economic memory. Use this to record experiences with providers, payment outcomes, service quality, or any observation the agent should learn from.',
    inputSchema: z.object({
      content: z.string().describe('The memory content to store — a natural language observation or fact'),
      importance: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .default(0.5)
        .describe('How important this memory is (0 = trivial, 1 = critical). Defaults to 0.5'),
      tags: z
        .array(z.string())
        .optional()
        .default([])
        .describe('Tags for categorization, e.g. ["provider", "quality", "refund"]'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      memory: memorySchema,
    }),
    execute: async (input) => {
      const memory = await agent.remember(input.content, {
        importance: input.importance,
        tags: input.tags,
      });
      return { success: true, memory };
    },
  });
}

// ---------------------------------------------------------------------------
// Tool: mnemopay_recall
// ---------------------------------------------------------------------------

export function createRecallTool(agent: MnemoPayLite) {
  return createTool({
    id: 'mnemopay_recall',
    description:
      'Search and retrieve relevant memories. Use this before making payment decisions to recall past experiences with providers, historical pricing, or quality assessments.',
    inputSchema: z.object({
      query: z.string().describe('Natural language search query, e.g. "reliable providers" or "past refunds"'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .default(5)
        .describe('Maximum number of memories to return. Defaults to 5'),
    }),
    outputSchema: z.object({
      memories: z.array(memorySchema),
      count: z.number(),
    }),
    execute: async (input) => {
      const memories = await agent.recall(input.query, input.limit);
      return { memories, count: memories.length };
    },
  });
}

// ---------------------------------------------------------------------------
// Tool: mnemopay_charge
// ---------------------------------------------------------------------------

export function createChargeTool(agent: MnemoPayLite) {
  return createTool({
    id: 'mnemopay_charge',
    description:
      'Initiate a payment transaction. Creates a pending charge that must later be settled or refunded. The outcome affects the agent\'s reputation score.',
    inputSchema: z.object({
      amount: z.number().positive().describe('Payment amount in the base currency unit'),
      description: z.string().describe('Human-readable description of what this payment is for'),
    }),
    outputSchema: z.object({
      transactionId: z.string().describe('Unique transaction ID — use this to settle or refund later'),
      amount: z.number(),
      status: z.string(),
    }),
    execute: async (input) => {
      const transactionId = await agent.charge(input.amount, input.description);
      return {
        transactionId,
        amount: input.amount,
        status: 'pending',
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Tool: mnemopay_settle
// ---------------------------------------------------------------------------

export function createSettleTool(agent: MnemoPayLite) {
  return createTool({
    id: 'mnemopay_settle',
    description:
      'Settle a pending transaction, confirming the payment was successful. This positively reinforces the agent\'s reputation — the agent learns that this type of transaction went well.',
    inputSchema: z.object({
      transactionId: z.string().describe('The transaction ID returned by mnemopay_charge'),
    }),
    outputSchema: z.object({
      settled: z.boolean(),
      transactionId: z.string(),
      reputationDelta: z.number().describe('How much the reputation changed (positive)'),
    }),
    execute: async (input) => {
      await agent.settle(input.transactionId);
      return {
        settled: true,
        transactionId: input.transactionId,
        reputationDelta: agent.reputationStep ?? 0.05,
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Tool: mnemopay_refund
// ---------------------------------------------------------------------------

export function createRefundTool(agent: MnemoPayLite) {
  return createTool({
    id: 'mnemopay_refund',
    description:
      'Refund a pending transaction, indicating the payment should be reversed. This negatively impacts the agent\'s reputation — the agent learns to avoid similar transactions in the future.',
    inputSchema: z.object({
      transactionId: z.string().describe('The transaction ID returned by mnemopay_charge'),
    }),
    outputSchema: z.object({
      refunded: z.boolean(),
      transactionId: z.string(),
      reputationDelta: z.number().describe('How much the reputation changed (negative)'),
    }),
    execute: async (input) => {
      await agent.refund(input.transactionId);
      return {
        refunded: true,
        transactionId: input.transactionId,
        reputationDelta: -(agent.reputationStep ?? 0.05),
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Tool: mnemopay_balance
// ---------------------------------------------------------------------------

export function createBalanceTool(agent: MnemoPayLite) {
  return createTool({
    id: 'mnemopay_balance',
    description:
      'Check the agent\'s current wallet balance and reputation score. Use this to make informed decisions about whether to proceed with a transaction.',
    inputSchema: z.object({}),
    outputSchema: balanceSchema,
    execute: async () => {
      return agent.balance();
    },
  });
}

// ---------------------------------------------------------------------------
// Tool: mnemopay_profile
// ---------------------------------------------------------------------------

export function createProfileTool(agent: MnemoPayLite) {
  return createTool({
    id: 'mnemopay_profile',
    description:
      'Get the full agent profile including ID, balance, reputation, and summary statistics. Useful for dashboards or when reporting agent status.',
    inputSchema: z.object({}),
    outputSchema: z.object({
      agentId: z.string(),
      wallet: z.number(),
      reputation: z.number(),
      reputationStep: z.number().describe('How much reputation changes per settle/refund'),
    }),
    execute: async () => {
      const bal = agent.balance();
      return {
        agentId: (agent as any).agentId ?? 'unknown',
        wallet: bal.wallet,
        reputation: bal.reputation,
        reputationStep: agent.reputationStep ?? 0.05,
      };
    },
  });
}
