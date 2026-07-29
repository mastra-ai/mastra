import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const weatherInfo = createTool({
  id: 'weatherInfo',
  description: 'Get current weather for a location',
  inputSchema: z.object({
    location: z.string().describe('City name'),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    feelsLike: z.number(),
    humidity: z.number(),
    windSpeed: z.number(),
    windGust: z.number(),
    conditions: z.string(),
    location: z.string(),
  }),
  execute: async input => {
    return await getWeather(input.location);
  },
});

const getWeather = async (location: string) => {
  return {
    temperature: 19,
    feelsLike: 18,
    humidity: 50,
    windSpeed: 10,
    windGust: 14,
    conditions: 'Clear sky',
    location,
  };
};

export const simpleMcpTool = createTool({
  id: 'simpleMcpTool',
  description: 'A simple MCP tool',
  inputSchema: z.object({
    name: z.string().describe('The name of the person'),
  }),
  execute: async () => {
    return {
      hello: 'world',
      thisIsA: 'fixture',
    };
  },
});

export const lookupCustomer = createTool({
  id: 'lookup-customer',
  description: 'Look up a customer by email for Workflow Builder comparison tests',
  inputSchema: z.object({ email: z.string() }),
  outputSchema: z.object({
    customerId: z.string(),
    email: z.string(),
    plan: z.string(),
  }),
  execute: async ({ email }) => ({
    customerId: 'customer-123',
    email,
    plan: 'pro',
  }),
});

export const urgentSupport = createTool({
  id: 'urgent-support',
  description: 'Produce a deterministic response for urgent support workflows',
  inputSchema: z.object({ prompt: z.string(), priority: z.string() }),
  outputSchema: z.object({ response: z.string() }),
  execute: async () => ({ response: 'Production incident response started.' }),
});

export const addNumbers = createTool({
  id: 'add-numbers',
  description: 'Add two numbers for Workflow Builder comparison tests',
  inputSchema: z.object({ a: z.number(), b: z.number() }),
  outputSchema: z.object({ result: z.number() }),
  execute: async ({ a, b }) => ({ result: a + b }),
});

export const createSupportTicket = createTool({
  id: 'create-support-ticket',
  description: 'Create a support ticket for Workflow Builder comparison tests',
  inputSchema: z.object({ customerId: z.string(), summary: z.string() }),
  outputSchema: z.object({ ticketId: z.string(), status: z.string() }),
  execute: async () => ({ ticketId: 'ticket-456', status: 'open' }),
});
