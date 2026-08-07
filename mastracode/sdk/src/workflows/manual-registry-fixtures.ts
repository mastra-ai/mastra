// TODO: DELETE THIS FILE BEFORE MERGE.
//
// These are hand-registered fixtures used only to validate the Workflow Builder
// against a known set of agents/tools/workflows while iterating on the feature
// branch. They are not product code and must not ship. Removing this file also
// requires reverting the registrations in `register-primitives.ts`.
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

export const addNumbers = createTool({
  id: 'add-numbers',
  description: 'Adds two numbers and returns their sum.',
  inputSchema: z.object({ a: z.number(), b: z.number() }),
  outputSchema: z.object({ result: z.number() }),
  execute: async ({ a, b }) => ({ result: a + b }),
});

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

export const supportAgent = new Agent({
  id: 'support-agent',
  name: 'Support Agent',
  instructions: 'Answer support questions concisely and return clear next steps.',
  model: openai('gpt-4o-mini'),
});

const formatGreeting = createStep({
  id: 'format-greeting',
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ message: z.string() }),
  execute: async ({ inputData }) => ({ message: `Hello, ${inputData.name}!` }),
});

export const greetingWorkflow = createWorkflow({
  id: 'greeting-workflow',
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ message: z.string() }),
})
  .then(formatGreeting)
  .commit();
