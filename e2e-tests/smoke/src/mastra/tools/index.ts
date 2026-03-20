import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const calculatorTool = createTool({
  id: 'calculator',
  description: 'Performs basic arithmetic operations',
  inputSchema: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number(),
    b: z.number(),
  }),
  outputSchema: z.object({
    result: z.number(),
  }),
  execute: async (data) => {
    switch (data.operation) {
      case 'add':
        return { result: data.a + data.b };
      case 'subtract':
        return { result: data.a - data.b };
      case 'multiply':
        return { result: data.a * data.b };
      case 'divide':
        if (data.b === 0) throw new Error('Division by zero');
        return { result: data.a / data.b };
    }
  },
});

export const stringTool = createTool({
  id: 'string-transform',
  description: 'Transforms strings in various ways',
  inputSchema: z.object({
    text: z.string(),
    transform: z.enum(['upper', 'lower', 'reverse', 'length']),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
  execute: async (data) => {
    switch (data.transform) {
      case 'upper':
        return { result: data.text.toUpperCase() };
      case 'lower':
        return { result: data.text.toLowerCase() };
      case 'reverse':
        return { result: data.text.split('').reverse().join('') };
      case 'length':
        return { result: String(data.text.length) };
    }
  },
});

export const failingTool = createTool({
  id: 'always-fails',
  description: 'A tool that always throws an error',
  inputSchema: z.object({
    message: z.string(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
  execute: async (data) => {
    throw new Error(`Tool error: ${data.message}`);
  },
});

export const approvalTool = createTool({
  id: 'needs-approval',
  description: 'A tool that requires user approval before executing. Returns a greeting.',
  inputSchema: z.object({
    name: z.string(),
  }),
  outputSchema: z.object({
    greeting: z.string(),
  }),
  requireApproval: true,
  execute: async (data) => {
    return { greeting: `Hello, ${data.name}!` };
  },
});

export const noInputTool = createTool({
  id: 'timestamp',
  description: 'Returns the current timestamp with no input required',
  outputSchema: z.object({
    timestamp: z.number(),
    iso: z.string(),
  }),
  execute: async () => {
    const now = Date.now();
    return { timestamp: now, iso: new Date(now).toISOString() };
  },
});
