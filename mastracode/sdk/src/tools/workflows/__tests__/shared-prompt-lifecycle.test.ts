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
import { createWorkflowBuilderAgentStub } from './workflow-builder-agent-stub.js';

const objectSchema = (properties: Record<string, unknown>, required: string[]) => ({
  type: 'object',
  properties,
  required,
});

// `additionalProperties: false` is the point of the strict scenarios: it is the
// one schema construct the rest of the suite never emits, so these cover a
// closed schema surviving authoring, persistence, and execution.
//
// Scope, verified by falsification: an extra input property is NOT rejected at
// run time — the run still succeeds. So these prove the closed schema round
// trips and stays runnable, not that it is enforced as an input guard.
const strictObjectSchema = (properties: Record<string, unknown>, required: string[]) => ({
  ...objectSchema(properties, required),
  additionalProperties: false,
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

// Emits a fixed JSON payload for every call. Used by the structured-output
// agents below, which differ only in what that payload contains.
const jsonAgent = (id: string, name: string, instructions: string, payload: string) =>
  new Agent({
    id,
    name,
    instructions,
    model: new MockLanguageModelV3({
      doGenerate: async () => ({
        content: [{ type: 'text', text: payload }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: modelUsage,
        warnings: [],
      }),
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id, modelId: `${id}-model`, timestamp: new Date(0) },
          { type: 'text-start', id: `${id}-text` },
          { type: 'text-delta', id: `${id}-text`, delta: payload },
          { type: 'text-end', id: `${id}-text` },
          { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage: modelUsage },
        ]),
      }),
    }),
  });

// A root-level array `outputSchema` on an agent step goes through Core's
// structured-output path, which shows the model an `{ elements: [...] }` object
// and unwraps it back to a raw array. So these mocks must emit the WRAPPED
// JSON, not a bare array. The unwrapped array is what foreach iterates.
const subtopicsAgent = jsonAgent(
  'subtopics-agent',
  'Subtopics Agent',
  'Return three subtopic prompts for the foreach comparison test.',
  JSON.stringify({
    elements: [
      { prompt: 'Write a one-line blurb about the first subtopic.' },
      { prompt: 'Write a one-line blurb about the second subtopic.' },
      { prompt: 'Write a one-line blurb about the third subtopic.' },
    ],
  }),
);

const subtopicBlurbsAgent = jsonAgent(
  'subtopic-blurbs-agent',
  'Subtopic Blurbs Agent',
  'Return three subtopics with blurbs for the single-agent comparison test.',
  JSON.stringify({
    elements: [
      { subtopic: 'Solar Power', blurb: 'Sunlight converted directly into usable electricity.' },
      { subtopic: 'Wind Energy', blurb: 'Moving air spun into grid-ready power.' },
      { subtopic: 'Energy Storage', blurb: 'Holding surplus generation until demand returns.' },
    ],
  }),
);

