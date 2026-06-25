import type {
  EntitiesResponse,
  EntityLearningEntity,
  EntityLearningExample,
  EntityLearningPoint,
  EntityLearningTopic,
  EntityLearningTopicsResponse,
  PointsResponse,
  TopicExamplesResponse,
} from '../../../types';

export const ENTITY_ID = 'entity_b3985b6805ec5177f005ff9228063330';

export const entityFixture: EntityLearningEntity = {
  organizationId: 'org_01KTP5C8V9945SP61K5NADKW36',
  projectId: 'resource_41dfb5ea35f049ff898c64542c739e18',
  entityType: 'agent',
  entityId: ENTITY_ID,
  availableSignals: ['behavior', 'goal', 'outcome', 'sentiment'],
  latestRunId: '32',
  latestRunAt: '2026-06-19T20:04:13.093Z',
  runCount: 8,
  topicCount: 13,
  sourceItemCount: 520,
  groupedItemCount: 293,
  outlierItemCount: 227,
};

export const entitiesResponse: EntitiesResponse = {
  entities: [entityFixture],
};

export const topicsFixture: EntityLearningTopic[] = [
  {
    topicId: '89',
    runId: '32',
    signalName: 'sentiment',
    name: 'Neutral Curiosity',
    description:
      'User displays low emotional escalation and neutral affect driven by curiosity, allowing reviewers to prioritize factual correctness over sentiment handling.',
    itemCount: 63,
    coverage: 0.4846153846153846,
    score: 0.9565292150806647,
  },
  {
    topicId: '90',
    runId: '32',
    signalName: 'sentiment',
    name: 'Low-Emotion Curiosity',
    description:
      'Because the user shows low emotional escalation and is primarily curious, reviewers should prioritize factual accuracy and tool usage over affective concerns.',
    itemCount: 6,
    coverage: 0.046153846153846156,
    score: 0.974719927889996,
  },
];

export const topicsResponse: EntityLearningTopicsResponse = {
  run: {
    runId: '32',
    signalName: 'sentiment',
    topicCount: 2,
    sourceItemCount: 130,
    groupedItemCount: 69,
    outlierItemCount: 61,
  },
  topics: topicsFixture,
};

export const examplesFixture: EntityLearningExample[] = [
  {
    exampleId: '668',
    runId: '32',
    signalName: 'sentiment',
    topicId: '89',
    isOutlier: false,
    signalId: 'trace_signal_34e1e9a6d6bc',
    traceId: '04cc25ff8b5db797aa0ab4f1ce8d41da',
    extractedTraceId: 'extracted_trace_050',
    signalText:
      'The user’s affect is low‑intensity, dominated by curiosity rather than strong emotions, so the reviewer can focus on the accuracy of the factual answer.',
    x: -0.116745114,
    y: -0.08240069,
  },
  {
    exampleId: '719',
    runId: '32',
    signalName: 'sentiment',
    topicId: '89',
    isOutlier: false,
    signalId: 'trace_signal_b4bb91a41d4f',
    traceId: '050526e60bb1acdbdfbcf7cf22ad1b2c',
    extractedTraceId: 'extracted_trace_059',
    signalText:
      'The user shows low emotional escalation, primarily curiosity, indicating a straightforward informational request.',
    x: 0.0018650416,
    y: -0.32342345,
  },
];

export const topicExamplesResponse: TopicExamplesResponse = {
  runId: '32',
  examples: examplesFixture,
  nextOffset: 2,
};

export const pointsFixture: EntityLearningPoint[] = [
  {
    exampleId: '668',
    runId: '32',
    signalName: 'sentiment',
    topicId: '89',
    isOutlier: false,
    x: -0.116745114,
    y: -0.08240069,
  },
  {
    exampleId: '683',
    runId: '32',
    signalName: 'sentiment',
    isOutlier: true,
    x: 0.24744661,
    y: 0.36131206,
  },
];

export const pointsResponse: PointsResponse = {
  runId: '32',
  points: pointsFixture,
};
