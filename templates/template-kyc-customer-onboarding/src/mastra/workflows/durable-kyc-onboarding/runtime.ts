import type { Actor, ExecutionContext } from '../../../domain/context.js';
import { fingerprintValue } from '../../../services/stable-identifiers.js';
import type { DurableKycWorkflowDependencies } from './contracts.js';

export type Transition = (
  input: Readonly<{
    execution: ExecutionContext;
    caseId: string;
    command:
      | 'REQUEST_INFORMATION'
      | 'RESUME_EXTRACTION'
      | 'BEGIN_CHECKS'
      | 'EXHAUST_INFORMATION_REQUESTS'
      | 'BEGIN_RISK_ASSESSMENT'
      | 'REQUEST_COMPLIANCE_REVIEW'
      | 'APPROVE'
      | 'REJECT'
      | 'ESCALATE'
      | 'RETURN_TO_COMPLIANCE_REVIEW'
      | 'BEGIN_PROVISIONING'
      | 'ACTIVATE'
      | 'FAIL_PROVISIONING';
    reasonCode: string;
    actor: Actor;
    evidenceIds: string[];
    idempotencyKey: string;
  }>,
) => Promise<unknown>;

export type MeasureWorkflowStep = <Result>(input: {
  tenantId: string;
  eventId: string;
  caseId: string;
  runId: string;
  stepId: string;
  operation: () => Promise<Result>;
}) => Promise<Result>;

export const createDurableWorkflowRuntime = (dependencies: DurableKycWorkflowDependencies) => {
  const transition: Transition = async input => {
    const current = await dependencies.cases.get({
      tenantId: input.execution.tenantId,
      caseId: input.caseId,
    });
    const occurredAt = dependencies.clock.now().toISOString();
    return dependencies.cases.transition({
      tenantId: input.execution.tenantId,
      caseId: input.caseId,
      expectedVersion: current.version,
      command: input.command,
      eventId: `event-${fingerprintValue({
        tenantId: input.execution.tenantId,
        caseId: input.caseId,
        command: input.command,
        key: input.idempotencyKey,
      }).slice(0, 32)}`,
      reasonCode: input.reasonCode,
      actor: input.actor,
      occurredAt,
      correlationId: input.execution.correlationId,
      policy: input.execution.policy,
      evidenceIds: input.evidenceIds,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: fingerprintValue({
        tenantId: input.execution.tenantId,
        caseId: input.caseId,
        command: input.command,
        policy: input.execution.policy,
        evidenceIds: input.evidenceIds,
      }),
    });
  };

  const measureWorkflowStep: MeasureWorkflowStep = async input => {
    const startedAt = dependencies.clock.now().toISOString();
    let outcome: 'success' | 'error' = 'success';
    try {
      return await input.operation();
    } catch (error) {
      outcome = 'error';
      throw error;
    } finally {
      await dependencies.providerMetrics
        .recordWorkflowStep?.({
          tenantId: input.tenantId,
          eventId: `${input.eventId}:${outcome}`,
          caseId: input.caseId,
          workflowId: 'durable-kyc-onboarding-v1',
          runId: input.runId,
          stepId: input.stepId,
          outcome,
          startedAt,
          completedAt: dependencies.clock.now().toISOString(),
        })
        .catch(() => undefined);
    }
  };

  return { transition, measureWorkflowStep };
};
