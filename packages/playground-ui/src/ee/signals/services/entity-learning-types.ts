/**
 * Typed contract for the platform Entity-Learning API.
 * Mirrors the payloads documented in entity-learning-sample-usage.md.
 * Base URL is the platform observability endpoint; routes live under `/entity-learning`.
 */

export type EntityLearningEntitySummary = {
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
};

export type EntityLearningRun = {
  runId: string;
  createdAt: string;
  organizationId?: string;
  projectId?: string;
  entityType: string;
  entityId: string;
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
};

export type EntityLearningLearning = {
  runId: string;
  createdAt: string;
  entityType: string;
  entityId: string;
  signalName: string;
  signalVersion: string;
  embeddingModel: string;
  embeddingVersion: string;
  clusteringVersion: string;
  projectionVersion: string | null;
  topicCount: number;
  totalItemCount: number;
  topicItemCount: number;
  outlierItemCount: number;
  topicCoverage: number;
  outlierCoverage: number;
};

/** Compact run summary embedded in topics/outliers responses. */
export type EntityLearningRunSummary = {
  runId: string;
  signalName: string;
  topicCount: number;
  sourceItemCount: number;
  groupedItemCount: number;
  outlierItemCount: number;
};

/** A topic is a "cluster" of signals in the UI. */
export type EntityLearningTopic = {
  topicId: string;
  runId: string;
  signalName: string;
  name: string;
  description: string;
  itemCount: number;
  coverage: number;
  score: number;
};

export type EntityLearningTopicExample = {
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
};

export type EntityLearningPoint = {
  exampleId: string;
  runId: string;
  signalName: string;
  topicId?: string;
  isOutlier: boolean;
  x: number;
  y: number;
};

export type EntityLearningOutliers = {
  runId: string;
  itemCount: number;
  coverage: number;
  signalName: string;
};

// --- Response wrappers ---

export type EntityLearningEntitiesResponse = {
  entities: EntityLearningEntitySummary[];
};

export type EntityLearningRunsResponse = {
  runs: EntityLearningRun[];
};

export type EntityLearningRunResponse = {
  run: EntityLearningRun;
};

export type EntityLearningLearningResponse = {
  learning: EntityLearningLearning;
};

export type EntityLearningTopicsResponse = {
  run: EntityLearningRunSummary;
  topics: EntityLearningTopic[];
};

export type EntityLearningTopicResponse = {
  topic: EntityLearningTopic;
};

export type EntityLearningTopicExamplesResponse = {
  runId: string;
  examples: EntityLearningTopicExample[];
  nextOffset: number | null;
};

export type EntityLearningPointsResponse = {
  runId: string;
  points: EntityLearningPoint[];
};

export type EntityLearningOutliersResponse = {
  run: EntityLearningRunSummary;
  outliers: EntityLearningOutliers;
};
