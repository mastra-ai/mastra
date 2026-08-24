export type BuiltInTraceSignalName = 'goal' | 'sentiment' | 'behavior' | 'outcome';

export type TraceSignalName = string;

export type EntityLearningProgressStatus = 'collecting' | 'processing' | 'ready';

export interface SignalCatalogEntry {
  name: string;
  label: string;
  description: string;
  order: number;
  builtIn: boolean;
  enabled: boolean;
  status: EntityLearningProgressStatus;
}

export interface EntityLearningProgressResponse {
  status: EntityLearningProgressStatus;
  traceCount: number;
  signals: Record<string, { generated: number; embedded: number }>;
  availableSignals: TraceSignalName[];
  signalCatalog?: SignalCatalogEntry[];
}

export type TraceSignalArtifact =
  | 'latestUserInput'
  | 'minifiedTrace'
  | 'summary'
  | 'tags'
  | 'entityIntent'
  | 'entityIntentSummary';

export interface TraceSignalDefinition {
  id: string;
  name: string;
  displayLabel: string;
  description: string;
  taskPrompt: string;
  artifactAllowlist: TraceSignalArtifact[];
  version: number;
  status: 'active' | 'archived';
  enabled: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface TraceSignalManagementListResponse {
  definitions: TraceSignalDefinition[];
  limits: {
    maxDefinitionsPerOrganization: number;
  };
}

export interface CreateTraceSignalDefinitionInput {
  name: string;
  displayLabel: string;
  description: string;
  taskPrompt: string;
  artifactAllowlist: TraceSignalArtifact[];
}

export type UpdateTraceSignalDefinitionInput = Omit<CreateTraceSignalDefinitionInput, 'name'>;

export interface ProjectTraceSignalSetting {
  projectId: string;
  signalDefinitionId: string;
  enabled: boolean;
}

export interface ThemeLearningEntity {
  entityId: string;
  entityType: string;
  availableSignals: TraceSignalName[];
  signalCatalog?: SignalCatalogEntry[];
  traceCount?: number;
  readySignalCount?: number;
  enabledSignalCount?: number;
  status?: EntityLearningProgressStatus;
  updatedAt?: string;
  latestWindow?: {
    startedAt: string;
    endedAt: string;
  };
}

export interface ThemeSnapshot {
  snapshotId: string;
  ordinal: number;
  total: number;
  /** When this snapshot became the current cross-signal state. Drives time-axis placement. */
  cutoffAt?: string;
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

export type ThemeSnapshotLandmarkReason = 'range_start' | 'range_end' | 'time_sample';

export interface ThemeSnapshotsResponse {
  snapshots: Array<ThemeSnapshot & { availableSignals: TraceSignalName[]; reason?: ThemeSnapshotLandmarkReason }>;
  signalCatalog?: SignalCatalogEntry[];
  nextCursor?: string;
  totalSnapshots?: number;
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

export interface TraceInsightSummary {
  version: string;
  summary: string;
  observations: string[];
  currentTask?: string;
  degenerate?: boolean;
  createdAt: string;
}

export interface TraceInsightResponse {
  traceId: string;
  summary?: TraceInsightSummary;
  signals: Array<{
    signalName: TraceSignalName;
    signalText: string;
  }>;
}
