import type { ToolMockReport } from '@mastra/client-js';

export const baseReport: ToolMockReport = {
  served: [{ mockIndex: 0, toolName: 'getWeather', args: { city: 'Seattle' } }],
  unconsumed: [{ mockIndex: 1, toolName: 'getWeather', args: { city: 'Paris' } }],
  liveCalls: [{ toolName: 'searchDocs', args: { q: 'mastra' } }],
};

export const failureReport: ToolMockReport = {
  ...baseReport,
  served: [],
  unconsumed: [{ mockIndex: 0, toolName: 'getWeather', args: { city: 'Seattle' } }],
  liveCalls: [],
  failure: { code: 'TOOL_MOCK_MISMATCH', toolName: 'getWeather', args: { city: 'Paris' } },
};

export const emptyReport: ToolMockReport = { served: [], unconsumed: [], liveCalls: [] };
