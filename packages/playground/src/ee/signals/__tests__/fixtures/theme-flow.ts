import type { ThemeEntitiesResponse, ThemeFlowResponse, ThemeSnapshotsResponse } from '../../types';

export const emptyThemeEntitiesResponse: ThemeEntitiesResponse = { entities: [] };

export const populatedThemeEntitiesResponse: ThemeEntitiesResponse = {
  entities: [
    {
      entityId: 'support-agent',
      entityType: 'agent',
      availableSignals: ['behavior', 'goal', 'outcome', 'sentiment'],
      latestWindow: {
        startedAt: '2026-07-01T00:00:00.000Z',
        endedAt: '2026-07-08T00:00:00.000Z',
      },
    },
  ],
};

export const themeSnapshotsResponse: ThemeSnapshotsResponse = {
  snapshots: [
    {
      snapshotId: 'snapshot-1',
      ordinal: 1,
      total: 1,
      startedAt: '2026-07-01T00:00:00.000Z',
      endedAt: '2026-07-08T00:00:00.000Z',
      traceCount: 3,
      availableSignals: ['goal', 'outcome'],
    },
  ],
};

export const emptyThemeSnapshotsResponse: ThemeSnapshotsResponse = { snapshots: [] };

export const themeFlowResponse: ThemeFlowResponse = {
  snapshot: themeSnapshotsResponse.snapshots[0],
  stages: [
    {
      signalName: 'goal',
      traceCount: 3,
      nodes: [
        {
          nodeId: 'goal-support',
          kind: 'theme',
          themeId: 'theme-goal-support',
          label: 'Resolve support request',
          traceCount: 3,
          stageShare: 1,
        },
      ],
    },
    {
      signalName: 'outcome',
      traceCount: 3,
      nodes: [
        {
          nodeId: 'outcome-resolved',
          kind: 'theme',
          themeId: 'theme-outcome-resolved',
          label: 'Request resolved',
          traceCount: 3,
          stageShare: 1,
        },
      ],
    },
  ],
  links: [
    {
      sourceNodeId: 'goal-support',
      targetNodeId: 'outcome-resolved',
      traceCount: 3,
      sourceShare: 1,
      targetShare: 1,
    },
  ],
};

export const fourStageThemeFlowResponse: ThemeFlowResponse = {
  snapshot: {
    ...themeSnapshotsResponse.snapshots[0],
    availableSignals: ['goal', 'sentiment', 'behavior', 'outcome'],
  },
  stages: [
    themeFlowResponse.stages[0],
    {
      signalName: 'sentiment',
      traceCount: 3,
      nodes: [
        {
          nodeId: 'sentiment-frustrated',
          kind: 'theme',
          themeId: 'theme-sentiment-frustrated',
          label: 'Frustrated user',
          traceCount: 3,
          stageShare: 1,
        },
      ],
    },
    {
      signalName: 'behavior',
      traceCount: 3,
      nodes: [
        {
          nodeId: 'behavior-search',
          kind: 'theme',
          themeId: 'theme-behavior-search',
          label: 'Search knowledge base',
          traceCount: 3,
          stageShare: 1,
        },
      ],
    },
    themeFlowResponse.stages[1],
  ],
  links: [
    {
      sourceNodeId: 'goal-support',
      targetNodeId: 'sentiment-frustrated',
      traceCount: 3,
      sourceShare: 1,
      targetShare: 1,
    },
    {
      sourceNodeId: 'sentiment-frustrated',
      targetNodeId: 'behavior-search',
      traceCount: 3,
      sourceShare: 1,
      targetShare: 1,
    },
    {
      sourceNodeId: 'behavior-search',
      targetNodeId: 'outcome-resolved',
      traceCount: 3,
      sourceShare: 1,
      targetShare: 1,
    },
  ],
};

export const singleStageThemeFlowResponse: ThemeFlowResponse = {
  ...themeFlowResponse,
  stages: themeFlowResponse.stages.slice(0, 1),
  links: [],
};
