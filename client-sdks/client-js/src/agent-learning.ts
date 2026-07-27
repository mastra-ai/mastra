export type TraceSignalName = 'goal' | 'sentiment' | 'behavior' | 'outcome';

export interface ThemeLearningEntity {
  entityId: string;
  entityType: string;
  availableSignals: TraceSignalName[];
  latestWindow?: {
    startedAt: string;
    endedAt: string;
  };
}

export interface ThemeSnapshot {
  snapshotId: string;
  ordinal: number;
  total: number;
  startedAt: string;
  endedAt: string;
  traceCount: number;
}

export type ThemeNode =
  | {
      nodeId: string;
      kind: 'theme';
      themeId: string;
      label: string;
      description?: string;
      traceCount: number;
      stageShare: number;
    }
  | {
      nodeId: string;
      kind: 'noise' | 'other';
      label: string;
      description?: string;
      traceCount: number;
      stageShare: number;
    };

export interface ThemeFlowResponse {
  snapshot: ThemeSnapshot;
  stages: Array<{
    signalName: TraceSignalName;
    traceCount: number;
    nodes: ThemeNode[];
  }>;
  links: Array<{
    sourceNodeId: string;
    targetNodeId: string;
    traceCount: number;
    sourceShare: number;
    targetShare: number;
  }>;
}

export interface ThemeSnapshotsResponse {
  snapshots: Array<ThemeSnapshot & { availableSignals: TraceSignalName[] }>;
  nextCursor?: string;
}

export interface ThemeEntitiesResponse {
  entities: ThemeLearningEntity[];
}

export interface ThemePathTheme {
  signalName: TraceSignalName;
  themeId: string;
  label: string;
  description?: string;
}

export interface ThemePathsResponse {
  snapshot: ThemeSnapshot;
  signals: TraceSignalName[];
  themes: Record<string, ThemePathTheme>;
  paths: Array<{
    traceId: string;
    assignments: Record<string, string>;
  }>;
  nextOffset?: number;
}

export type ActiveThemeState = 'birth' | 'continue' | 'split' | 'merge' | 'resurrection';
export type ThemeHistoryState = ActiveThemeState | 'death';

export interface ThemeTrend {
  popularity: number;
  signalScore: number;
  strength: 'none' | 'weak' | 'strong';
}

export interface SnapshotTheme {
  themeId: string;
  label: string;
  description?: string;
  state: ActiveThemeState;
  traceCount: number;
  coverage: number;
  trend?: ThemeTrend;
}

export interface ThemesResponse {
  snapshot: ThemeSnapshot;
  signalName: TraceSignalName;
  themes: SnapshotTheme[];
  noise: {
    traceCount: number;
    coverage: number;
  };
}

export interface ThemeDetailResponse {
  snapshot: ThemeSnapshot;
  theme?: SnapshotTheme & { signalName: TraceSignalName };
}

export interface ThemeExample {
  traceId: string;
  extractedTraceId: string;
  signalText: string;
  traceStartedAt?: string;
}

export interface ThemeExamplesResponse {
  examples: ThemeExample[];
  nextOffset?: number;
}

export type NoiseExamplesResponse = ThemeExamplesResponse;

export interface ThemeHistoryResponse {
  theme: {
    themeId: string;
    signalName: TraceSignalName;
    label: string;
    description?: string;
  };
  points: Array<{
    snapshotId: string;
    startedAt: string;
    endedAt: string;
    state: ThemeHistoryState;
    traceCount: number;
    coverage: number;
    trend?: ThemeTrend;
  }>;
  relationships: Array<{
    snapshotId: string;
    kind: 'split-from' | 'split-into' | 'merged-from' | 'merged-into';
    relatedTheme: {
      themeId: string;
      label: string;
    };
  }>;
  nextCursor?: string;
}

export interface NoiseResponse {
  snapshot: ThemeSnapshot;
  noise: {
    signalName: TraceSignalName;
    traceCount: number;
    coverage: number;
  };
}
