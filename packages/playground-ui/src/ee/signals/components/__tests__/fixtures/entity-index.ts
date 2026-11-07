import type { ThemeEntitiesResponse, ThemeSnapshotsResponse } from '@mastra/client-js';

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

export const customSignalEntityResponse: ThemeEntitiesResponse = {
  entities: [
    {
      entityId: 'custom-agent',
      entityType: 'agent',
      availableSignals: ['tool_usage', 'response_quality'],
      signalCatalog: [
        {
          name: 'tool_usage',
          label: 'Tool usage',
          description: 'How effectively the agent uses tools.',
          order: 0,
          builtIn: false,
          enabled: true,
          status: 'ready',
        },
        {
          name: 'response_quality',
          label: 'Response quality',
          description: 'How useful the final answer is.',
          order: 1,
          builtIn: false,
          enabled: true,
          status: 'ready',
        },
      ],
      traceCount: 12,
      readySignalCount: 2,
      enabledSignalCount: 2,
      status: 'ready',
      updatedAt: '2026-08-18T16:00:00.000Z',
    },
  ],
};

const builtInCatalogEntry = (name: string, order: number, enabled: boolean) => ({
  name,
  label: name.charAt(0).toUpperCase() + name.slice(1),
  description: `${name} description`,
  order,
  builtIn: true,
  enabled,
  status: 'ready' as const,
});

/** Entity whose historical theme output still lists a paused built-in signal. */
export const pausedSignalEntityResponse: ThemeEntitiesResponse = {
  entities: [
    {
      entityId: 'paused-agent',
      entityType: 'agent',
      availableSignals: ['behavior', 'goal', 'issues', 'outcome', 'sentiment'],
      signalCatalog: [
        builtInCatalogEntry('goal', 0, true),
        builtInCatalogEntry('sentiment', 1, true),
        builtInCatalogEntry('behavior', 2, false),
        builtInCatalogEntry('outcome', 3, true),
        builtInCatalogEntry('issues', 4, true),
      ],
      traceCount: 12,
      readySignalCount: 4,
      enabledSignalCount: 4,
      status: 'ready',
      updatedAt: '2026-08-18T16:00:00.000Z',
    },
  ],
};

export const emptyThemeSnapshotsResponse: ThemeSnapshotsResponse = { snapshots: [] };
