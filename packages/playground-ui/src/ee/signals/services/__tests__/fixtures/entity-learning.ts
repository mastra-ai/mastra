import type {
  EntityLearningEntitiesResponse,
  EntityLearningRunsResponse,
  EntityLearningRunResponse,
  EntityLearningLearningResponse,
  EntityLearningTopicsResponse,
  EntityLearningTopicResponse,
  EntityLearningTopicExamplesResponse,
  EntityLearningOutliersResponse,
} from '../../entity-learning-types';

export const entitiesResponse: EntityLearningEntitiesResponse = {
  entities: [
    {
      organizationId: 'org-1',
      projectId: 'proj-1',
      entityType: 'agent',
      entityId: 'entity_support',
      availableSignals: ['sentiment', 'behavior'],
      latestRunId: '32',
      latestRunAt: '2026-06-29T00:00:00.000Z',
      runCount: 3,
      topicCount: 4,
      sourceItemCount: 120,
      groupedItemCount: 100,
      outlierItemCount: 20,
    },
    {
      organizationId: 'org-1',
      projectId: 'proj-1',
      entityType: 'tool',
      entityId: 'entity_search',
      availableSignals: ['outcome'],
      latestRunId: '7',
      latestRunAt: '2026-06-28T00:00:00.000Z',
      runCount: 1,
      topicCount: 2,
      sourceItemCount: 40,
      groupedItemCount: 35,
      outlierItemCount: 5,
    },
  ],
};

export const runsResponse: EntityLearningRunsResponse = {
  runs: [
    {
      runId: '32',
      createdAt: '2026-06-29T00:00:00.000Z',
      organizationId: 'org-1',
      projectId: 'proj-1',
      entityType: 'agent',
      entityId: 'entity_support',
      signalName: 'sentiment',
      signalVersion: '1',
      embeddingModel: 'text-embedding-3-small',
      embeddingVersion: '1',
      clusteringVersion: '1',
      projectionVersion: '1',
      topicCount: 4,
      sourceItemCount: 120,
      groupedItemCount: 100,
      outlierItemCount: 20,
    },
  ],
};

export const runResponse: EntityLearningRunResponse = {
  run: runsResponse.runs[0],
};

export const learningResponse: EntityLearningLearningResponse = {
  learning: {
    runId: '32',
    createdAt: '2026-06-29T00:00:00.000Z',
    entityType: 'agent',
    entityId: 'entity_support',
    signalName: 'sentiment',
    signalVersion: '1',
    embeddingModel: 'text-embedding-3-small',
    embeddingVersion: '1',
    clusteringVersion: '1',
    projectionVersion: '1',
    topicCount: 4,
    totalItemCount: 120,
    topicItemCount: 100,
    outlierItemCount: 20,
    topicCoverage: 0.83,
    outlierCoverage: 0.17,
  },
};

export const topicsResponse: EntityLearningTopicsResponse = {
  run: {
    runId: '32',
    signalName: 'sentiment',
    topicCount: 2,
    sourceItemCount: 120,
    groupedItemCount: 100,
    outlierItemCount: 20,
  },
  topics: [
    {
      topicId: '89',
      runId: '32',
      signalName: 'sentiment',
      name: 'Frustrated escalations',
      description: 'Users expressing frustration before escalating.',
      itemCount: 60,
      coverage: 0.5,
      score: 0.9,
    },
    {
      topicId: '90',
      runId: '32',
      signalName: 'sentiment',
      name: 'Satisfied resolutions',
      description: 'Users confirming the issue was resolved.',
      itemCount: 40,
      coverage: 0.33,
      score: 0.8,
    },
  ],
};

/**
 * Latest `behavior` run for entity_support. Runs are per-signal, so this run
 * ('31') differs from the entity-wide `latestRunId` ('32', a `sentiment` run).
 */
export const behaviorTopicsResponse: EntityLearningTopicsResponse = {
  run: {
    runId: '31',
    signalName: 'behavior',
    topicCount: 1,
    sourceItemCount: 50,
    groupedItemCount: 45,
    outlierItemCount: 5,
  },
  topics: [
    {
      topicId: '77',
      runId: '31',
      signalName: 'behavior',
      name: 'Repeated retries',
      description: 'Users retrying the same failing action.',
      itemCount: 45,
      coverage: 0.9,
      score: 0.7,
    },
  ],
};

export const topicResponse: EntityLearningTopicResponse = {
  topic: topicsResponse.topics[0],
};

export const topicExamplesResponse: EntityLearningTopicExamplesResponse = {
  runId: '32',
  examples: [
    {
      exampleId: 'ex-1',
      runId: '32',
      signalName: 'sentiment',
      topicId: '89',
      isOutlier: false,
      signalId: 'sig-1',
      traceId: 'trace-1',
      extractedTraceId: 'extracted-1',
      signalText: 'This is taking forever.',
      x: 0.1,
      y: 0.2,
    },
  ],
  nextOffset: null,
};

export const outliersResponse: EntityLearningOutliersResponse = {
  run: {
    runId: '32',
    signalName: 'sentiment',
    topicCount: 2,
    sourceItemCount: 120,
    groupedItemCount: 100,
    outlierItemCount: 20,
  },
  outliers: {
    runId: '32',
    itemCount: 20,
    coverage: 0.17,
    signalName: 'sentiment',
  },
};
