import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { convertArrayToReadableStream, MockLanguageModelV3 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { runWorkflow } from '../../../workflows/service.js';
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
const arraySchema = (items: Record<string, unknown>) => ({ type: 'array', items });
const customerSchema = objectSchema({ customerId: stringSchema, email: stringSchema, plan: stringSchema }, [
  'customerId',
  'email',
  'plan',
]);
const ticketSchema = objectSchema({ ticketId: stringSchema, status: stringSchema }, ['ticketId', 'status']);
const fromStep = (step: string | string[], path: string) => ({ step, path });
const fromInput = (path: string) => ({ initData: true, path });

const addNumbers = createTool({
  id: 'add-numbers',
  description: 'Adds two numbers.',
  inputSchema: z.object({ a: z.number(), b: z.number() }),
  outputSchema: z.object({ result: z.number() }),
  execute: async ({ a, b }) => ({ result: a + b }),
});

const lookupCustomer = createTool({
  id: 'lookup-customer',
  description: 'Looks up a customer by email.',
  inputSchema: z.object({ email: z.string() }),
  outputSchema: z.object({ customerId: z.string(), email: z.string(), plan: z.string() }),
  execute: async ({ email }) => ({ customerId: 'customer-123', email, plan: 'pro' }),
});

const createSupportTicket = createTool({
  id: 'create-support-ticket',
  description: 'Creates a support ticket.',
  inputSchema: z.object({ customerId: z.string(), summary: z.string() }),
  outputSchema: z.object({ ticketId: z.string(), status: z.string() }),
  execute: async () => ({ ticketId: 'ticket-456', status: 'open' }),
});

const supportResponse = (prompt: unknown) => {
  const serializedPrompt = JSON.stringify(prompt);
  return serializedPrompt.includes('Production is down')
    ? 'Urgent support response for Production is down'
    : serializedPrompt.includes('Cannot sign in')
      ? 'Prepared support answer for Cannot sign in'
      : 'Reset your password from account settings.';
};

const modelUsage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

const supportAgent = new Agent({
  id: 'support-agent',
  name: 'Support Agent',
  instructions: 'Answer support questions.',
  model: new MockLanguageModelV3({
    doGenerate: async ({ prompt }) => ({
      content: [{ type: 'text', text: supportResponse(prompt) }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: modelUsage,
      warnings: [],
    }),
    doStream: async ({ prompt }) => {
      const text = supportResponse(prompt);
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'support-response', modelId: 'support-model', timestamp: new Date(0) },
          { type: 'text-start', id: 'support-text' },
          { type: 'text-delta', id: 'support-text', delta: text },
          { type: 'text-end', id: 'support-text' },
          { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage: modelUsage },
        ]),
      };
    },
  }),
});

const buildGreeting = createStep({
  id: 'build-greeting',
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ message: z.string() }),
  execute: async ({ inputData }) => ({ message: `Hello, ${inputData.name}!` }),
});

const greetingWorkflow = createWorkflow({
  id: 'greeting-workflow',
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ message: z.string() }),
})
  .then(buildGreeting)
  .commit();

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

// Both branches call support-agent, per the prompt. support-agent replies with a
// fixed string, so the workflow output cannot reveal which branch ran — the
// scenario asserts the routing decision from step results instead.
const priorityRouterDefinition = (id: string) => ({
  id,
  inputSchema: objectSchema({ prompt: stringSchema, priority: stringSchema }, ['prompt', 'priority']),
  outputSchema: objectSchema({ response: stringSchema }, ['response']),
  graph: [
    {
      type: 'mapping',
      id: 'route-input',
      mapConfig: { prompt: fromInput('prompt') },
    },
    {
      type: 'conditional',
      steps: [
        { type: 'agent', id: 'urgent-support', agentId: 'support-agent' },
        { type: 'agent', id: 'normal-support', agentId: 'support-agent' },
      ],
      predicates: [
        { op: 'eq', left: { path: 'initData.priority' }, right: { literal: 'urgent' } },
        { op: 'ne', left: { path: 'initData.priority' }, right: { literal: 'urgent' } },
      ],
    },
    {
      type: 'mapping',
      id: 'priority-support-result',
      mapConfig: { response: fromStep(['urgent-support', 'normal-support'], 'text') },
    },
  ],
});

