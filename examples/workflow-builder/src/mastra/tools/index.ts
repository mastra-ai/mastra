import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const lookupCustomer = createTool({
  id: 'lookup-customer',
  description: 'Looks up a customer by email address.',
  inputSchema: z.object({ email: z.string().email() }),
  outputSchema: z.object({
    customerId: z.string(),
    email: z.string(),
    plan: z.enum(['free', 'pro', 'enterprise']),
  }),
  execute: async ({ email }) => ({
    customerId: 'customer-123',
    email,
    plan: 'pro' as const,
  }),
});

export const addNumbers = createTool({
  id: 'add-numbers',
  description: 'Adds two numbers and returns their sum. Use this tool when a workflow needs arithmetic.',
  inputSchema: z.object({
    a: z.number(),
    b: z.number(),
  }),
  outputSchema: z.object({
    result: z.number(),
  }),
  execute: async ({ a, b }) => ({ result: a + b }),
});

export const createSupportTicket = createTool({
  id: 'create-support-ticket',
  description: 'Creates a support ticket for a customer.',
  inputSchema: z.object({
    customerId: z.string(),
    summary: z.string(),
  }),
  outputSchema: z.object({
    ticketId: z.string(),
    status: z.literal('open'),
  }),
  execute: async () => ({
    ticketId: 'ticket-456',
    status: 'open' as const,
  }),
});
