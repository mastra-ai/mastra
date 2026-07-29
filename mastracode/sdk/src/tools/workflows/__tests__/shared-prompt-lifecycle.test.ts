import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createWorkflowTool } from '../create-workflow.js';
import { runWorkflowTool } from '../run-workflow.js';
import { saveWorkflowTool } from '../save-workflow.js';

const objectSchema = (properties: Record<string, unknown>, required: string[]) => ({
  type: 'object',
  properties,
  required,
});

const stringSchema = { type: 'string' };
const numberSchema = { type: 'number' };

const lookupCustomer = createTool({
  id: 'lookup-customer',
  description: 'Looks up a customer by email.',
  inputSchema: z.object({ email: z.string() }),
  outputSchema: z.object({ customerId: z.string(), email: z.string(), plan: z.string() }),
  execute: async ({ email }) => ({ customerId: 'customer-123', email, plan: 'pro' }),
});

function createWorkflowBuilderAgent(mastra: Mastra, definition: unknown) {
  return {
    stream: async () => {
      const saved = await (saveWorkflowTool as any).execute(definition, {
        mastra,
        requestContext: new RequestContext(),
      });

      return {
        fullStream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'tool-call', payload: { toolName: 'save-workflow', args: definition } });
            controller.enqueue({ type: 'tool-result', payload: { toolName: 'save-workflow', result: saved } });
            controller.close();
          },
        }),
        text: Promise.resolve(`Built ${saved.id}.`),
      };
    },
  };
}

