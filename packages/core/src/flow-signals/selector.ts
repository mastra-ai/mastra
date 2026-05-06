import { DecisionFrameSchema, FLOW_SIGNALS_VERSION, FlowPolicySchema, FlowDecisionSchema } from './schemas';
import type { EvidenceEntry, EvidenceRequirement, FlowDecision, FlowDecisionAction } from './schemas';

export type SelectFlowDecisionOptions = {
  decisionId?: string;
};

export function selectFlowDecision(
  frameInput: unknown,
  policyInput: unknown,
  options: SelectFlowDecisionOptions = {},
): FlowDecision {
  const frame = DecisionFrameSchema.parse(frameInput);
  const policy = FlowPolicySchema.parse(policyInput);

  const actions: FlowDecisionAction[] = [];
  const reasons: string[] = [];

  const missingCapabilities = policy.requiredCapabilities.filter(
    capability => !frame.state.capabilities.includes(capability),
  );

  if (policy.clarificationRequired || frame.signals.ambiguity.blocking) {
    const question = frame.signals.ambiguity.clarificationQuestion;
    actions.push(question ? { type: 'ask_clarification', question } : { type: 'ask_clarification' });
    reasons.push('clarification_required');
  }

  if (missingCapabilities.length > 0) {
    actions.push({ type: 'require_capability', capabilities: missingCapabilities });
    reasons.push('required_capabilities_missing');
  }

  if (policy.allowedTools.length > 0 || policy.deniedTools.length > 0) {
    actions.push({
      type: 'apply_tool_policy',
      allowedTools: policy.allowedTools,
      deniedTools: policy.deniedTools,
    });
    reasons.push('tool_policy_from_policy');
  }

  const missingEvidence = policy.requiredEvidence.filter(
    requirement => !satisfiesEvidenceRequirement(frame.state.evidence.entries, requirement),
  );

  if (missingEvidence.length > 0) {
    actions.push({ type: 'require_evidence', requirements: missingEvidence });
    reasons.push('required_evidence_missing');
  }

  if (policy.outputContractId) {
    actions.push({ type: 'apply_output_contract', contractId: policy.outputContractId });
    reasons.push('output_contract_from_policy');
  }

  const hasBlockingAction = actions.some(isBlockingAction);

  if (shouldRetry(frame.decisionPoint)) {
    if (policy.maxRetries === undefined || frame.state.retryCount < policy.maxRetries) {
      if (!hasBlockingAction) {
        actions.push({ type: 'retry', reason: frame.decisionPoint });
        reasons.push('retry_allowed');
      }
    } else {
      actions.push({ type: 'fail', reason: 'max_retries_exceeded' });
      reasons.push('retry_denied');
    }
  }

  const hasBlockingOrTerminalAction = actions.some(
    action => isBlockingAction(action) || action.type === 'retry' || action.type === 'fail',
  );

  if (frame.decisionPoint === 'pre_final' && missingEvidence.length === 0 && !hasBlockingOrTerminalAction) {
    actions.push(
      policy.outputContractId
        ? { type: 'finalize', contractId: policy.outputContractId }
        : { type: 'finalize' },
    );
    reasons.push('pre_final_ready');
  }

  if (actions.length === 0) {
    actions.push({ type: 'continue' });
    reasons.push('no_policy_action_required');
  }

  const decision: FlowDecision = {
    version: FLOW_SIGNALS_VERSION,
    id: options.decisionId ?? createDecisionId(frame.id, policy.id, frame.state.revision),
    frameId: frame.id,
    policyId: policy.id,
    decisionPoint: frame.decisionPoint,
    status: getDecisionStatus(actions),
    actions,
    reasons,
  };

  return FlowDecisionSchema.parse(decision);
}

function createDecisionId(frameId: string, policyId: string, revision: number): string {
  return `flow-decision:${frameId}:${policyId}:${revision}`;
}

function shouldRetry(decisionPoint: string): boolean {
  return (
    decisionPoint === 'retry_after_tripwire' ||
    decisionPoint === 'tool_failure' ||
    decisionPoint === 'structured_output_failure'
  );
}

function isBlockingAction(action: FlowDecisionAction): boolean {
  return (
    action.type === 'ask_clarification' || action.type === 'require_capability' || action.type === 'require_evidence'
  );
}

function getDecisionStatus(actions: FlowDecisionAction[]): FlowDecision['status'] {
  if (actions.some(action => action.type === 'fail')) {
    return 'failed';
  }

  if (actions.some(isBlockingAction)) {
    return 'blocked';
  }

  if (actions.some(action => action.type === 'retry')) {
    return 'retry';
  }

  if (actions.some(action => action.type === 'finalize')) {
    return 'finalize';
  }

  return 'continue';
}

function satisfiesEvidenceRequirement(entries: EvidenceEntry[], requirement: EvidenceRequirement): boolean {
  const count = entries.reduce((total, entry) => {
    if (entry.status !== 'accepted') {
      return total;
    }

    if (entry.kind !== requirement.kind) {
      return total;
    }

    if (requirement.match.toolName && entry.toolName !== requirement.match.toolName) {
      return total;
    }

    if (requirement.match.sourceId && entry.sourceId !== requirement.match.sourceId) {
      return total;
    }

    if (requirement.match.artifactType && entry.artifactType !== requirement.match.artifactType) {
      return total;
    }

    if (requirement.match.validationType && entry.validationType !== requirement.match.validationType) {
      return total;
    }

    return total + (entry.count ?? 1);
  }, 0);

  return count >= requirement.requiredCount;
}
