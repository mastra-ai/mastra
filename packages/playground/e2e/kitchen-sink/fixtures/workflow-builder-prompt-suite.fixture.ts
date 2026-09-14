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

// One definition, two scenarios. The urgent and normal routes differ only by
// run input, so they share this builder and are told apart by which conditional
// branch produced a step result.
const priorityRouterDefinition = (id: string) => ({
  id,
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
});

const emailLookupHelper = (id: string, sourceField: string) => ({
  id,
  description: `Looks up the customer named by ${sourceField}.`,
  inputSchema: objectSchema({ [sourceField]: stringSchema }, [sourceField]),
  outputSchema: customerSchema,
  graph: [
    { type: 'mapping', id: 'lookup-input', mapConfig: { email: fromInput(sourceField) } },
    { type: 'tool', id: 'lookup-customer-step', toolId: 'lookupCustomer' },
  ],
});

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
  // Parallel branches all receive the same object, so two lookups of two
  // different emails need one helper workflow per branch to do the shaping.
  // The helpers are submitted with the root and saved with it.
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
          { type: 'workflow', id: 'lookup-first', workflowId: 'lookup-first-customer' },
          { type: 'workflow', id: 'lookup-second', workflowId: 'lookup-second-customer' },
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
    dependencies: [
      emailLookupHelper('lookup-first-customer', 'firstEmail'),
      emailLookupHelper('lookup-second-customer', 'secondEmail'),
    ],
  }),
  // The other parallel shape: one object feeds both branches, and each branch
  // consumes the fields its own schema requires. No helpers needed.
  'workflow-builder-prompt-parallel-support-fanout': promptSuiteFixture({
    id: 'parallel-support-fanout-workflow',
    description: 'Looks up a customer and opens a ticket in parallel.',
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
          { type: 'tool', id: 'lookup-customer-step', toolId: 'lookupCustomer' },
          { type: 'tool', id: 'create-ticket-step', toolId: 'createSupportTicket' },
        ],
      },
      {
        type: 'mapping',
        id: 'parallel-fanout-result',
        mapConfig: {
          customer: fromStep('lookup-customer-step', ''),
          ticket: fromStep('create-ticket-step', ''),
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
  // Bridges an array-output agent into a foreach: the agent step's root-level
  // array `outputSchema` produces `[{ prompt }, ...]` directly (no mapping can
  // precede a foreach), which foreach hands one element at a time to the blurb
  // agent. This is the canonical "do X for each item" shape.
  'workflow-builder-prompt-topic-subtopics-blurbs': promptSuiteFixture({
    id: 'topic-subtopics-blurbs',
    description: 'Generates subtopics for a topic and writes a one-line blurb for each.',
    inputSchema: objectSchema({ topic: stringSchema }, ['topic']),
    outputSchema: arraySchema(objectSchema({ text: stringSchema }, ['text'])),
    graph: [
      {
        type: 'mapping',
        id: 'to-subtopics-prompt',
        mapConfig: {
          prompt: { template: 'Generate 3 subtopics for ${initData.topic} and a blurb prompt for each.' },
        },
      },
      {
        type: 'agent',
        id: 'generate-subtopics',
        agentId: 'subtopics-agent',
        outputSchema: arraySchema(objectSchema({ prompt: stringSchema }, ['prompt'])),
      },
      {
        type: 'foreach',
        step: {
          type: 'agent',
          id: 'write-blurb',
          agentId: 'blurb-agent',
        },
        opts: { concurrency: 3 },
      },
    ],
  }),
  'workflow-builder-prompt-priority-support-router': promptSuiteFixture(
    priorityRouterDefinition('priority-support-router'),
  ),
  // Same definition, different run input. support-agent answers with a fixed
  // string either way, so the two routes are indistinguishable by output — only
  // the step-level branch assertion separates them.
  'workflow-builder-prompt-priority-support-router-normal-route': promptSuiteFixture(
    priorityRouterDefinition('priority-support-router-normal-route'),
  ),
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
  // Strict twin of support-answer-workflow. Same graph shape; the coverage it
  // adds is the closed input/output schema round-tripping through storage.
  'workflow-builder-prompt-strict-support-answer': promptSuiteFixture({
    id: 'strict-support-answer-workflow',
    description: 'Answers a support prompt under a closed input and output schema.',
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
  }),
  // Strict twin of mixed-support-pipeline. `create-support-ticket` needs a
  // customerId that the closed input schema does not carry, so the customer
  // lookup is what supplies it.
  'workflow-builder-prompt-strict-support-ticket': promptSuiteFixture({
    id: 'strict-support-ticket-workflow',
    description: 'Answers and opens a ticket under closed input and output schemas.',
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
  }),
  // Single-agent twin of topic-subtopics-blurbs: one structured turn produces
  // every pair, so no iteration is needed. This is the shape a model picks when
  // the prompt does not name foreach, and it is the only scenario that
  // references a whole array step result (`path: ''`) into an object wrapper.
  'workflow-builder-prompt-topic-subtopics-blurbs-single-agent': promptSuiteFixture({
    id: 'topic-subtopics-blurbs-single-agent',
    description: 'Generates subtopics with blurbs for a topic in a single agent step.',
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
        outputSchema: arraySchema(objectSchema({ subtopic: stringSchema, blurb: stringSchema }, ['subtopic', 'blurb'])),
      },
      {
        type: 'mapping',
        id: 'topic-blurbs-result',
        mapConfig: {
          topic: fromInput('topic'),
          items: fromStep('generate-subtopics', ''),
        },
      },
    ],
  }),
} as const;
