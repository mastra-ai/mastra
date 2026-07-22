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
    id: 'workflow-builder-tool-turn',
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

const stopTurn = (text: string) => [
  { type: 'stream-start', warnings: [] },
  {
    type: 'response-metadata',
    id: 'workflow-builder-stop-turn',
    modelId: 'workflow-builder-fixture',
    timestamp: new Date(0),
  },
  { type: 'text-start', id: 'done-text' },
  { type: 'text-delta', id: 'done-text', delta: text },
  { type: 'text-end', id: 'done-text' },
  {
    type: 'finish',
    finishReason: 'stop',
    usage: { inputTokens: 1200, outputTokens: 50, totalTokens: 1250, reasoningTokens: 0, cachedInputTokens: 512 },
  },
];

export const workflowBuilderLifecycleFixture = [
  toolCallTurn([
    [
      'workflow-checkpoint',
      'checkpoint-workflow-draft',
      {
        id: 'support-intake-workflow',
        description: 'Processes a support request into a deterministic response.',
        inputSchema: { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'] },
        outputSchema: {
          type: 'object',
          properties: { response: { type: 'string' } },
          required: ['response'],
        },
        graph: [
          {
            type: 'mapping',
            id: 'answer-request',
            mapConfig: { response: { template: '${inputData.prompt}' } },
          },
        ],
      },
    ],
    ['workflow-finalize', 'finalize-workflow-draft', { expectedRevision: 1 }],
  ]),
  stopTurn('Done — I created support-intake-workflow with one mapping step.'),
];
