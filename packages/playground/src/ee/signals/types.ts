export type TraceSignalName = 'goal' | 'sentiment' | 'behavior' | 'outcome';

export interface ThemeLearningEntity {
  entityId: string;
  entityType: string;
  availableSignals: TraceSignalName[];
  latestWindow?: { startedAt: string; endedAt: string };
}

export interface ThemeSnapshot {
  snapshotId: string;
  ordinal: number;
  total: number;
  startedAt: string;
  endedAt: string;
  traceCount: number;
  availableSignals?: string[];
}

export interface ThemeNode {
  nodeId: string;
  kind: 'theme' | 'noise' | 'other';
  themeId?: string;
  label: string;
  description?: string;
  traceCount: number;
  stageShare: number;
}

export interface ThemeFlowResponse {
  snapshot: ThemeSnapshot;
  stages: Array<{ signalName: TraceSignalName; traceCount: number; nodes: ThemeNode[] }>;
  links: Array<{
    sourceNodeId: string;
    targetNodeId: string;
    traceCount: number;
    sourceShare: number;
    targetShare: number;
  }>;
}

export interface ThemeSnapshotsResponse {
  snapshots: ThemeSnapshot[];
  nextCursor?: string;
}

export interface ThemeEntitiesResponse {
  entities: ThemeLearningEntity[];
}
