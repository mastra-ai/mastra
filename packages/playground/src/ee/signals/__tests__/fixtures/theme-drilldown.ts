import type {
  ThemeDetailResponse,
  ThemeExamplesResponse,
  ThemeFlowResponse,
  ThemeHistoryResponse,
  ThemePathsResponse,
} from '@mastra/client-js';

const snapshot = {
  snapshotId: 'opaque-snapshot-cursor',
  ordinal: 4,
  total: 4,
  startedAt: '2026-07-15T00:00:00.000Z',
  endedAt: '2026-07-22T00:00:00.000Z',
  traceCount: 2,
};

export const drilldownThemeFlowResponse = {
  snapshot,
  stages: [
    {
      signalName: 'goal',
      traceCount: 2,
      nodes: [
        {
          nodeId: 'flow-goal-101',
          kind: 'theme',
          themeId: '101',
          label: 'Add transcript',
          description: 'Users want to add a transcript to their workspace.',
          traceCount: 2,
          stageShare: 1,
        },
      ],
    },
    {
      signalName: 'outcome',
      traceCount: 2,
      nodes: [
        {
          nodeId: 'flow-outcome-201',
          kind: 'theme',
          themeId: '201',
          label: 'Transcript added',
          traceCount: 2,
          stageShare: 1,
        },
      ],
    },
    {
      signalName: 'behavior',
      traceCount: 2,
      nodes: [
        {
          nodeId: 'flow-behavior-301',
          kind: 'theme',
          themeId: '301',
          label: 'Opened workspace',
          traceCount: 1,
          stageShare: 0.5,
        },
        {
          nodeId: 'flow-behavior-noise',
          kind: 'noise',
          label: 'Noise',
          traceCount: 1,
          stageShare: 0.5,
        },
      ],
    },
  ],
  links: [
    {
      sourceNodeId: 'flow-goal-101',
      targetNodeId: 'flow-outcome-201',
      traceCount: 2,
      sourceShare: 1,
      targetShare: 1,
    },
    {
      sourceNodeId: 'flow-outcome-201',
      targetNodeId: 'flow-behavior-301',
      traceCount: 1,
      sourceShare: 0.5,
      targetShare: 1,
    },
    {
      sourceNodeId: 'flow-outcome-201',
      targetNodeId: 'flow-behavior-noise',
      traceCount: 1,
      sourceShare: 0.5,
      targetShare: 1,
    },
  ],
} satisfies ThemeFlowResponse;

export const themeDetailResponse = {
  snapshot,
  theme: {
    themeId: '101',
    signalName: 'goal',
    label: 'Add transcript',
    description: 'Users want to add a transcript to their workspace.',
    state: 'continue',
    traceCount: 2,
    coverage: 1,
  },
} satisfies ThemeDetailResponse;

export const missingThemeDetailResponse = {
  snapshot,
} satisfies ThemeDetailResponse;

export const firstThemeExamplesResponse = {
  examples: [
    {
      traceId: 'trace-1',
      extractedTraceId: 'extracted-1',
      signalText: 'Add this transcript to my workspace.',
      traceStartedAt: '2026-07-20T10:00:00.000Z',
    },
  ],
  nextOffset: 1,
} satisfies ThemeExamplesResponse;

export const secondThemeExamplesResponse = {
  examples: [
    {
      traceId: 'trace-2',
      extractedTraceId: 'extracted-2',
      signalText: 'Save the transcript with the project.',
    },
  ],
} satisfies ThemeExamplesResponse;

export const themeHistoryResponse = {
  theme: {
    themeId: '101',
    signalName: 'goal',
    label: 'Add transcript',
    description: 'Users want to add a transcript to their workspace.',
  },
  points: [
    {
      snapshotId: 'older-opaque-snapshot-cursor',
      startedAt: '2026-07-08T00:00:00.000Z',
      endedAt: '2026-07-15T00:00:00.000Z',
      state: 'birth',
      traceCount: 1,
      coverage: 0.5,
    },
    {
      snapshotId: 'opaque-snapshot-cursor',
      startedAt: '2026-07-15T00:00:00.000Z',
      endedAt: '2026-07-22T00:00:00.000Z',
      state: 'continue',
      traceCount: 2,
      coverage: 1,
    },
  ],
  relationships: [],
} satisfies ThemeHistoryResponse;

export const firstThemePathsResponse = {
  snapshot,
  signals: ['goal', 'outcome', 'behavior'],
  themes: {
    'opaque-goal-key': {
      signalName: 'goal',
      themeId: '101',
      label: 'Add transcript',
      description: 'Users want to add a transcript to their workspace.',
    },
    'opaque-outcome-key': {
      signalName: 'outcome',
      themeId: '201',
      label: 'Transcript added',
    },
    'opaque-behavior-key': {
      signalName: 'behavior',
      themeId: '301',
      label: 'Opened workspace',
    },
  },
  paths: [
    {
      traceId: 'trace-1',
      assignments: {
        goal: 'opaque-goal-key',
        outcome: 'opaque-outcome-key',
        behavior: 'opaque-behavior-key',
      },
    },
  ],
  nextOffset: 1,
} satisfies ThemePathsResponse;

export const secondThemePathsResponse = {
  snapshot,
  signals: ['goal', 'outcome', 'behavior'],
  themes: firstThemePathsResponse.themes,
  paths: [
    {
      traceId: 'trace-2',
      assignments: {
        goal: 'opaque-goal-key',
        outcome: 'opaque-outcome-key',
        behavior: 'noise-marker-from-api',
      },
    },
  ],
} satisfies ThemePathsResponse;