const blurbAgent = new Agent({
  id: 'blurb-agent',
  name: 'Blurb Agent',
  instructions: 'Write a one-line blurb for foreach comparison tests.',
  model: new MockLanguageModelV3({
    doGenerate: async () => ({
      content: [{ type: 'text', text: 'A concise one-line blurb.' }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: modelUsage,
      warnings: [],
    }),
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'blurb-agent', modelId: 'blurb-model', timestamp: new Date(0) },
        { type: 'text-start', id: 'blurb-text' },
        { type: 'text-delta', id: 'blurb-text', delta: 'A concise one-line blurb.' },
        { type: 'text-end', id: 'blurb-text' },
        { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage: modelUsage },
      ]),
    }),
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
  // Parallel pattern A — one shared object, each branch reads its own field.
  // Both children receive the same preceding object, so the workflow input must
  // satisfy both child schemas at once; `lookupCustomer` consumes `email` while
  // `createSupportTicket` consumes `customerId`/`summary`. Extra fields a branch
  // does not need are ignored.
  //
  // Do not "fix" this by replacing the container with a mapping that hardcodes
  // branch outputs — that asserts nothing about parallel. When two branches need
  // different VALUES of the same field, pattern A cannot express it; see
  // `parallel-customer-lookup-workflow` below for the helper-workflow form.
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
  // Parallel pattern B — two branches call the SAME tool on different values.
  // One shared object carries only one `email`, so pattern A would look the same
  // customer up twice. Each branch is therefore a small helper workflow that maps
  // its OWN field into `lookupCustomer`. Helper workflows are saved first, in
  // dependency order; each save live-registers the helper so the root can
  // reference it by `workflowId`. Mappings are legal as a nested workflow's first
  // step — the container-child restriction applies to the parallel's children,
  // not to the inside of a workflow those children invoke.
  {
    id: 'parallel-customer-lookup-workflow',
    input: { email1: 'ada@example.com', email2: 'grace@example.com' },
    // Distinct emails prove each helper mapped its own field rather than both
    // branches receiving the same value.
    expected: {
      firstCustomer: { customerId: 'customer-123', email: 'ada@example.com', plan: 'pro' },
      secondCustomer: { customerId: 'customer-123', email: 'grace@example.com', plan: 'pro' },
    },
    dependencies: [
      {
        id: 'lookup-first-customer',
        description: 'Looks up the first customer email from a two-email input.',
        inputSchema: objectSchema({ email1: stringSchema, email2: stringSchema }, ['email1', 'email2']),
        outputSchema: customerSchema,
        graph: [
          { type: 'mapping', id: 'first-email', mapConfig: { email: fromInput('email1') } },
          { type: 'tool', id: 'lookup-first', toolId: 'lookupCustomer' },
        ],
      },
      {
        id: 'lookup-second-customer',
        description: 'Looks up the second customer email from a two-email input.',
        inputSchema: objectSchema({ email1: stringSchema, email2: stringSchema }, ['email1', 'email2']),
        outputSchema: customerSchema,
        graph: [
          { type: 'mapping', id: 'second-email', mapConfig: { email: fromInput('email2') } },
          { type: 'tool', id: 'lookup-second', toolId: 'lookupCustomer' },
        ],
      },
    ],
    definition: {
      id: 'parallel-customer-lookup-workflow',
      inputSchema: objectSchema({ email1: stringSchema, email2: stringSchema }, ['email1', 'email2']),
      outputSchema: objectSchema({ firstCustomer: customerSchema, secondCustomer: customerSchema }, [
        'firstCustomer',
        'secondCustomer',
      ]),
      graph: [
        {
          type: 'parallel',
          steps: [
            { type: 'workflow', id: 'first-lookup-branch', workflowId: 'lookup-first-customer' },
            { type: 'workflow', id: 'second-lookup-branch', workflowId: 'lookup-second-customer' },
          ],
        },
        {
          type: 'mapping',
          id: 'parallel-lookup-results',
          mapConfig: {
            firstCustomer: fromStep('first-lookup-branch', ''),
            secondCustomer: fromStep('second-lookup-branch', ''),
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
    id: 'strict-support-answer-workflow',
    input: { prompt: 'How do I reset my password?' },
    expected: { response: 'Reset your password from account settings.' },
    definition: {
      id: 'strict-support-answer-workflow',
      inputSchema: strictObjectSchema({ prompt: stringSchema }, ['prompt']),
      outputSchema: strictObjectSchema({ response: stringSchema }, ['response']),
      graph: [
        { type: 'agent', id: 'support-agent-step', agentId: 'support-agent' },
        {
          type: 'mapping',
          id: 'strict-support-answer-result',
          mapConfig: { response: fromStep('support-agent-step', 'text') },
        },
      ],
    },
  },
  {
    // Strict twin of mixed-support-pipeline. `create-support-ticket` needs a
    // customerId the closed input schema does not carry, so the lookup supplies it.
    id: 'strict-support-ticket-workflow',
    input: { email: 'ada@example.com', summary: 'Cannot sign in' },
    expected: {
      agentText: 'Prepared support answer for Cannot sign in',
      ticket: { ticketId: 'ticket-456', status: 'open' },
    },
    definition: {
      id: 'strict-support-ticket-workflow',
      inputSchema: strictObjectSchema({ email: stringSchema, summary: stringSchema }, ['email', 'summary']),
      outputSchema: strictObjectSchema(
        {
          agentText: stringSchema,
          ticket: strictObjectSchema({ ticketId: stringSchema, status: stringSchema }, ['ticketId', 'status']),
        },
        ['agentText', 'ticket'],
      ),
      graph: [
        { type: 'mapping', id: 'lookup-input', mapConfig: { email: fromInput('email') } },
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
          id: 'strict-support-ticket-result',
          mapConfig: {
            agentText: fromStep('support-agent-step', 'text'),
            ticket: fromStep('create-ticket-step', ''),
          },
        },
      ],
    },
  },
  {
    // The bridge pattern: an agent with a root-level array outputSchema is the
    // only way to hand a raw array to foreach, since a mapping cannot emit one.
    id: 'topic-subtopics-blurbs',
    input: { topic: 'renewable energy' },
    expected: [
      { text: 'A concise one-line blurb.' },
      { text: 'A concise one-line blurb.' },
      { text: 'A concise one-line blurb.' },
    ],
    definition: {
      id: 'topic-subtopics-blurbs',
      inputSchema: objectSchema({ topic: stringSchema }, ['topic']),
      outputSchema: arraySchema(objectSchema({ text: stringSchema }, ['text'])),
      graph: [
        {
          type: 'mapping',
          id: 'to-subtopics-prompt',
          mapConfig: { prompt: { template: 'Generate 3 subtopics for ${initData.topic}.' } },
        },
        {
          type: 'agent',
          id: 'generate-subtopics',
          agentId: 'subtopics-agent',
          // Foreach passes each element to the agent child unchanged, so every
          // element must already be exactly the agent input shape.
          outputSchema: arraySchema(objectSchema({ prompt: stringSchema }, ['prompt'])),
        },
        {
          type: 'foreach',
          step: { type: 'agent', id: 'write-blurb', agentId: 'blurb-agent' },
          opts: { concurrency: 3 },
        },
      ],
    },
  },
  {
    // Same prompt intent, no foreach: one agent returns complete pairs and a
    // mapping wraps them. This is the shape the live model picks unprompted.
    id: 'topic-subtopics-blurbs-single-agent',
    input: { topic: 'renewable energy' },
    expected: {
      topic: 'renewable energy',
      items: [
        { subtopic: 'Solar Power', blurb: 'Sunlight converted directly into usable electricity.' },
        { subtopic: 'Wind Energy', blurb: 'Moving air spun into grid-ready power.' },
        { subtopic: 'Energy Storage', blurb: 'Holding surplus generation until demand returns.' },
      ],
    },
    definition: {
      id: 'topic-subtopics-blurbs-single-agent',
      inputSchema: objectSchema({ topic: stringSchema }, ['topic']),
      outputSchema: objectSchema(
        {
          topic: stringSchema,
          items: arraySchema(objectSchema({ subtopic: stringSchema, blurb: stringSchema }, ['subtopic', 'blurb'])),
        },
        ['topic', 'items'],
      ),
      graph: [
        {
          type: 'mapping',
          id: 'to-subtopics-prompt',
          mapConfig: {
            prompt: { template: 'Generate 3 subtopics with a one-line blurb each for ${initData.topic}.' },
          },
        },
        {
          type: 'agent',
          id: 'generate-subtopics',
          agentId: 'subtopic-blurbs-agent',
          outputSchema: arraySchema(
            objectSchema({ subtopic: stringSchema, blurb: stringSchema }, ['subtopic', 'blurb']),
          ),
        },
        {
          type: 'mapping',
          id: 'topic-blurbs-result',
          mapConfig: {
            topic: fromInput('topic'),
            // Empty path addresses the whole array the agent step returned.
            items: fromStep('generate-subtopics', ''),
          },
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
        agents: { supportAgent, subtopicsAgent, subtopicBlurbsAgent, blurbAgent },
        tools: { addNumbers, lookupCustomer, createSupportTicket },
        workflows: { greetingWorkflow },
      });
      // Helper dependencies are saved first, one complete definition per call.
      // Each save must live-register the helper, otherwise the root definition
      // below cannot resolve it by `workflowId`.
      const dependencies = 'dependencies' in scenario ? scenario.dependencies : undefined;
      for (const dependency of dependencies ?? []) {
        const savedDependency = await (saveWorkflowTool as any).execute(
          (saveWorkflowTool as any).inputSchema.parse(dependency),
          { mastra, requestContext: new RequestContext() },
        );

        expect(savedDependency, JSON.stringify(savedDependency)).toEqual({ ok: true, id: dependency.id });
      }

      const parsedDefinition = (saveWorkflowTool as any).inputSchema.parse(definition);
      const workflowBuilder = createWorkflowBuilderAgentStub(mastra, parsedDefinition);
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
