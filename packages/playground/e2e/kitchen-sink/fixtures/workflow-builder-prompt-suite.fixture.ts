const toolCall = (toolCallId: string, toolName: string, input: Record<string, unknown>) => [
  { type: 'tool-input-start', id: toolCallId, toolName },
  { type: 'tool-input-delta', id: toolCallId, delta: JSON.stringify(input) },
  { type: 'tool-input-end', id: toolCallId },
  { type: 'tool-call', toolCallId, toolName, input: JSON.stringify(input), providerMetadata: {} },
];

const toolCallTurn = (calls: Array<[string, string, Record<string, unknown>]>) => [
  { type: 'stream-start', warnings: [] },
  {
    type: 'response-metadata',
    id: 'workflow-builder-prompt-suite-tool-turn',
    modelId: 'workflow-builder-fixture',
    timestamp: new Date(0),
  },
  ...calls.flatMap(([toolCallId, toolName, input]) => toolCall(toolCallId, toolName, input)),
  {
    type: 'finish',
    finishReason: 'tool-calls',
    usage: { inputTokens: 1000, outputTokens: 100, totalTokens: 1100, reasoningTokens: 0, cachedInputTokens: 0 },
  },
];

const stopTurn = (workflowId: string) => [
  { type: 'stream-start', warnings: [] },
  {
    type: 'response-metadata',
    id: 'workflow-builder-prompt-suite-stop-turn',
    modelId: 'workflow-builder-fixture',
    timestamp: new Date(0),
  },
  { type: 'text-start', id: 'done-text' },
  { type: 'text-delta', id: 'done-text', delta: `Ready — ${workflowId} is finalized.` },
  { type: 'text-end', id: 'done-text' },
  {
    type: 'finish',
    finishReason: 'stop',
    usage: { inputTokens: 1200, outputTokens: 50, totalTokens: 1250, reasoningTokens: 0, cachedInputTokens: 512 },
  },
];

const objectSchema = (properties: Record<string, unknown>, required: string[]) => ({
  type: 'object',
  properties,
  required,
});

const promptSuiteFixture = (definition: Record<string, unknown>) => [
  toolCallTurn([['workflow-submit', 'submit-workflow-draft', definition]]),
  stopTurn(String(definition.id)),
];

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

export const workflowBuilderPromptFixtures = {
  'workflow-builder-prompt-addition': promptSuiteFixture({
    id: 'addition-workflow',
    description: 'Adds two numbers.',
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
  }),
  'workflow-builder-prompt-customer-ticket': promptSuiteFixture({
    id: 'customer-ticket-workflow',
    description: 'Looks up a customer and creates a support ticket.',
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
  }),
  'workflow-builder-prompt-parallel-customer-lookup': promptSuiteFixture({
    id: 'parallel-customer-lookup-workflow',
    description: 'Looks up two customers in parallel.',
    inputSchema: objectSchema({ firstEmail: stringSchema, secondEmail: stringSchema }, ['firstEmail', 'secondEmail']),
    outputSchema: objectSchema({ firstCustomer: customerSchema, secondCustomer: customerSchema }, [
      'firstCustomer',
      'secondCustomer',
    ]),
    graph: [
      {
        type: 'parallel',
        steps: [
          { type: 'tool', id: 'lookup-first', toolId: 'lookupCustomer' },
          { type: 'tool', id: 'lookup-second', toolId: 'lookupCustomer' },
        ],
      },
      {
        type: 'mapping',
        id: 'parallel-customer-results',
        mapConfig: {
          firstCustomer: fromStep('lookup-first', ''),
          secondCustomer: fromStep('lookup-second', ''),
        },
      },
    ],
  }),
  'workflow-builder-prompt-support-answer': promptSuiteFixture({
    id: 'support-answer-workflow',
    description: 'Returns a support answer.',
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
  }),
  'workflow-builder-prompt-nested-greeting': promptSuiteFixture({
    id: 'nested-greeting-workflow',
    description: 'Returns a nested greeting.',
    inputSchema: objectSchema({ name: stringSchema }, ['name']),
    outputSchema: objectSchema({ message: stringSchema }, ['message']),
    // The nested step declares its own call-site id (`invoke-greeting`), which
    // differs from the referenced workflow's intrinsic id, and the final mapping
    // addresses that declared id. Rehydration preserves it.
    graph: [
      { type: 'workflow', id: 'invoke-greeting', workflowId: 'greetingWorkflow' },
      {
        type: 'mapping',
        id: 'nested-greeting-result',
        mapConfig: { message: fromStep('invoke-greeting', 'message') },
      },
    ],
  }),
  'workflow-builder-prompt-foreach-customer-lookup': promptSuiteFixture({
    id: 'foreach-customer-lookup-workflow',
    description: 'Looks up each customer in an input array.',
    inputSchema: arraySchema(objectSchema({ email: stringSchema }, ['email'])),
    outputSchema: arraySchema(customerSchema),
    graph: [
      {
        type: 'foreach',
        step: {
          type: 'tool',
          id: 'lookup-customer-item',
          toolId: 'lookupCustomer',
        },
        opts: { concurrency: 1 },
      },
    ],
  }),
  'workflow-builder-prompt-priority-support-router': promptSuiteFixture({
    id: 'priority-support-router',
    description: 'Routes support requests by priority.',
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
        // Array form selects whichever branch actually ran.
        mapConfig: { response: fromStep(['urgent-support', 'normal-support'], 'text') },
      },
    ],
  }),
  'workflow-builder-prompt-mixed-support-pipeline': promptSuiteFixture({
    id: 'mixed-support-pipeline',
    description: 'Returns a support answer and ticket.',
    inputSchema: objectSchema({ email: stringSchema, summary: stringSchema }, ['email', 'summary']),
    outputSchema: objectSchema({ response: stringSchema, ticket: ticketSchema }, ['response', 'ticket']),
    graph: [
      { type: 'tool', id: 'lookup-customer-step', toolId: 'lookupCustomer' },
      {
        type: 'mapping',
        id: 'agent-input',
        mapConfig: {
          prompt: { template: 'Prepare a support answer for ${initData.summary}' },
        },
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
  }),
} as const;
