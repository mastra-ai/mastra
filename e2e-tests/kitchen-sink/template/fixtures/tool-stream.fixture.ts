export const toolStreamFixture = [
  { type: 'stream-start', warnings: [] },
  {
    type: 'response-metadata',
    id: 'resp_0ad8f533d5663ddd0068f0b8c3c7588194ac89b30a0e3362b8',
    timestamp: '2025-10-16T09:20:03.000Z',
    modelId: 'gpt-4o-mini-2024-07-18',
  },
  { type: 'tool-input-start', id: 'call_qSTurmHsy8HrPfHn34wBSsCV', toolName: 'weatherInfo' },
  { type: 'tool-input-delta', id: 'call_qSTurmHsy8HrPfHn34wBSsCV', delta: '{"' },
  { type: 'tool-input-delta', id: 'call_qSTurmHsy8HrPfHn34wBSsCV', delta: 'city' },
  { type: 'tool-input-delta', id: 'call_qSTurmHsy8HrPfHn34wBSsCV', delta: '":"' },
  { type: 'tool-input-delta', id: 'call_qSTurmHsy8HrPfHn34wBSsCV', delta: 'Paris' },
  { type: 'tool-input-delta', id: 'call_qSTurmHsy8HrPfHn34wBSsCV', delta: '"}' },
  { type: 'tool-input-end', id: 'call_qSTurmHsy8HrPfHn34wBSsCV' },
  {
    type: 'tool-call',
    toolCallId: 'call_qSTurmHsy8HrPfHn34wBSsCV',
    toolName: 'weatherInfo',
    input: '{"city":"Paris"}',
    providerMetadata: { openai: { itemId: 'fc_0ad8f533d5663ddd0068f0b8c5bcd88194a33cb759d2ea7e1d' } },
  },
  {
    type: 'finish',
    finishReason: 'tool-calls',
    usage: { inputTokens: 139, outputTokens: 15, totalTokens: 154, reasoningTokens: 0, cachedInputTokens: 0 },
    providerMetadata: { openai: { responseId: 'resp_0ad8f533d5663ddd0068f0b8c3c7588194ac89b30a0e3362b8' } },
  },
];
