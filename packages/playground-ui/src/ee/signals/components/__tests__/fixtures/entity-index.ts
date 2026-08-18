import type { ThemeEntitiesResponse } from '@mastra/client-js';

export const entityIndexResponse: ThemeEntitiesResponse = {
  entities: [
    {
      entityId: 'support-agent',
      entityType: 'agent',
      availableSignals: ['goal', 'outcome', 'behavior', 'sentiment', 'tool_usage'],
      traceCount: 12480,
      readySignalCount: 5,
      enabledSignalCount: 5,
      status: 'ready',
      updatedAt: '2026-08-18T15:00:00.000Z',
    },
    {
      entityId: 'billing-agent',
      entityType: 'agent',
      availableSignals: [],
      traceCount: 42,
      readySignalCount: 0,
      enabledSignalCount: 6,
      status: 'collecting',
      updatedAt: '2026-08-18T14:00:00.000Z',
    },
    {
      entityId: 'research-agent',
      entityType: 'agent',
      availableSignals: ['goal', 'outcome', 'behavior', 'sentiment'],
      traceCount: 512,
      readySignalCount: 4,
      enabledSignalCount: 4,
      status: 'ready',
      updatedAt: '2026-08-17T12:00:00.000Z',
    },
  ],
};

export const oldShapeEntityIndexResponse: ThemeEntitiesResponse = {
  entities: [
    {
      entityId: 'legacy-agent',
      entityType: 'agent',
      availableSignals: ['goal'],
    },
  ],
};
