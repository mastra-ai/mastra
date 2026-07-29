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
    id: 'workflow-builder-adversarial-tool-turn',
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
    id: 'workflow-builder-adversarial-stop-turn',
    modelId: 'workflow-builder-fixture',
    timestamp: new Date(0),
  },
  { type: 'text-start', id: 'done-text' },
  { type: 'text-delta', id: 'done-text', delta: `Ready — ${workflowId} repaired and finalized.` },
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

const stringSchema = { type: 'string' };

const repairFixture = (
  definition: Record<string, unknown>,
  inspection: [string, Record<string, unknown>],
  repair: [string, Record<string, unknown>],
  candidateRevision: number,
) => [
  toolCallTurn([['workflow-checkpoint', 'checkpoint-workflow-draft', definition]]),
  toolCallTurn([['workflow-finalize-rejected', 'finalize-workflow-draft', { expectedRevision: 1 }]]),
  toolCallTurn([[`${definition.id}-inspect`, inspection[0], inspection[1]]]),
  toolCallTurn([[`${definition.id}-repair`, repair[0], repair[1]]]),
  toolCallTurn([[`${definition.id}-checkpoint`, 'checkpoint-workflow-candidate', { candidateRevision }]]),
  stopTurn(String(definition.id)),
];

export const workflowBuilderAdversarialRepairFixtures = {
  'workflow-builder-adversarial-customer-ticket': repairFixture(
    {
      id: 'customer-ticket-workflow',
      description: 'Creates a customer support ticket.',
      inputSchema: objectSchema({ email: stringSchema, summary: stringSchema }, ['email', 'summary']),
      outputSchema: objectSchema({ ticketId: stringSchema, status: stringSchema }, ['ticketId', 'status']),
      graph: [
        {
          type: 'mapping',
          id: 'shape-ticket-input',
          mapConfig: { ticketId: { value: 'ticket-456' }, status: { step: 'missing', path: 'status' } },
        },
      ],
    },
    ['get-tool-schema', { registryKey: 'lookupCustomer' }],
    [
      'set-workflow-mapping-source',
      { mappingStepId: 'shape-ticket-input', field: 'status', source: { value: 'open' } },
    ],
    1,
  ),
  'workflow-builder-adversarial-parallel-lookup': repairFixture(
    {
      id: 'parallel-customer-lookup-workflow',
      description: 'Looks up two customers.',
      inputSchema: objectSchema({ firstEmail: stringSchema, secondEmail: stringSchema }, ['firstEmail', 'secondEmail']),
      outputSchema: objectSchema({ firstCustomer: {}, secondCustomer: {} }, ['firstCustomer', 'secondCustomer']),
      graph: [
        {
          type: 'mapping',
          id: 'lookup-customers',
          mapConfig: {
            firstCustomer: { value: { customerId: 'customer-123', email: 'ada@example.com', plan: 'pro' } },
            secondCustomer: { value: { customerId: 'customer-123', email: 'grace@example.com', plan: 'pro' } },
          },
        },
      ],
    },
    ['list-compatible-sources', { targetStepId: 'lookup-customers' }],
    [
      'insert-workflow-mapping-before',
      {
        targetStepId: 'lookup-customers',
        mappingStepId: 'shape-parallel-input',
        mapConfig: { secondEmail: { value: 'grace@example.com' } },
      },
    ],
    2,
  ),
  'workflow-builder-adversarial-priority-router': repairFixture(
    {
      id: 'priority-support-router',
      description: 'Routes urgent support requests.',
      inputSchema: objectSchema({ prompt: stringSchema, priority: stringSchema }, ['prompt', 'priority']),
      outputSchema: objectSchema({ branch: stringSchema, response: stringSchema }, ['branch', 'response']),
      graph: [
        {
          type: 'conditional',
          steps: [{ type: 'tool', id: 'urgent', toolId: 'urgentSupport' }],
          predicates: [{ op: 'truthy', value: { path: 'stepResults.missing' } }],
        },
        {
          type: 'mapping',
          id: 'shape-priority-result',
          mapConfig: {
            branch: { value: 'urgent' },
            response: { step: 'urgent', path: 'response' },
          },
        },
      ],
    },
    ['explain-validation-issue', { code: 'invalid-predicate-reference', path: 'graph.0.predicates.0.value.path' }],
    [
      'set-workflow-predicate',
      {
        targetStepId: 'urgent',
        predicate: { op: 'eq', left: { path: 'initData.priority' }, right: { literal: 'urgent' } },
      },
    ],
    1,
  ),
  'workflow-builder-adversarial-mixed-pipeline': repairFixture(
    {
      id: 'mixed-support-pipeline',
      description: 'Builds a mixed support response.',
      inputSchema: objectSchema({ email: stringSchema, summary: stringSchema }, ['email', 'summary']),
      outputSchema: {},
      graph: [
        {
          type: 'mapping',
          id: 'support-parallel',
          mapConfig: {
            agentText: { value: 'Reset your password.' },
            ticket: { value: { ticketId: 'ticket-456', status: 'open' } },
          },
        },
      ],
    },
    ['get-workflow-schema', { registryKey: 'complexWorkflow' }],
    [
      'insert-workflow-mapping-before',
      {
        targetStepId: 'support-parallel',
        mappingStepId: 'shape-mixed-input',
        mapConfig: { email: { value: 'ada@example.com' } },
      },
    ],
    2,
  ),
} as const;
