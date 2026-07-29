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

/**
 * Deterministic adversarial journey under the unified 2-tool contract:
 * the first `submit-workflow-draft` carries a provably invalid complete
 * definition (rejected with Core diagnostics, accepted state untouched),
 * the second carries the corrected complete definition and becomes Ready.
 */
const repairFixture = (invalidDefinition: Record<string, unknown>, correctedDefinition: Record<string, unknown>) => [
  toolCallTurn([[`${correctedDefinition.id}-submit-invalid`, 'submit-workflow-draft', invalidDefinition]]),
  toolCallTurn([[`${correctedDefinition.id}-submit-corrected`, 'submit-workflow-draft', correctedDefinition]]),
  stopTurn(String(correctedDefinition.id)),
];

const customerTicketCorrected = {
  id: 'customer-ticket-workflow',
  description: 'Creates a customer support ticket.',
  inputSchema: objectSchema({ email: stringSchema, summary: stringSchema }, ['email', 'summary']),
  outputSchema: objectSchema({ ticketId: stringSchema, status: stringSchema }, ['ticketId', 'status']),
  graph: [
    {
      type: 'mapping',
      id: 'shape-ticket-input',
      mapConfig: { ticketId: { value: 'ticket-456' }, status: { value: 'open' } },
    },
  ],
};

const parallelLookupCorrected = {
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
};

const priorityRouterCorrected = {
  id: 'priority-support-router',
  description: 'Routes urgent support requests.',
  inputSchema: objectSchema({ prompt: stringSchema, priority: stringSchema }, ['prompt', 'priority']),
  outputSchema: objectSchema({ branch: stringSchema, response: stringSchema }, ['branch', 'response']),
  graph: [
    {
      type: 'conditional',
      steps: [{ type: 'tool', id: 'urgent', toolId: 'urgentSupport' }],
      predicates: [{ op: 'eq', left: { path: 'initData.priority' }, right: { literal: 'urgent' } }],
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
};

const mixedPipelineCorrected = {
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
};

export const workflowBuilderAdversarialRepairFixtures = {
  // Invalid: mapping references a step that does not exist.
  'workflow-builder-adversarial-customer-ticket': repairFixture(
    {
      ...customerTicketCorrected,
      graph: [
        {
          type: 'mapping',
          id: 'shape-ticket-input',
          mapConfig: { ticketId: { value: 'ticket-456' }, status: { step: 'missing', path: 'status' } },
        },
      ],
    },
    customerTicketCorrected,
  ),
  // Invalid: Handlebars-style template placeholders the runtime would emit literally.
  'workflow-builder-adversarial-parallel-lookup': repairFixture(
    {
      ...parallelLookupCorrected,
      graph: [
        {
          type: 'mapping',
          id: 'lookup-customers',
          mapConfig: {
            firstCustomer: { template: 'Customer {{firstEmail}}' },
            secondCustomer: { value: { customerId: 'customer-123', email: 'grace@example.com', plan: 'pro' } },
          },
        },
      ],
    },
    parallelLookupCorrected,
  ),
  // Invalid: conditional predicate references a step result that does not exist.
  'workflow-builder-adversarial-priority-router': repairFixture(
    {
      ...priorityRouterCorrected,
      graph: [
        {
          type: 'conditional',
          steps: [{ type: 'tool', id: 'urgent', toolId: 'urgentSupport' }],
          predicates: [{ op: 'truthy', value: { path: 'stepResults.missing' } }],
        },
        (priorityRouterCorrected.graph as Array<Record<string, unknown>>)[1]!,
      ],
    },
    priorityRouterCorrected,
  ),
  // Invalid: Handlebars-style template placeholder in the final mapping.
  'workflow-builder-adversarial-mixed-pipeline': repairFixture(
    {
      ...mixedPipelineCorrected,
      graph: [
        {
          type: 'mapping',
          id: 'support-parallel',
          mapConfig: {
            agentText: { template: 'Answer: {{summary}}' },
            ticket: { value: { ticketId: 'ticket-456', status: 'open' } },
          },
        },
      ],
    },
    mixedPipelineCorrected,
  ),
} as const;
