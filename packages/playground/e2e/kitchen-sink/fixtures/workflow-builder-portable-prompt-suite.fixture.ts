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
    id: 'workflow-builder-portable-prompt-suite-tool-turn',
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
    id: 'workflow-builder-portable-prompt-suite-stop-turn',
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

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({
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

export const workflowBuilderPortablePromptFixtures = {
  'workflow-builder-portable-echo': promptSuiteFixture({
    id: 'portable-echo-workflow',
    description: 'Returns the input message.',
    inputSchema: objectSchema({ message: stringSchema }, ['message']),
    outputSchema: objectSchema({ message: stringSchema }, ['message']),
    graph: [{ type: 'mapping', id: 'echo-message', mapConfig: { message: { initData: true, path: 'message' } } }],
  }),
  'workflow-builder-portable-greeting': promptSuiteFixture({
    id: 'portable-greeting-workflow',
    description: 'Formats a greeting from the input name.',
    inputSchema: objectSchema({ name: stringSchema }, ['name']),
    outputSchema: objectSchema({ message: stringSchema }, ['message']),
    graph: [
      { type: 'mapping', id: 'format-greeting', mapConfig: { message: { template: 'Hello, ${initData.name}!' } } },
    ],
  }),
  'workflow-builder-portable-order-status': promptSuiteFixture({
    id: 'portable-order-status-workflow',
    description: 'Returns an order identifier with a received status.',
    inputSchema: objectSchema({ orderId: stringSchema }, ['orderId']),
    outputSchema: objectSchema({ orderId: stringSchema, status: stringSchema }, ['orderId', 'status']),
    graph: [
      {
        type: 'mapping',
        id: 'shape-order-status',
        mapConfig: { orderId: { initData: true, path: 'orderId' }, status: { value: 'received' } },
      },
    ],
  }),
  'workflow-builder-portable-profile': promptSuiteFixture({
    id: 'portable-profile-workflow',
    description: 'Projects profile fields from workflow input.',
    inputSchema: objectSchema({ name: stringSchema, age: numberSchema }, ['name', 'age']),
    outputSchema: objectSchema({ name: stringSchema, age: numberSchema }, ['name', 'age']),
    graph: [
      {
        type: 'mapping',
        id: 'project-profile',
        mapConfig: { name: { initData: true, path: 'name' }, age: { initData: true, path: 'age' } },
      },
    ],
  }),
  'workflow-builder-portable-tags': promptSuiteFixture({
    id: 'portable-tags-workflow',
    description: 'Copies an input string array.',
    inputSchema: objectSchema({ tags: { type: 'array', items: stringSchema } }, ['tags']),
    outputSchema: objectSchema({ tags: { type: 'array', items: stringSchema } }, ['tags']),
    graph: [{ type: 'mapping', id: 'copy-tags', mapConfig: { tags: { initData: true, path: 'tags' } } }],
  }),
  'workflow-builder-portable-chained-mapping': promptSuiteFixture({
    id: 'portable-chained-mapping-workflow',
    description: 'Passes a value through two mapping steps.',
    inputSchema: objectSchema({ value: stringSchema }, ['value']),
    outputSchema: objectSchema({ result: stringSchema }, ['result']),
    graph: [
      {
        type: 'mapping',
        id: 'normalize-value',
        mapConfig: { normalizedValue: { initData: true, path: 'value' } },
      },
      {
        type: 'mapping',
        id: 'copy-normalized-value',
        mapConfig: { result: { step: 'normalize-value', path: 'normalizedValue' } },
      },
    ],
  }),
  'workflow-builder-portable-receipt': promptSuiteFixture({
    id: 'portable-receipt-workflow',
    description: 'Formats a receipt summary from workflow input.',
    inputSchema: objectSchema({ item: stringSchema, quantity: numberSchema }, ['item', 'quantity']),
    outputSchema: objectSchema({ summary: stringSchema }, ['summary']),
    graph: [
      {
        type: 'mapping',
        id: 'format-receipt',
        mapConfig: { summary: { template: 'Ordered ${initData.quantity} x ${initData.item}' } },
      },
    ],
  }),
  'workflow-builder-portable-defaults': promptSuiteFixture({
    id: 'portable-defaults-workflow',
    description: 'Returns a portable set of constant defaults.',
    inputSchema: objectSchema({}),
    outputSchema: {},
    graph: [
      {
        type: 'mapping',
        id: 'create-defaults',
        mapConfig: { enabled: { value: true }, retries: { value: 3 }, mode: { value: 'safe' } },
      },
    ],
  }),
} as const;
