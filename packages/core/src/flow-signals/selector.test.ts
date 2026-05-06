import { describe, expect, it } from 'vitest';
import { ambiguousDecisionFrame, baseFlowPolicy, canonicalDecisionFrames } from './fixtures';
import {
  DecisionFrameSchema,
  EvidenceLedgerSchema,
  FLOW_STATE_SNAPSHOT_KEY,
  FlowDecisionSchema,
  FlowPolicySchema,
  FlowStateSchema,
} from './schemas';
import { selectFlowDecision } from './selector';

describe('flow signals schemas', () => {
  it('accepts canonical fixtures for every v1 decision point', () => {
    const points = canonicalDecisionFrames.map(frame => DecisionFrameSchema.parse(frame).decisionPoint);

    expect(points).toEqual([
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
    ]);
  });

  it('round-trips state, policy, evidence, and decisions through JSON serialization', () => {
    const frame = DecisionFrameSchema.parse(canonicalDecisionFrames[1]);
    const policy = FlowPolicySchema.parse(baseFlowPolicy);
    const decision = selectFlowDecision(frame, policy);

    const restoredState = FlowStateSchema.parse(JSON.parse(JSON.stringify(frame.state)));
    const restoredPolicy = FlowPolicySchema.parse(JSON.parse(JSON.stringify(policy)));
    const restoredDecision = FlowDecisionSchema.parse(JSON.parse(JSON.stringify(decision)));
    const restoredEvidence = EvidenceLedgerSchema.parse(JSON.parse(JSON.stringify(frame.state.evidence)));

    expect(FLOW_STATE_SNAPSHOT_KEY).toBe('mastra__flowState');
    expect(restoredState.version).toBe(1);
    expect(restoredPolicy.id).toBe(policy.id);
    expect(restoredDecision.id).toBe(decision.id);
    expect(restoredEvidence.entries[0]?.ref?.hash).toBe('sha256:post_tool_batch');
  });

  it('rejects no-op actionable decision payloads', () => {
    const baseDecision = selectFlowDecision(canonicalDecisionFrames[0], baseFlowPolicy);

    expect(() =>
      FlowDecisionSchema.parse({
        ...baseDecision,
        actions: [{ type: 'require_capability', capabilities: [] }],
      }),
    ).toThrow();

    expect(() =>
      FlowDecisionSchema.parse({
        ...baseDecision,
        actions: [{ type: 'require_evidence', requirements: [] }],
      }),
    ).toThrow();

    expect(() =>
      FlowDecisionSchema.parse({
        ...baseDecision,
        actions: [{ type: 'apply_tool_policy', allowedTools: [], deniedTools: [] }],
      }),
    ).toThrow();
  });

  it('rejects contradictory tool policy payloads', () => {
    expect(() =>
      FlowPolicySchema.parse({
        ...baseFlowPolicy,
        allowedTools: ['knowledge.search'],
        deniedTools: ['knowledge.search'],
      }),
    ).toThrow();

    const baseDecision = selectFlowDecision(canonicalDecisionFrames[0], baseFlowPolicy);

    expect(() =>
      FlowDecisionSchema.parse({
        ...baseDecision,
        status: 'continue',
        actions: [
          { type: 'apply_tool_policy', allowedTools: ['knowledge.search'], deniedTools: ['knowledge.search'] },
        ],
      }),
    ).toThrow();
  });

  it('rejects invalid public decision envelopes', () => {
    const baseDecision = selectFlowDecision(canonicalDecisionFrames[0], baseFlowPolicy);

    expect(() =>
      FlowDecisionSchema.parse({
        ...baseDecision,
        actions: [],
      }),
    ).toThrow();

    expect(() =>
      FlowDecisionSchema.parse({
        ...baseDecision,
        reasons: [],
      }),
    ).toThrow();

    expect(() =>
      FlowDecisionSchema.parse({
        ...baseDecision,
        status: 'continue',
        actions: [{ type: 'continue' }, { type: 'apply_output_contract', contractId: 'contract.summary.v1' }],
      }),
    ).toThrow();

    expect(() =>
      FlowDecisionSchema.parse({
        ...baseDecision,
        status: 'retry',
        actions: [
          { type: 'retry', reason: 'retry_after_tripwire' },
          { type: 'finalize', contractId: 'contract.summary.v1' },
        ],
      }),
    ).toThrow();

    expect(() =>
      FlowDecisionSchema.parse({
        ...baseDecision,
        status: 'blocked',
        actions: [
          {
            type: 'require_evidence',
            requirements: [{ id: 'evidence.retrieval', kind: 'retrieval', requiredCount: 1, match: {} }],
          },
          { type: 'finalize', contractId: 'contract.summary.v1' },
        ],
      }),
    ).toThrow();

    expect(() =>
      FlowDecisionSchema.parse({
        ...baseDecision,
        status: 'continue',
      }),
    ).toThrow();
  });

  it('rejects unknown action types in persisted decision summaries', () => {
    expect(() =>
      FlowStateSchema.parse({
        version: 1,
        decisions: [
          {
            id: 'decision.unknown-action',
            policyId: 'policy.default',
            decisionPoint: 'turn_start',
            status: 'continue',
            actionTypes: ['unknown_action'],
          },
        ],
      }),
    ).toThrow();
  });
});

