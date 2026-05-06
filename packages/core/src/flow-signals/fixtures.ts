import type { DecisionFrame, FlowDecisionPoint, FlowPolicy } from './schemas';

export const baseFlowPolicy: FlowPolicy = {
  version: 1,
  id: 'policy.default',
  requiredCapabilities: ['retrieval'],
  allowedTools: ['knowledge.search'],
  deniedTools: ['network.write'],
  requiredEvidence: [{ id: 'evidence.retrieval', kind: 'retrieval', requiredCount: 1, match: {} }],
  outputContractId: 'contract.summary.v1',
  maxRetries: 1,
  clarificationRequired: false,
};

const decisionPoints: FlowDecisionPoint[] = [
  'turn_start',
  'post_tool_batch',
  'hitl_suspend',
  'hitl_resume',
  'delegation_entry',
  'delegation_return',
  'retry_after_tripwire',
  'tool_failure',
  'structured_output_failure',
  'pre_final',
];

export const canonicalDecisionFrames: DecisionFrame[] = decisionPoints.map((decisionPoint, index) => ({
  version: 1,
  id: `frame.${decisionPoint}`,
  decisionPoint,
  request: {
    runId: 'run.fixture',
    threadId: 'thread.fixture',
    userId: 'user.fixture',
    featureFlags: ['flow-signals'],
  },
  signals: {
    version: 1,
    sources: ['user_message'],
    tasks: ['answer'],
    requestedOutput: { format: 'markdown' },
    requestedCapabilities: ['retrieval'],
    entities: { documents: [], toolRefs: [], urls: [], identifiers: [] },
    ambiguity: { status: 'clear', blocking: false },
    confidence: 0.9,
  },
  state: {
    version: 1,
    runId: 'run.fixture',
    revision: index,
    retryCount: decisionPoint === 'tool_failure' ? 1 : 0,
    capabilities: ['retrieval'],
    decisions: [],
    evidence: {
      version: 1,
      entries:
        decisionPoint === 'post_tool_batch' || decisionPoint === 'pre_final'
          ? [
              {
                id: `evidence.${decisionPoint}.retrieval`,
                kind: 'retrieval',
                status: 'accepted',
                ref: { id: `tool-result.${decisionPoint}`, kind: 'tool_result', hash: `sha256:${decisionPoint}` },
                toolName: 'knowledge.search',
                attributes: {},
              },
            ]
          : [],
    },
    refs: [{ id: `message.${decisionPoint}`, kind: 'message', hash: `sha256:message:${decisionPoint}` }],
  },
  refs: [{ id: `message.${decisionPoint}`, kind: 'message', hash: `sha256:message:${decisionPoint}` }],
}));

export const ambiguousDecisionFrame: DecisionFrame = {
  ...canonicalDecisionFrames[0]!,
  id: 'frame.ambiguous',
  signals: {
    ...canonicalDecisionFrames[0]!.signals,
    ambiguity: {
      status: 'ambiguous',
      blocking: true,
      clarificationQuestion: 'Which output should be produced?',
    },
  },
};
