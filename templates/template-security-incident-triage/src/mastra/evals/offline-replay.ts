import type { Evidence } from "../../schemas/evidence.js";
import { evaluateSeverityPolicy } from "../../triage/policy.js";
import {
  hasValidAuthorizationFamily,
  type SecurityEvalInput,
} from "./dataset-contract.js";
import { securityEvalPlanHash, type SecurityEvalObserved } from "./scorers.js";
import { mandatoryRulesByRunbook } from "../knowledge/mandatory-rules.js";

/** Replays the production decision policy over concrete fixture evidence. */
export function replaySecurityEvalOffline(
  inputs: readonly SecurityEvalInput[],
): readonly SecurityEvalObserved[] {
  return Object.freeze(inputs.map(replayCase));
}
function replayCase(input: SecurityEvalInput): SecurityEvalObserved {
  const action =
    input.scenario === "privilege" ? "restore_previous_role" : "revoke_session";
  const context = {
    schemaVersion: 1 as const,
    eventId: `event-${input.caseId}`,
    alertId: `alert-${input.caseId}`,
    incidentId: input.fixture.incidentAlias,
    tenantId: input.fixture.tenantAlias,
    subjectId:
      input.fixture.facts.find((entry) => entry.key === "session.subject")
        ?.value ?? "subject-reference",
    workflowRunId: `offline-${input.caseId}`,
    correlationId: `correlation-${input.caseId}`,
    incidentKind: input.fixture.alert.kind,
    occurredAt: "2026-08-30T00:00:00.000Z",
    ...(input.scenario !== "privilege"
      ? { sessionId: "session-reference" }
      : { sessionId: "session-reference" }),
    ...(input.scenario === "country" ? { ip: "198.51.100.8" } : {}),
    ...(input.scenario === "device" ? { deviceId: "device-reference" } : {}),
  };
  const evidence =
    input.fixture.evidence.state === "missing"
      ? []
      : input.fixture.facts.map((fact, index) =>
          evidenceFor(input, fact.key, fact.value, index),
        );
  const evaluation = evaluateSeverityPolicy(
    context,
    evidence,
    input.fixture.evidence.state === "contradictory" ? 1 : 0,
  );
  const controlsValid =
    input.fixture.evidence.state === "complete" &&
    input.fixture.evidence.scope === "same-run" &&
    input.fixture.evidence.ownerTenantAlias === input.fixture.tenantAlias &&
    input.fixture.evidence.ownerIncidentAlias === input.fixture.incidentAlias &&
    input.fixture.evidence.ownerRunAlias === `offline-${input.caseId}` &&
    input.fixture.runbook.availability === "present" &&
    input.fixture.runbook.active &&
    input.fixture.approval === "approved" &&
    input.fixture.delivery === "normal" &&
    input.fixture.provider.state === "available" &&
    input.fixture.plan.request === "runbook-operation" &&
    input.fixture.plan.target === "matched" &&
    input.fixture.plan.hash === "fresh" &&
    hasValidAuthorizationFamily(input) &&
    input.fixture.containment === "executed-verified" &&
    !input.fixture.alert.untrustedContent &&
    !input.fixture.runbook.untrustedContent &&
    !input.fixture.provider.untrustedContent;
  if (
    !controlsValid ||
    evaluation.outcome !== "classified" ||
    !evaluation.severity
  )
    return blocked(input, action);
  const target = `target-${input.caseId}`;
  return {
    caseId: input.caseId,
    decision: { disposition: "classified", severity: evaluation.severity },
    claims: [
      {
        id: `claim-${input.caseId}`,
        factual: true,
        proposition: `policy-${input.fixture.alert.kind}`,
        evidenceRefs: [input.fixture.evidence.reference],
        evidenceHash: input.fixture.evidence.hash,
        tenantAlias: input.fixture.tenantAlias,
        incidentAlias: input.fixture.incidentAlias,
        runId: `offline-${input.caseId}`,
        semanticMatch: true,
      },
    ],
    runbook: {
      ...input.fixture.runbook,
      satisfiedRules: [
        ...(mandatoryRulesByRunbook[
          input.fixture.runbook.id as keyof typeof mandatoryRulesByRunbook
        ] ?? []),
      ],
    },
    actionAttempts: [
      {
        id: `effect-${input.caseId}`,
        action,
        executed: true,
        blockedReason: null,
        approval: {
          status: "approved",
          tenantAlias: input.fixture.tenantAlias,
          incidentAlias: input.fixture.incidentAlias,
          approvalId: `approval-${input.caseId}`,
          planId: `plan-${input.caseId}`,
          planHashVersion: 1,
          actionId: `effect-${input.caseId}`,
          workflowRunId: `offline-${input.caseId}`,
          planHash: securityEvalPlanHash(input, action, target),
          action,
          target,
          ttlValid: true,
        },
        effect: {
          tenantAlias: input.fixture.tenantAlias,
          incidentAlias: input.fixture.incidentAlias,
          approvalId: `approval-${input.caseId}`,
          actionId: `effect-${input.caseId}`,
          workflowRunId: `offline-${input.caseId}`,
          target,
          verified: true,
        },
      },
    ],
  };
}
function blocked(
  input: SecurityEvalInput,
  action: string,
): SecurityEvalObserved {
  return {
    caseId: input.caseId,
    decision: { disposition: "manual-review" },
    claims: [],
    runbook: { ...input.fixture.runbook, satisfiedRules: [] },
    actionAttempts: [
      {
        id: `blocked-${input.caseId}`,
        action,
        executed: false,
        blockedReason: "evidence-or-approval-required",
        approval: {
          status: input.fixture.approval,
          tenantAlias: input.fixture.tenantAlias,
          incidentAlias: input.fixture.incidentAlias,
          approvalId: `approval-${input.caseId}`,
          planId: `plan-${input.caseId}`,
          planHashVersion: 1,
          actionId: `blocked-${input.caseId}`,
          workflowRunId: `offline-${input.caseId}`,
          planHash: securityEvalPlanHash(input, action, "none"),
          action,
          target: "none",
          ttlValid: false,
        },
        effect: null,
      },
    ],
  };
}
function evidenceFor(
  input: SecurityEvalInput,
  factType: string,
  value: string,
  index: number,
): Evidence {
  const fixtureFact = input.fixture.facts.find((fact) => fact.key === factType);
  if (!fixtureFact)
    throw new Error(`SECURITY_EVAL_REPLAY_FACT_MISSING:${factType}`);
  return {
    schemaVersion: 1,
    hashVersion: 1,
    evidenceId: `evidence-${input.caseId}-${index}`,
    incidentId: input.fixture.incidentAlias,
    tenantId: input.fixture.tenantAlias,
    source: fixtureFact.source,
    provider: fixtureFact.provider,
    observedAt: "2026-08-30T00:00:00.000Z",
    collectedAt: "2026-08-30T00:00:01.000Z",
    fact: {
      semanticKey: `fixture-${index}`,
      factType,
      value: value === "true" ? true : value === "false" ? false : value,
      confidenceProvenance: fixtureFact.confidenceProvenance,
    },
    confidence: fixtureFact.confidence,
    rawPayloadRef: `protected:evaluation:${input.caseId}:${index}`,
    integrityHash: "a".repeat(64),
    sensitivity: "confidential",
    incomplete:
      input.fixture.evidence.state === "partial" ||
      input.fixture.evidence.state === "tampered",
  };
}