describe('selectFlowDecision', () => {
  it('is deterministic for the same frame and policy', () => {
    const first = selectFlowDecision(canonicalDecisionFrames[0], baseFlowPolicy);
    const second = selectFlowDecision(canonicalDecisionFrames[0], baseFlowPolicy);

    expect(second).toEqual(first);
  });

  it('does not let requested signals weaken app policy', () => {
    const frame = {
      ...canonicalDecisionFrames[0]!,
      signals: {
        ...canonicalDecisionFrames[0]!.signals,
        requestedCapabilities: [],
        entities: {
          ...canonicalDecisionFrames[0]!.signals.entities,
          toolRefs: ['network.write'],
        },
      },
    };

    const decision = selectFlowDecision(frame, baseFlowPolicy);

    expect(decision.actions).toContainEqual({
      type: 'apply_tool_policy',
      allowedTools: ['knowledge.search'],
      deniedTools: ['network.write'],
    });
    expect(decision.actions).toContainEqual({
      type: 'require_evidence',
      requirements: [{ id: 'evidence.retrieval', kind: 'retrieval', requiredCount: 1, match: {} }],
    });
  });

  it('blocks when policy required capabilities are not resolved in state', () => {
    const baseFrame = canonicalDecisionFrames.find(item => item.decisionPoint === 'pre_final')!;
    const frame = {
      ...baseFrame,
      state: {
        ...baseFrame.state,
        capabilities: [],
      },
    };

    const decision = selectFlowDecision(frame, baseFlowPolicy);

    expect(decision.status).toBe('blocked');
    expect(decision.actions).toContainEqual({ type: 'require_capability', capabilities: ['retrieval'] });
    expect(decision.actions.some(action => action.type === 'finalize')).toBe(false);
  });

  it('omits the clarification question property when no question is available', () => {
    const decision = selectFlowDecision(canonicalDecisionFrames[0], {
      ...baseFlowPolicy,
      id: 'policy.clarification',
      clarificationRequired: true,
      requiredEvidence: [],
    });

    expect(decision.status).toBe('blocked');
    expect(decision.actions).toContainEqual({ type: 'ask_clarification' });
  });

  it('blocks for clarification when ambiguity is blocking', () => {
    const decision = selectFlowDecision(ambiguousDecisionFrame, baseFlowPolicy);

    expect(decision.status).toBe('blocked');
    expect(decision.actions).toContainEqual({
      type: 'ask_clarification',
      question: 'Which output should be produced?',
    });
  });

  it('finalizes at pre_final when required evidence is present', () => {
    const frame = canonicalDecisionFrames.find(item => item.decisionPoint === 'pre_final')!;
    const decision = selectFlowDecision(frame, baseFlowPolicy);

    expect(decision.status).toBe('finalize');
    expect(decision.actions).toContainEqual({ type: 'apply_output_contract', contractId: 'contract.summary.v1' });
    expect(decision.actions).toContainEqual({ type: 'finalize', contractId: 'contract.summary.v1' });
    expect(decision.actions).not.toContainEqual({
      type: 'require_evidence',
      requirements: [{ id: 'evidence.retrieval', kind: 'retrieval', requiredCount: 1, match: {} }],
    });
  });

  it('omits finalize contractId when no output contract is configured', () => {
    const frame = canonicalDecisionFrames.find(item => item.decisionPoint === 'pre_final')!;
    const decision = selectFlowDecision(frame, {
      ...baseFlowPolicy,
      outputContractId: undefined,
    });

    expect(decision.status).toBe('finalize');
    expect(decision.actions).toContainEqual({ type: 'finalize' });
  });

  it('does not finalize when pre_final is blocked by clarification', () => {
    const baseFrame = canonicalDecisionFrames.find(item => item.decisionPoint === 'pre_final')!;
    const frame = {
      ...baseFrame,
      signals: {
        ...baseFrame.signals,
        ambiguity: {
          status: 'ambiguous' as const,
          blocking: true,
          clarificationQuestion: 'Which final format should be used?',
        },
      },
    };

    const decision = selectFlowDecision(frame, baseFlowPolicy);

    expect(decision.status).toBe('blocked');
    expect(decision.actions).toContainEqual({
      type: 'ask_clarification',
      question: 'Which final format should be used?',
    });
    expect(decision.actions.some(action => action.type === 'finalize')).toBe(false);
  });

  it('fails retry decision points when max retries are exceeded', () => {
    const frame = canonicalDecisionFrames.find(item => item.decisionPoint === 'tool_failure')!;
    const decision = selectFlowDecision(frame, baseFlowPolicy);

    expect(decision.status).toBe('failed');
    expect(decision.actions).toContainEqual({ type: 'fail', reason: 'max_retries_exceeded' });
  });

  it('does not emit retry when retry point requirements are blocked', () => {
    const retryFrame = canonicalDecisionFrames.find(item => item.decisionPoint === 'retry_after_tripwire')!;
    const frame = {
      ...retryFrame,
      state: {
        ...retryFrame.state,
        retryCount: 0,
      },
    };

    const decision = selectFlowDecision(frame, baseFlowPolicy);

    expect(decision.status).toBe('blocked');
    expect(decision.actions).toContainEqual({
      type: 'require_evidence',
      requirements: [{ id: 'evidence.retrieval', kind: 'retrieval', requiredCount: 1, match: {} }],
    });
    expect(decision.actions.some(action => action.type === 'retry')).toBe(false);
  });

  it('emits retry when retry point requirements are satisfied and budget remains', () => {
    const retryFrame = canonicalDecisionFrames.find(item => item.decisionPoint === 'retry_after_tripwire')!;
    const evidenceFrame = canonicalDecisionFrames.find(item => item.decisionPoint === 'pre_final')!;
    const frame = {
      ...retryFrame,
      state: {
        ...retryFrame.state,
        retryCount: 0,
        evidence: evidenceFrame.state.evidence,
      },
    };

    const decision = selectFlowDecision(frame, baseFlowPolicy);

    expect(decision.status).toBe('retry');
    expect(decision.actions).toContainEqual({ type: 'retry', reason: 'retry_after_tripwire' });
  });

  it('does not satisfy evidence requirements with observed evidence', () => {
    const baseFrame = canonicalDecisionFrames.find(item => item.decisionPoint === 'pre_final')!;
    const frame = {
      ...baseFrame,
      state: {
        ...baseFrame.state,
        evidence: {
          version: 1 as const,
          entries: baseFrame.state.evidence.entries.map(entry => ({ ...entry, status: 'observed' as const })),
        },
      },
    };

    const decision = selectFlowDecision(frame, baseFlowPolicy);

    expect(decision.status).toBe('blocked');
    expect(decision.actions).toContainEqual({
      type: 'require_evidence',
      requirements: [{ id: 'evidence.retrieval', kind: 'retrieval', requiredCount: 1, match: {} }],
    });
    expect(decision.actions.some(action => action.type === 'finalize')).toBe(false);
  });

  it('expresses evidence requirements as typed requirements, not prose checks', () => {
    const decision = selectFlowDecision(canonicalDecisionFrames[0], baseFlowPolicy);
    const evidenceAction = decision.actions.find(action => action.type === 'require_evidence');

    expect(evidenceAction).toEqual({
      type: 'require_evidence',
      requirements: [{ id: 'evidence.retrieval', kind: 'retrieval', requiredCount: 1, match: {} }],
    });
  });
});