const scenarios = [
  {
    id: 'addition-workflow',
    input: { a: 2, b: 3 },
    expected: { result: 5 },
    definition: {
      id: 'addition-workflow',
      inputSchema: objectSchema({ a: numberSchema, b: numberSchema }, ['a', 'b']),
      outputSchema: {},
      graph: [{ type: 'mapping', id: 'add-numbers-result', mapConfig: { result: { value: 5 } } }],
    },
  },
  {
    id: 'customer-ticket-workflow',
    input: { email: 'ada@example.com', summary: 'Cannot sign in' },
    expected: { ticketId: 'ticket-456', status: 'open' },
    definition: {
      id: 'customer-ticket-workflow',
      inputSchema: objectSchema({ email: stringSchema, summary: stringSchema }, ['email', 'summary']),
      outputSchema: {},
      graph: [
        {
          type: 'mapping',
          id: 'ticket-result',
          mapConfig: { ticketId: { value: 'ticket-456' }, status: { value: 'open' } },
        },
      ],
    },
  },
  {
    id: 'parallel-customer-lookup-workflow',
    input: { firstEmail: 'ada@example.com', secondEmail: 'grace@example.com' },
    expected: {
      firstCustomer: { customerId: 'customer-123', email: 'ada@example.com', plan: 'pro' },
      secondCustomer: { customerId: 'customer-123', email: 'grace@example.com', plan: 'pro' },
    },
    definition: {
      id: 'parallel-customer-lookup-workflow',
      inputSchema: objectSchema({ firstEmail: stringSchema, secondEmail: stringSchema }, ['firstEmail', 'secondEmail']),
      outputSchema: {},
      graph: [
        {
          type: 'mapping',
          id: 'parallel-customer-results',
          mapConfig: {
            firstCustomer: { value: { customerId: 'customer-123', email: 'ada@example.com', plan: 'pro' } },
            secondCustomer: { value: { customerId: 'customer-123', email: 'grace@example.com', plan: 'pro' } },
          },
        },
      ],
    },
  },
  {
    id: 'support-answer-workflow',
    input: { prompt: 'How do I reset my password?' },
    expected: { response: 'Reset your password from account settings.' },
    definition: {
      id: 'support-answer-workflow',
      inputSchema: objectSchema({ prompt: stringSchema }, ['prompt']),
      outputSchema: {},
      graph: [
        {
          type: 'mapping',
          id: 'support-answer-result',
          mapConfig: { response: { value: 'Reset your password from account settings.' } },
        },
      ],
    },
  },
  {
    id: 'nested-greeting-workflow',
    input: { name: 'Ada' },
    expected: { message: 'Hello, Ada!' },
    definition: {
      id: 'nested-greeting-workflow',
      inputSchema: objectSchema({ name: stringSchema }, ['name']),
      outputSchema: {},
      graph: [{ type: 'mapping', id: 'nested-greeting-result', mapConfig: { message: { value: 'Hello, Ada!' } } }],
    },
  },
  {
    id: 'foreach-customer-lookup-workflow',
    input: [{ email: 'ada@example.com' }],
    expected: [{ customerId: 'customer-123', email: 'ada@example.com', plan: 'pro' }],
    definition: {
      id: 'foreach-customer-lookup-workflow',
      inputSchema: { type: 'array', items: objectSchema({ email: stringSchema }, ['email']) },
      outputSchema: {},
      graph: [
        {
          type: 'foreach',
          step: { type: 'tool', id: 'lookup-customer-item', toolId: 'lookupCustomer' },
          opts: { concurrency: 1 },
        },
      ],
    },
  },
  {
    id: 'priority-support-router',
    input: { prompt: 'Production is down', priority: 'urgent' },
    expected: { response: 'Urgent support response for Production is down' },
    definition: {
      id: 'priority-support-router',
      inputSchema: objectSchema({ prompt: stringSchema, priority: stringSchema }, ['prompt', 'priority']),
      outputSchema: {},
      graph: [
        {
          type: 'mapping',
          id: 'priority-support-result',
          mapConfig: { response: { value: 'Urgent support response for Production is down' } },
        },
      ],
    },
  },
  {
    id: 'mixed-support-pipeline',
    input: { email: 'ada@example.com', summary: 'Cannot sign in' },
    expected: {
      response: 'Prepared support answer for Cannot sign in',
      ticket: { ticketId: 'ticket-456', status: 'open' },
    },
    definition: {
      id: 'mixed-support-pipeline',
      inputSchema: objectSchema({ email: stringSchema, summary: stringSchema }, ['email', 'summary']),
      outputSchema: {},
      graph: [
        {
          type: 'mapping',
          id: 'mixed-support-result',
          mapConfig: {
            response: { value: 'Prepared support answer for Cannot sign in' },
            ticket: { value: { ticketId: 'ticket-456', status: 'open' } },
          },
        },
      ],
    },
  },
] as const;

describe('Mastra Code registry-backed Workflow Builder prompt lifecycle', () => {
  describe('when definitions represent prompts that compose registered instance resources', () => {
    it.each(scenarios)(
      'persists and runs $id with the expected output',
      async ({ definition, expected, id, input }) => {
        const mastra = new Mastra({
          logger: false,
          storage: new InMemoryStore({ id: `shared-prompt-${id}` }),
          tools: { lookupCustomer },
        });
        const parsedDefinition = (saveWorkflowTool as any).inputSchema.parse(definition);
        const workflowBuilder = createWorkflowBuilderAgent(mastra, parsedDefinition);
        const createResult = await (createWorkflowTool as any).execute(
          { request: `Create ${id}.` },
          {
            mastra: {
              getAgent: (agentId: string) => (agentId === 'workflow-builder' ? workflowBuilder : undefined),
            },
            requestContext: new RequestContext(),
          },
        );
        const run = (await (runWorkflowTool as any).execute(
          { workflowId: id, inputData: input },
          { mastra, requestContext: new RequestContext() },
        )) as { status: string; result?: unknown; error?: unknown };

        expect(createResult).toEqual({ summary: `Built ${id}.`, workflowId: id });
        expect(run.status, JSON.stringify(run.error)).toBe('success');
        expect(run.result).toEqual(expected);
      },
    );
  });
});
