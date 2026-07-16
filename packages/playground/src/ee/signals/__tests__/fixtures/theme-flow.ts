import type { ThemeFlowResponse, ThemeSnapshotsResponse } from '../../types';

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
