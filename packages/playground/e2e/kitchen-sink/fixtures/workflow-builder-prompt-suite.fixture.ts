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

export const workflowBuilderPromptFixtures = {
  'workflow-builder-prompt-addition': promptSuiteFixture({
    id: 'addition-workflow',
    description: 'Adds two numbers.',
    inputSchema: objectSchema({ a: numberSchema, b: numberSchema }, ['a', 'b']),
    outputSchema: {},
    graph: [{ type: 'mapping', id: 'add-numbers-result', mapConfig: { result: { value: 5 } } }],
  }),
  'workflow-builder-prompt-customer-ticket': promptSuiteFixture({
    id: 'customer-ticket-workflow',
    description: 'Looks up a customer and creates a support ticket.',
    inputSchema: objectSchema({ email: stringSchema, summary: stringSchema }, ['email', 'summary']),
    outputSchema: {},
    graph: [
      {
        type: 'mapping',
        id: 'ticket-result',
        mapConfig: { ticketId: { value: 'ticket-456' }, status: { value: 'open' } },
      },
    ],
  }),
  'workflow-builder-prompt-parallel-customer-lookup': promptSuiteFixture({
    id: 'parallel-customer-lookup-workflow',
    description: 'Looks up two customers in parallel.',
    inputSchema: objectSchema({ firstEmail: stringSchema, secondEmail: stringSchema }, ['firstEmail', 'secondEmail']),
    outputSchema: {},
    graph: [
      {
        type: 'mapping',
        id: 'parallel-customer-results',
        mapConfig: {
          firstCustomer: {
            value: { customerId: 'customer-123', email: 'ada@example.com', plan: 'pro' },
          },
          secondCustomer: {
            value: { customerId: 'customer-123', email: 'grace@example.com', plan: 'pro' },
          },
        },
      },
    ],
  }),
  'workflow-builder-prompt-support-answer': promptSuiteFixture({
    id: 'support-answer-workflow',
    description: 'Returns a support answer.',
    inputSchema: objectSchema({ prompt: stringSchema }, ['prompt']),
    outputSchema: {},
    graph: [
      {
        type: 'mapping',
        id: 'support-answer-result',
        mapConfig: { response: { value: 'Reset your password from account settings.' } },
      },
    ],
  }),
  'workflow-builder-prompt-nested-greeting': promptSuiteFixture({
    id: 'nested-greeting-workflow',
    description: 'Returns a nested greeting.',
    inputSchema: objectSchema({ name: stringSchema }, ['name']),
    outputSchema: {},
    graph: [
      {
        type: 'mapping',
        id: 'nested-greeting-result',
        mapConfig: { message: { value: 'Hello, Ada!' } },
      },
    ],
  }),
  'workflow-builder-prompt-foreach-customer-lookup': promptSuiteFixture({
    id: 'foreach-customer-lookup-workflow',
    description: 'Looks up each customer in an input array.',
    inputSchema: { type: 'array', items: objectSchema({ email: stringSchema }, ['email']) },
    outputSchema: {},
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
    outputSchema: {},
    graph: [
      {
        type: 'mapping',
        id: 'priority-support-result',
        mapConfig: { response: { value: 'Urgent support response for Production is down' } },
      },
    ],
  }),
  'workflow-builder-prompt-mixed-support-pipeline': promptSuiteFixture({
    id: 'mixed-support-pipeline',
    description: 'Returns a support answer and ticket.',
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
  }),
} as const;
