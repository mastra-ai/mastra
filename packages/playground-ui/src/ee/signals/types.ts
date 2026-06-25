// Entity Learning API response types.
//
// These mirror the real `/entity-learning/*` endpoint payloads and are the
// source of truth for the signals domain. Hooks return these shapes unchanged;
// components read these fields directly. The only adaptation allowed is at the
// render boundary where generic topics components require their own prop types.

export interface EntityLearningEntity {
  organizationId: string;
  projectId: string;
  entityType: string;
  entityId: string;
  availableSignals: string[];
  latestRunId: string;
  latestRunAt: string;
  runCount: number;
  topicCount: number;
  sourceItemCount: number;
  groupedItemCount: number;
  outlierItemCount: number;
}

export interface EntitiesResponse {
  entities: EntityLearningEntity[];
}

export interface EntityLearningRun {
  runId: string;
  createdAt: string;
  organizationId?: string;
  projectId?: string;
  entityType?: string;
  entityId?: string;
  signalName: string;
  signalVersion: string;
  embeddingModel: string;
  embeddingVersion: string;
  clusteringVersion: string;
  projectionVersion: string | null;
  topicCount: number;
  sourceItemCount: number;
  groupedItemCount: number;
  outlierItemCount: number;
}

export interface RunsResponse {
  runs: EntityLearningRun[];
}

export interface RunResponse {
  run: EntityLearningRun;
}

export interface EntityLearningTopic {
  topicId: string;
  runId: string;
  signalName: string;
  name: string;
  description: string;
  itemCount: number;
  coverage: number;
  score: number;
}

export interface EntityLearningTopicsRun {
  runId: string;
  signalName: string;
  topicCount: number;
  sourceItemCount: number;
  groupedItemCount: number;
  outlierItemCount: number;
}

export interface EntityLearningTopicsResponse {
  run: EntityLearningTopicsRun;
  topics: EntityLearningTopic[];
}

export interface EntityLearningExample {
  exampleId: string;
  runId: string;
  signalName: string;
  topicId?: string;
  isOutlier: boolean;
  signalId: string;
  traceId: string;
  extractedTraceId: string;
  signalText: string;
  x: number;
  y: number;
}

export interface TopicExamplesResponse {
  runId: string;
  examples: EntityLearningExample[];
  nextOffset: number | null;
}

export interface EntityLearningPoint {
  exampleId: string;
  runId: string;
  signalName: string;
  topicId?: string;
  isOutlier: boolean;
  x: number;
  y: number;
}

export interface PointsResponse {
  runId: string;
  points: EntityLearningPoint[];
}
