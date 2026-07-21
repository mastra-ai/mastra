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
      ordinal: 4,
      total: 4,
      startedAt: '2026-07-01T00:00:00.000Z',
      endedAt: '2026-07-08T00:00:00.000Z',
      traceCount: 50,
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
      traceCount: 50,
      nodes: [
        {
          nodeId: 'goal-support',
          kind: 'theme',
          themeId: 'theme-goal-support',
          label: 'Resolve support request',
          traceCount: 50,
          stageShare: 1,
        },
      ],
    },
    {
      signalName: 'outcome',
      traceCount: 50,
      nodes: [
        {
          nodeId: 'outcome-resolved',
          kind: 'theme',
          themeId: 'theme-outcome-resolved',
          label: 'Request resolved',
          traceCount: 50,
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
      sourceShare: 0.06,
      targetShare: 0.06,
    },
  ],
};

export const fourStageThemeFlowResponse: ThemeFlowResponse = {
  snapshot: {
    ...themeSnapshotsResponse.snapshots[0],
    availableSignals: ['goal', 'outcome', 'behavior', 'sentiment'],
  },
  stages: [
    {
      signalName: 'goal',
      traceCount: 50,
      nodes: [
        {
          nodeId: 'goal-support',
          kind: 'theme',
          themeId: 'theme-goal-support',
          label: 'Resolve support request',
          traceCount: 22,
          stageShare: 0.44,
        },
        {
          nodeId: 'goal-billing',
          kind: 'theme',
          themeId: 'theme-goal-billing',
          label: 'Clarify a billing charge',
          traceCount: 17,
          stageShare: 0.34,
        },
        {
          nodeId: 'goal-account',
          kind: 'theme',
          themeId: 'theme-goal-account',
          label: 'Restore account access',
          traceCount: 11,
          stageShare: 0.22,
        },
      ],
    },
    {
      signalName: 'outcome',
      traceCount: 50,
      nodes: [
        {
          nodeId: 'outcome-resolved',
          kind: 'theme',
          themeId: 'theme-outcome-resolved',
          label: 'Request resolved',
          traceCount: 31,
          stageShare: 0.62,
        },
        {
          nodeId: 'outcome-follow-up',
          kind: 'theme',
          themeId: 'theme-outcome-follow-up',
          label: 'Follow-up required',
          traceCount: 19,
          stageShare: 0.38,
        },
      ],
    },
    {
      signalName: 'behavior',
      traceCount: 50,
      nodes: [
        {
          nodeId: 'behavior-search',
          kind: 'theme',
          themeId: 'theme-behavior-search',
          label: 'Search knowledge base',
          traceCount: 34,
          stageShare: 0.68,
        },
        {
          nodeId: 'behavior-escalate',
          kind: 'theme',
          themeId: 'theme-behavior-escalate',
          label: 'Escalate to a specialist',
          traceCount: 16,
          stageShare: 0.32,
        },
      ],
    },
    {
      signalName: 'sentiment',
      traceCount: 50,
      nodes: [
        {
          nodeId: 'sentiment-frustrated',
          kind: 'theme',
          themeId: 'theme-sentiment-frustrated',
          label: 'Frustrated user',
          traceCount: 29,
          stageShare: 0.58,
        },
        {
          nodeId: 'sentiment-neutral',
          kind: 'theme',
          themeId: 'theme-sentiment-neutral',
          label: 'Neutral user',
          traceCount: 21,
          stageShare: 0.42,
        },
      ],
    },
  ],
  links: [
    {
      sourceNodeId: 'goal-support',
      targetNodeId: 'outcome-resolved',
      traceCount: 16,
      sourceShare: 16 / 22,
      targetShare: 16 / 31,
    },
    {
      sourceNodeId: 'goal-support',
      targetNodeId: 'outcome-follow-up',
      traceCount: 6,
      sourceShare: 6 / 22,
      targetShare: 6 / 19,
    },
    {
      sourceNodeId: 'goal-billing',
      targetNodeId: 'outcome-resolved',
      traceCount: 10,
      sourceShare: 10 / 17,
      targetShare: 10 / 31,
    },
    {
      sourceNodeId: 'goal-billing',
      targetNodeId: 'outcome-follow-up',
      traceCount: 7,
      sourceShare: 7 / 17,
      targetShare: 7 / 19,
    },
    {
      sourceNodeId: 'goal-account',
      targetNodeId: 'outcome-resolved',
      traceCount: 5,
      sourceShare: 5 / 11,
      targetShare: 5 / 31,
    },
    {
      sourceNodeId: 'goal-account',
      targetNodeId: 'outcome-follow-up',
      traceCount: 6,
      sourceShare: 6 / 11,
      targetShare: 6 / 19,
    },
    {
      sourceNodeId: 'outcome-resolved',
      targetNodeId: 'behavior-search',
      traceCount: 23,
      sourceShare: 23 / 31,
      targetShare: 23 / 34,
    },
    {
      sourceNodeId: 'outcome-resolved',
      targetNodeId: 'behavior-escalate',
      traceCount: 8,
      sourceShare: 8 / 31,
      targetShare: 0.5,
    },
    {
      sourceNodeId: 'outcome-follow-up',
      targetNodeId: 'behavior-search',
      traceCount: 11,
      sourceShare: 11 / 19,
      targetShare: 11 / 34,
    },
    {
      sourceNodeId: 'outcome-follow-up',
      targetNodeId: 'behavior-escalate',
      traceCount: 8,
      sourceShare: 8 / 19,
      targetShare: 0.5,
    },
    {
      sourceNodeId: 'behavior-search',
      targetNodeId: 'sentiment-frustrated',
      traceCount: 21,
      sourceShare: 21 / 34,
      targetShare: 21 / 29,
    },
    {
      sourceNodeId: 'behavior-search',
      targetNodeId: 'sentiment-neutral',
      traceCount: 13,
      sourceShare: 13 / 34,
      targetShare: 13 / 21,
    },
    {
      sourceNodeId: 'behavior-escalate',
      targetNodeId: 'sentiment-frustrated',
      traceCount: 8,
      sourceShare: 0.5,
      targetShare: 8 / 29,
    },
    {
      sourceNodeId: 'behavior-escalate',
      targetNodeId: 'sentiment-neutral',
      traceCount: 8,
      sourceShare: 0.5,
      targetShare: 8 / 21,
    },
  ],
};

export const inconsistentTraceCountThemeFlowResponse: ThemeFlowResponse = {
  ...fourStageThemeFlowResponse,
  snapshot: {
    ...fourStageThemeFlowResponse.snapshot,
    traceCount: 80,
  },
  stages: fourStageThemeFlowResponse.stages.map((stage, stageIndex) => ({
    ...stage,
    traceCount: 70 + stageIndex * 10,
    nodes: [
      ...stage.nodes.map((node, nodeIndex) => ({
        ...node,
        traceCount: node.traceCount + 20 + nodeIndex,
        stageShare: 0.9 - nodeIndex * 0.1,
      })),
      ...(stage.signalName === 'goal'
        ? [
            {
              nodeId: 'goal-disconnected',
              kind: 'theme',
              themeId: 'theme-goal-disconnected',
              label: 'Metadata only goal',
              traceCount: 99,
              stageShare: 0.99,
            },
          ]
        : []),
    ],
  })),
};

export const singleStageThemeFlowResponse: ThemeFlowResponse = {
  ...themeFlowResponse,
  stages: themeFlowResponse.stages.slice(0, 1),
  links: [],
};
