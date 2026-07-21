import type {
  ThemeDetailResponse,
  ThemeExamplesResponse,
  ThemeFlowResponse,
  ThemeHistoryResponse,
  ThemePathsResponse,
  ThemeSnapshotsResponse,
} from '@mastra/client-js';

const snapshot = {
  snapshotId: 'opaque-snapshot-cursor',
  ordinal: 4,
  total: 4,
  startedAt: '2026-07-15T00:00:00.000Z',
  endedAt: '2026-07-22T00:00:00.000Z',
  traceCount: 3,
  availableSignals: ['goal', 'outcome', 'behavior'],
} satisfies ThemeSnapshotsResponse['snapshots'][number];

export const drilldownThemeSnapshotsResponse = {
  snapshots: [snapshot],
} satisfies ThemeSnapshotsResponse;

export const singleDrilldownThemeSnapshotsResponse = {
  snapshots: [{ ...snapshot, ordinal: 1, total: 1 }],
} satisfies ThemeSnapshotsResponse;

export const twoDrilldownThemeSnapshotsResponse = {
  snapshots: [
    {
      ...snapshot,
      snapshotId: 'older-opaque-snapshot-cursor',
      ordinal: 3,
      startedAt: '2026-07-08T00:00:00.000Z',
      endedAt: '2026-07-15T00:00:00.000Z',
    },
    snapshot,
  ],
} satisfies ThemeSnapshotsResponse;

export const drilldownThemeFlowResponse = {
  snapshot: { ...snapshot, snapshotId: 'opaque-flow-response-cursor' },
  stages: [
    {
      signalName: 'goal',
      traceCount: 3,
      nodes: [
        {
          nodeId: 'flow-goal-101',
          kind: 'theme',
          themeId: '101',
          label: 'Add transcript',
          description: 'Users want to add a transcript to their workspace.',
          traceCount: 2,
          stageShare: 2 / 3,
        },
        {
          nodeId: 'flow-goal-other',
          kind: 'other',
          label: 'Other',
          traceCount: 1,
          stageShare: 1 / 3,
        },
      ],
    },
    {
      signalName: 'outcome',
      traceCount: 3,
      nodes: [
        {
          nodeId: 'flow-outcome-201',
          kind: 'theme',
          themeId: '201',
          label: 'Transcript added',
          traceCount: 2,
          stageShare: 2 / 3,
        },
        {
          nodeId: 'flow-outcome-other',
          kind: 'other',
          label: 'Other',
          traceCount: 1,
          stageShare: 1 / 3,
        },
      ],
    },
    {
      signalName: 'behavior',
      traceCount: 3,
      nodes: [
        {
          nodeId: 'flow-behavior-301',
          kind: 'theme',
          themeId: '301',
          label: 'Opened workspace',
          traceCount: 1,
          stageShare: 1 / 3,
        },
        {
          nodeId: 'flow-behavior-noise',
          kind: 'noise',
          label: 'Noise',
          traceCount: 2,
          stageShare: 2 / 3,
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
      sourceNodeId: 'flow-goal-other',
      targetNodeId: 'flow-outcome-other',
      traceCount: 1,
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
      targetShare: 0.5,
    },
    {
      sourceNodeId: 'flow-outcome-other',
      targetNodeId: 'flow-behavior-noise',
      traceCount: 1,
      sourceShare: 1,
      targetShare: 0.5,
    },
  ],
} satisfies ThemeFlowResponse;

export const olderDrilldownThemeFlowResponse = {
  ...drilldownThemeFlowResponse,
  snapshot: twoDrilldownThemeSnapshotsResponse.snapshots[0],
} satisfies ThemeFlowResponse;

export const largeThemeFlowResponse = {
  ...drilldownThemeFlowResponse,
  snapshot: { ...drilldownThemeFlowResponse.snapshot, traceCount: 2001 },
} satisfies ThemeFlowResponse;

export const nonNumericThemeFlowResponse = {
  ...drilldownThemeFlowResponse,
  stages: [
    {
      ...drilldownThemeFlowResponse.stages[0],
      nodes: [
        drilldownThemeFlowResponse.stages[0].nodes[0],
        {
          ...drilldownThemeFlowResponse.stages[0].nodes[1],
          kind: 'theme',
          themeId: 'legacy-theme-id',
          label: 'Legacy theme',
        },
      ],
    },
    drilldownThemeFlowResponse.stages[1],
    drilldownThemeFlowResponse.stages[2],
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
    coverage: 2 / 3,
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
      coverage: 2 / 3,
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
    'opaque-goal-other-key': {
      signalName: 'goal',
      themeId: '102',
      label: 'Search transcripts',
    },
    'opaque-outcome-other-key': {
      signalName: 'outcome',
      themeId: '202',
      label: 'Transcript located',
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
    {
      traceId: 'trace-3',
      assignments: {
        goal: 'opaque-goal-other-key',
        outcome: 'opaque-outcome-other-key',
        behavior: 'another-noise-marker-from-api',
      },
    },
  ],
} satisfies ThemePathsResponse;

export const allThemePathsResponse = {
  ...firstThemePathsResponse,
  paths: [...firstThemePathsResponse.paths, ...secondThemePathsResponse.paths],
  nextOffset: undefined,
} satisfies ThemePathsResponse;

export const pathsWithCollapsedOutcomeResponse = {
  ...allThemePathsResponse,
  paths: [
    {
      traceId: 'trace-1',
      assignments: {
        goal: 'opaque-goal-key',
        outcome: 'opaque-outcome-other-key',
        behavior: 'opaque-behavior-key',
      },
    },
  ],
} satisfies ThemePathsResponse;

export const missingSelectedThemePathsResponse = {
  ...firstThemePathsResponse,
  snapshot: twoDrilldownThemeSnapshotsResponse.snapshots[0],
  themes: {},
  paths: [],
  nextOffset: undefined,
} satisfies ThemePathsResponse;