const scenarios = [
  {
    id: 'addition-workflow',
    input: { a: 2, b: 3 },
    expected: { result: 5 },
    definition: {
      id: 'addition-workflow',
      inputSchema: objectSchema({ a: numberSchema, b: numberSchema }, ['a', 'b']),
      outputSchema: objectSchema({ result: numberSchema }, ['result']),
      graph: [
        { type: 'tool', id: 'add-numbers-step', toolId: 'addNumbers' },
        {
          type: 'mapping',
          id: 'add-numbers-result',
          mapConfig: { result: fromStep('add-numbers-step', 'result') },
        },
      ],
    },
  },
  {
    id: 'customer-ticket-workflow',
    input: { email: 'ada@example.com', summary: 'Cannot sign in' },
    expected: { ticketId: 'ticket-456', status: 'open' },
    definition: {
      id: 'customer-ticket-workflow',
      inputSchema: objectSchema({ email: stringSchema, summary: stringSchema }, ['email', 'summary']),
      outputSchema: ticketSchema,
      graph: [
        { type: 'tool', id: 'lookup-customer-step', toolId: 'lookupCustomer' },
        {
          type: 'mapping',
          id: 'ticket-input',
          mapConfig: {
            customerId: fromStep('lookup-customer-step', 'customerId'),
            summary: fromInput('summary'),
          },
        },
        { type: 'tool', id: 'create-ticket-step', toolId: 'createSupportTicket' },
        {
          type: 'mapping',
          id: 'ticket-result',
          mapConfig: {
            ticketId: fromStep('create-ticket-step', 'ticketId'),
            status: fromStep('create-ticket-step', 'status'),
          },
        },
      ],
    },
  },
  // Exercises a real `parallel` container: both children receive the same
  // preceding object, so the workflow input must satisfy both child schemas.
  //
  // This deliberately does NOT model "look up two different emails in parallel".
  // Container children cannot carry per-child input mappings, so fanning one
  // input out to two differently-shaped branch inputs is not expressible in the
  // portable contract. Do not "fix" that by replacing this container with a
  // mapping that hardcodes branch outputs — that asserts nothing about parallel.
  {
    id: 'parallel-support-fanout-workflow',
    input: { email: 'ada@example.com', customerId: 'customer-999', summary: 'Cannot log in' },
    expected: {
      customer: { customerId: 'customer-123', email: 'ada@example.com', plan: 'pro' },
      ticket: { ticketId: 'ticket-456', status: 'open' },
    },
    definition: {
      id: 'parallel-support-fanout-workflow',
      inputSchema: objectSchema({ email: stringSchema, customerId: stringSchema, summary: stringSchema }, [
        'email',
        'customerId',
        'summary',
      ]),
      outputSchema: objectSchema({ customer: customerSchema, ticket: ticketSchema }, ['customer', 'ticket']),
      graph: [
        {
          type: 'parallel',
          steps: [
            { type: 'tool', id: 'lookup-customer-branch', toolId: 'lookupCustomer' },
            { type: 'tool', id: 'create-ticket-branch', toolId: 'createSupportTicket' },
          ],
        },
        {
          type: 'mapping',
          id: 'parallel-customer-results',
          mapConfig: {
            customer: fromStep('lookup-customer-branch', ''),
            ticket: fromStep('create-ticket-branch', ''),
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
      outputSchema: objectSchema({ response: stringSchema }, ['response']),
      graph: [
        { type: 'agent', id: 'support-agent-step', agentId: 'support-agent' },
        {
          type: 'mapping',
          id: 'support-answer-result',
          mapConfig: { response: fromStep('support-agent-step', 'text') },
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
      outputSchema: objectSchema({ message: stringSchema }, ['message']),
      graph: [
        { type: 'workflow', id: 'invoke-greeting', workflowId: 'greetingWorkflow' },
        {
          type: 'mapping',
          id: 'nested-greeting-result',
          mapConfig: { message: fromStep('invoke-greeting', 'message') },
        },
      ],
    },
  },
  {
    id: 'foreach-customer-lookup-workflow',
    input: [{ email: 'ada@example.com' }],
    expected: [{ customerId: 'customer-123', email: 'ada@example.com', plan: 'pro' }],
    definition: {
      id: 'foreach-customer-lookup-workflow',
      inputSchema: arraySchema(objectSchema({ email: stringSchema }, ['email'])),
      outputSchema: arraySchema(customerSchema),
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
    // Proves the urgent predicate selected branch 0; the non-urgent branch must
    // not have run.
    expectedBranch: { ran: 'urgent-support', skipped: 'normal-support' },
    definition: priorityRouterDefinition('priority-support-router'),
  },
  {
    id: 'priority-support-router-normal-route',
    input: { prompt: 'Production is down', priority: 'low' },
    // Same prompt and same agent as the urgent case, so only the branch
    // assertion distinguishes this from the urgent route.
    expected: { response: 'Urgent support response for Production is down' },
    expectedBranch: { ran: 'normal-support', skipped: 'urgent-support' },
    definition: priorityRouterDefinition('priority-support-router-normal-route'),
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
      outputSchema: objectSchema({ response: stringSchema, ticket: ticketSchema }, ['response', 'ticket']),
      graph: [
        { type: 'tool', id: 'lookup-customer-step', toolId: 'lookupCustomer' },
        {
          type: 'mapping',
          id: 'agent-input',
          mapConfig: { prompt: { template: 'Prepare a support answer for ${initData.summary}' } },
        },
        { type: 'agent', id: 'support-agent-step', agentId: 'support-agent' },
        {
          type: 'mapping',
          id: 'ticket-input',
          mapConfig: {
            customerId: fromStep('lookup-customer-step', 'customerId'),
            summary: fromInput('summary'),
          },
        },
        { type: 'tool', id: 'create-ticket-step', toolId: 'createSupportTicket' },
        {
          type: 'mapping',
          id: 'mixed-support-result',
          mapConfig: {
            response: fromStep('support-agent-step', 'text'),
            ticket: fromStep('create-ticket-step', ''),
          },
        },
      ],
    },
  },
] as const;

describe('Mastra Code registry-backed Workflow Builder prompt lifecycle', () => {
  describe('when definitions represent prompts that compose registered instance resources', () => {
    it.each(scenarios)('persists and runs $id with the expected output', async scenario => {
      const { definition, expected, id, input } = scenario;
      const expectedBranch = 'expectedBranch' in scenario ? scenario.expectedBranch : undefined;
      const mastra = new Mastra({
        logger: false,
        storage: new InMemoryStore({ id: `shared-prompt-${id}` }),
        agents: { supportAgent },
        tools: { addNumbers, lookupCustomer, createSupportTicket },
        workflows: { greetingWorkflow },
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

      if (expectedBranch) {
        // Rerun through the service so per-step events are observable; the
        // output alone cannot show which conditional branch was selected.
        const startedSteps: string[] = [];
        await runWorkflow(mastra, id, input, new RequestContext(), event => {
          if (event.type === 'workflow-step-start') {
            startedSteps.push(String((event.payload as { id?: unknown } | undefined)?.id));
          }
        });

        expect(startedSteps, `executed steps: ${startedSteps.join(', ')}`).toContain(expectedBranch.ran);
        expect(startedSteps, `executed steps: ${startedSteps.join(', ')}`).not.toContain(expectedBranch.skipped);
      }
    });
  });
});
