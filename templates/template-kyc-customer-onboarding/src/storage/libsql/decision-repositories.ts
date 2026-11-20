import type { Client, Transaction } from '@libsql/client';
import { z } from 'zod';

import { calculatePolicyChecksum } from '../../contracts/policies/policy-checksum.js';
import {
  acquireResumeCommandInputSchema,
  auditRejectedResumeAttemptInputSchema,
  casePolicySnapshotSchema,
  complianceReviewDecisionResultSchema,
  completeResumeCommandInputSchema,
  createComplianceReviewInputSchema,
  createInformationRequestInputSchema,
  createResumeCommandInputSchema,
  decideComplianceReviewInputSchema,
  getComplianceReviewInputSchema,
  getReviewDecisionInputSchema,
  listComplianceReviewQueueInputSchema,
  getInformationRequestInputSchema,
  getInformationResponseInputSchema,
  getResumeCommandInputSchema,
  getRiskAssessmentInputSchema,
  informationRequestResponseResultSchema,
  listPendingActionsInputSchema,
  listThreadResumeCommandsInputSchema,
  putCasePolicySnapshotInputSchema,
  putRiskAssessmentInputSchema,
  respondToInformationRequestInputSchema,
  type CasePolicySnapshotRepository,
  type ComplianceReviewRepository,
  type InformationRequestRepository,
  type RiskAssessmentRepository,
  type WorkflowResumeCommandRepository,
} from '../../contracts/repositories/decision-repositories.js';
import { kycCaseSchema } from '../../domain/case.js';
import { DomainInvariantError, NotFoundError, PersistenceConflictError } from '../../domain/errors.js';
import { informationRequestSchema, informationResponseSchema, workflowResumeCommandSchema } from '../../domain/hitl.js';
import { complianceReviewSchema, reviewDecisionRecordSchema } from '../../domain/review.js';
import { riskAssessmentSchema } from '../../domain/risk.js';
import { fingerprintRequest, runIdempotentMutation, serializeLibSqlWriter } from './idempotent-mutation.js';

const parseJson = <Result>(value: unknown, schema: z.ZodType<Result>): Result =>
  schema.parse(JSON.parse(z.string().parse(value)));

const parseResumeCommandRow = (row: Readonly<Record<string, unknown>>) => {
  const command = parseJson(row.payload_json, workflowResumeCommandSchema);
  const payloadFingerprint = row.payload_fingerprint === null ? null : z.string().parse(row.payload_fingerprint);
  const resultFingerprint = row.result_fingerprint === null ? null : z.string().parse(row.result_fingerprint);
  const completedOutcome = row.result_json === null ? null : parseJson(row.result_json, z.json());
  if (
    command.payloadFingerprint !== payloadFingerprint ||
    command.resultFingerprint !== resultFingerprint ||
    JSON.stringify(command.completedOutcome) !== JSON.stringify(completedOutcome)
  ) {
    throw new DomainInvariantError('Workflow resume command columns do not match its payload');
  }
  return command;
};

const withoutFields = (
  value: Readonly<Record<string, unknown>>,
  fields: ReadonlySet<string>,
): Record<string, unknown> => Object.fromEntries(Object.entries(value).filter(([field]) => !fields.has(field)));

const informationRequestFingerprint = (request: z.infer<typeof informationRequestSchema>): string => {
  return fingerprintRequest(withoutFields({ ...request }, new Set(['createdAt', 'updatedAt', 'expiresAt'])));
};

const riskAssessmentFingerprint = (assessment: z.infer<typeof riskAssessmentSchema>): string => {
  const semantic = withoutFields({ ...assessment }, new Set(['assessedAt', 'narrative']));
  const { narrative } = assessment;
  if (narrative === null) return fingerprintRequest({ ...semantic, narrative: null });
  const stableNarrative = withoutFields({ ...narrative }, new Set(['generatedAt', 'inputChecksum']));
  return fingerprintRequest({ ...semantic, narrative: stableNarrative });
};

const complianceReviewFingerprint = (review: z.infer<typeof complianceReviewSchema>): string => {
  return fingerprintRequest(withoutFields({ ...review }, new Set(['createdAt', 'updatedAt', 'expiresAt'])));
};

const reviewDecisionFingerprint = (input: z.infer<typeof decideComplianceReviewInputSchema>): string => {
  const decision = withoutFields({ ...input.decision }, new Set(['decidedAt']));
  const feedback = input.feedback === null ? null : withoutFields({ ...input.feedback }, new Set(['createdAt']));
  return fingerprintRequest({ decision, feedback });
};

const rollbackOpen = async (transaction: Transaction): Promise<void> => {
  if (!transaction.closed) await transaction.rollback();
};

const resumeRejectionReason = (error: unknown) =>
  error instanceof NotFoundError
    ? 'COMMAND_NOT_FOUND'
    : error instanceof DomainInvariantError && error.message.includes('expired')
      ? 'COMMAND_EXPIRED'
      : error instanceof DomainInvariantError
        ? 'BINDING_INVALID'
        : error instanceof PersistenceConflictError
          ? 'STATE_CONFLICT'
          : 'UNEXPECTED_REJECTION';

const auditRejectedResumeAttempt = async (
  client: Client,
  input: Omit<z.infer<typeof auditRejectedResumeAttemptInputSchema>, 'reasonCode'>,
  reasonCode: z.infer<typeof auditRejectedResumeAttemptInputSchema>['reasonCode'],
) => {
  const auditId = `resume-attempt-${fingerprintRequest({
    ...input,
    actorRoles: [...input.actorRoles].sort(),
    outcome: 'REJECTED',
    reasonCode,
  })}`;
  await client.execute({
    sql: `INSERT OR IGNORE INTO workflow_resume_attempts
      (id,tenant_id,command_id,case_id,workflow_id,workflow_run_id,workflow_step_id,thread_id,
       actor_id,actor_roles_json,request_fingerprint,outcome,reason_code,attempted_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      auditId,
      input.tenantId,
      input.commandId,
      input.caseId,
      input.workflowId,
      input.workflowRunId,
      input.workflowStepId,
      input.threadId,
      input.actorId,
      JSON.stringify([...input.actorRoles].sort()),
      input.requestFingerprint,
      'REJECTED',
      reasonCode,
      input.acquiredAt,
    ],
  });
};

export class LibSqlCasePolicySnapshotRepository implements CasePolicySnapshotRepository {
  constructor(private readonly client: Client) {}

  async put(input: Parameters<CasePolicySnapshotRepository['put']>[0]) {
    const parsed = putCasePolicySnapshotInputSchema.parse(input);
    if (calculatePolicyChecksum(parsed.snapshot.policy) !== parsed.snapshot.policy.checksum) {
      throw new DomainInvariantError('Policy snapshot checksum does not match its content');
    }
    const mutation = await runIdempotentMutation({
      client: this.client,
      tenantId: parsed.snapshot.tenantId,
      operation: 'PUT_CASE_POLICY_SNAPSHOT',
      key: parsed.idempotencyKey,
      requestFingerprint: fingerprintRequest(parsed.snapshot),
      createdAt: parsed.snapshot.createdAt,
      completedAt: parsed.snapshot.createdAt,
      execute: async transaction => {
        const storedCase = await transaction.execute({
          sql: 'SELECT payload_json FROM kyc_cases WHERE tenant_id=? AND id=?',
          args: [parsed.snapshot.tenantId, parsed.snapshot.caseId],
        });
        if (storedCase.rows[0] === undefined) throw new NotFoundError('Case');
        const caseValue = parseJson(storedCase.rows[0].payload_json, kycCaseSchema);
        if (
          caseValue.policy.id !== parsed.snapshot.policy.id ||
          caseValue.policy.version !== parsed.snapshot.policy.version ||
          caseValue.policy.checksum !== parsed.snapshot.policy.checksum ||
          caseValue.policyProfile !== parsed.snapshot.policy.profile ||
          caseValue.jurisdiction !== parsed.snapshot.policy.jurisdiction
        ) {
          throw new DomainInvariantError('Policy snapshot does not match the pinned case policy');
        }
        await transaction.execute({
          sql: `INSERT INTO case_policy_snapshots
            (tenant_id,case_id,policy_id,policy_version,policy_checksum,payload_json,created_at)
            VALUES (?,?,?,?,?,?,?)`,
          args: [
            parsed.snapshot.tenantId,
            parsed.snapshot.caseId,
            parsed.snapshot.policy.id,
            parsed.snapshot.policy.version,
            parsed.snapshot.policy.checksum,
            JSON.stringify(parsed.snapshot),
            parsed.snapshot.createdAt,
          ],
        });
        return parsed.snapshot;
      },
      parseResult: value => casePolicySnapshotSchema.parse(value),
    });
    return mutation.result;
  }

  async get(input: Parameters<CasePolicySnapshotRepository['get']>[0]) {
    const result = await this.client.execute({
      sql: `SELECT s.policy_id,s.policy_version,s.policy_checksum,s.payload_json,
          c.payload_json AS case_payload_json
        FROM case_policy_snapshots s
        JOIN kyc_cases c ON c.tenant_id=s.tenant_id AND c.id=s.case_id
        WHERE s.tenant_id=? AND s.case_id=?`,
      args: [input.tenantId, input.caseId],
    });
    if (result.rows[0] === undefined) throw new NotFoundError('Case policy snapshot');
    const row = result.rows[0];
    const snapshot = parseJson(row.payload_json, casePolicySnapshotSchema);
    const storedCase = parseJson(row.case_payload_json, kycCaseSchema);
    if (
      calculatePolicyChecksum(snapshot.policy) !== snapshot.policy.checksum ||
      row.policy_id !== snapshot.policy.id ||
      row.policy_version !== snapshot.policy.version ||
      row.policy_checksum !== snapshot.policy.checksum ||
      snapshot.tenantId !== storedCase.tenantId ||
      snapshot.caseId !== storedCase.id ||
      snapshot.policy.id !== storedCase.policy.id ||
      snapshot.policy.version !== storedCase.policy.version ||
      snapshot.policy.checksum !== storedCase.policy.checksum ||
      snapshot.policy.profile !== storedCase.policyProfile ||
      snapshot.policy.jurisdiction !== storedCase.jurisdiction
    ) {
      throw new DomainInvariantError('Policy snapshot integrity validation failed');
    }
    return snapshot;
  }
}

export class LibSqlInformationRequestRepository implements InformationRequestRepository {
  constructor(private readonly client: Client) {}

  async create(input: Parameters<InformationRequestRepository['create']>[0]) {
    const parsed = createInformationRequestInputSchema.parse(input);
    const mutation = await runIdempotentMutation({
      client: this.client,
      tenantId: parsed.request.tenantId,
      operation: 'CREATE_INFORMATION_REQUEST',
      key: parsed.idempotencyKey,
      requestFingerprint: informationRequestFingerprint(parsed.request),
      createdAt: parsed.request.createdAt,
      completedAt: parsed.request.updatedAt,
      execute: async transaction => {
        await transaction.execute({
          sql: `INSERT INTO information_requests
            (tenant_id,id,case_id,workflow_run_id,workflow_step_id,thread_id,status,round,version,expires_at,payload_json,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          args: [
            parsed.request.tenantId,
            parsed.request.id,
            parsed.request.caseId,
            parsed.request.workflowRunId,
            parsed.request.workflowStepId,
            parsed.request.threadId,
            parsed.request.status,
            parsed.request.round,
            parsed.request.version,
            parsed.request.expiresAt,
            JSON.stringify(parsed.request),
            parsed.request.createdAt,
            parsed.request.updatedAt,
          ],
        });
        return parsed.request;
      },
      parseResult: value => informationRequestSchema.parse(value),
    });
    return mutation.result;
  }

  async get(input: Parameters<InformationRequestRepository['get']>[0]) {
    const parsed = getInformationRequestInputSchema.parse(input);
    const result = await this.client.execute({
      sql: 'SELECT payload_json FROM information_requests WHERE tenant_id=? AND id=?',
      args: [parsed.tenantId, parsed.requestId],
    });
    if (result.rows[0] === undefined) throw new NotFoundError('Information request');
    return parseJson(result.rows[0].payload_json, informationRequestSchema);
  }

  async getResponse(input: Parameters<InformationRequestRepository['getResponse']>[0]) {
    const parsed = getInformationResponseInputSchema.parse(input);
    const result = await this.client.execute({
      sql: 'SELECT payload_json FROM information_responses WHERE tenant_id=? AND id=?',
      args: [parsed.tenantId, parsed.responseId],
    });
    if (result.rows[0] === undefined) throw new NotFoundError('Information response');
    return parseJson(result.rows[0].payload_json, informationResponseSchema);
  }

  async listPending(input: Parameters<InformationRequestRepository['listPending']>[0]) {
    const parsed = listPendingActionsInputSchema.parse(input);
    const result = await this.client.execute({
      sql: `SELECT payload_json FROM information_requests
        WHERE tenant_id=? AND thread_id=? AND status='PENDING' AND expires_at>?
        ORDER BY created_at,id`,
      args: [parsed.tenantId, parsed.threadId, parsed.now],
    });
    return result.rows.map(row => parseJson(row.payload_json, informationRequestSchema));
  }

  async respond(input: Parameters<InformationRequestRepository['respond']>[0]) {
    const parsed = respondToInformationRequestInputSchema.parse(input);
    const mutation = await runIdempotentMutation({
      client: this.client,
      tenantId: parsed.response.tenantId,
      operation: 'RESPOND_TO_INFORMATION_REQUEST',
      key: parsed.idempotencyKey,
      requestFingerprint: parsed.response.responseFingerprint,
      createdAt: parsed.response.submittedAt,
      completedAt: parsed.response.submittedAt,
      execute: async transaction => {
        const stored = await transaction.execute({
          sql: 'SELECT payload_json FROM information_requests WHERE tenant_id=? AND id=?',
          args: [parsed.response.tenantId, parsed.response.requestId],
        });
        if (stored.rows[0] === undefined) throw new NotFoundError('Information request');
        const request = parseJson(stored.rows[0].payload_json, informationRequestSchema);
        if (request.caseId !== parsed.response.caseId) {
          throw new DomainInvariantError('Information response case does not match request');
        }
        if (request.status !== 'PENDING' || request.version !== parsed.expectedVersion) {
          throw new PersistenceConflictError('Information request');
        }
        if (parsed.response.submittedAt > request.expiresAt) {
          throw new DomainInvariantError('Information request expired');
        }
        const updated = informationRequestSchema.parse({
          ...request,
          status: 'RESPONDED',
          respondedAt: parsed.response.submittedAt,
          updatedAt: parsed.response.submittedAt,
          version: request.version + 1,
        });
        await transaction.execute({
          sql: `INSERT INTO information_responses
            (tenant_id,id,request_id,case_id,response_fingerprint,payload_json,submitted_at)
            VALUES (?,?,?,?,?,?,?)`,
          args: [
            parsed.response.tenantId,
            parsed.response.id,
            parsed.response.requestId,
            parsed.response.caseId,
            parsed.response.responseFingerprint,
            JSON.stringify(parsed.response),
            parsed.response.submittedAt,
          ],
        });
        const update = await transaction.execute({
          sql: `UPDATE information_requests SET status=?,version=?,payload_json=?,updated_at=?
            WHERE tenant_id=? AND id=? AND version=? AND status='PENDING'`,
          args: [
            updated.status,
            updated.version,
            JSON.stringify(updated),
            updated.updatedAt,
            updated.tenantId,
            updated.id,
            request.version,
          ],
        });
        if (update.rowsAffected !== 1) throw new PersistenceConflictError('Information request');
        return { request: updated, response: parsed.response };
      },
      parseResult: value => informationRequestResponseResultSchema.parse(value),
    });
    return mutation.result;
  }
}

export class LibSqlRiskAssessmentRepository implements RiskAssessmentRepository {
  constructor(private readonly client: Client) {}

  async put(input: Parameters<RiskAssessmentRepository['put']>[0]) {
    const parsed = putRiskAssessmentInputSchema.parse(input);
    const mutation = await runIdempotentMutation({
      client: this.client,
      tenantId: parsed.assessment.tenantId,
      operation: 'PUT_RISK_ASSESSMENT',
      key: parsed.idempotencyKey,
      requestFingerprint: riskAssessmentFingerprint(parsed.assessment),
      createdAt: parsed.assessment.assessedAt,
      completedAt: parsed.assessment.assessedAt,
      execute: async transaction => {
        await transaction.execute({
          sql: `INSERT INTO risk_assessments
            (tenant_id,id,case_id,policy_id,policy_version,policy_checksum,payload_json,assessed_at)
            VALUES (?,?,?,?,?,?,?,?)`,
          args: [
            parsed.assessment.tenantId,
            parsed.assessment.id,
            parsed.assessment.caseId,
            parsed.assessment.policyId,
            parsed.assessment.policyVersion,
            parsed.assessment.policyChecksum,
            JSON.stringify(parsed.assessment),
            parsed.assessment.assessedAt,
          ],
        });
        return parsed.assessment;
      },
      parseResult: value => riskAssessmentSchema.parse(value),
    });
    return mutation.result;
  }

  async get(input: Parameters<RiskAssessmentRepository['get']>[0]) {
    const parsed = getRiskAssessmentInputSchema.parse(input);
    const result = await this.client.execute({
      sql: 'SELECT payload_json FROM risk_assessments WHERE tenant_id=? AND id=?',
      args: [parsed.tenantId, parsed.assessmentId],
    });
    if (result.rows[0] === undefined) throw new NotFoundError('Risk assessment');
    return parseJson(result.rows[0].payload_json, riskAssessmentSchema);
  }

  async getLatest(input: Parameters<RiskAssessmentRepository['getLatest']>[0]) {
    const result = await this.client.execute({
      sql: `SELECT payload_json FROM risk_assessments
        WHERE tenant_id=? AND case_id=? ORDER BY assessed_at DESC,id DESC LIMIT 1`,
      args: [input.tenantId, input.caseId],
    });
    if (result.rows[0] === undefined) throw new NotFoundError('Risk assessment');
    return parseJson(result.rows[0].payload_json, riskAssessmentSchema);
  }
}

export class LibSqlComplianceReviewRepository implements ComplianceReviewRepository {
  constructor(private readonly client: Client) {}

  async create(input: Parameters<ComplianceReviewRepository['create']>[0]) {
    const parsed = createComplianceReviewInputSchema.parse(input);
    const mutation = await runIdempotentMutation({
      client: this.client,
      tenantId: parsed.review.tenantId,
      operation: 'CREATE_COMPLIANCE_REVIEW',
      key: parsed.idempotencyKey,
      requestFingerprint: complianceReviewFingerprint(parsed.review),
      createdAt: parsed.review.createdAt,
      completedAt: parsed.review.updatedAt,
      execute: async transaction => {
        await transaction.execute({
          sql: `INSERT INTO compliance_reviews
            (tenant_id,id,case_id,workflow_run_id,workflow_step_id,thread_id,level,prior_review_id,required_role,status,version,expires_at,payload_json,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          args: [
            parsed.review.tenantId,
            parsed.review.id,
            parsed.review.caseId,
            parsed.review.workflowRunId,
            parsed.review.workflowStepId,
            parsed.review.threadId,
            parsed.review.level,
            parsed.review.priorReviewId,
            parsed.review.requiredRole,
            parsed.review.status,
            parsed.review.version,
            parsed.review.expiresAt,
            JSON.stringify(parsed.review),
            parsed.review.createdAt,
            parsed.review.updatedAt,
          ],
        });
        return parsed.review;
      },
      parseResult: value => complianceReviewSchema.parse(value),
    });
    return mutation.result;
  }

  async get(input: Parameters<ComplianceReviewRepository['get']>[0]) {
    const parsed = getComplianceReviewInputSchema.parse(input);
    const result = await this.client.execute({
      sql: 'SELECT payload_json FROM compliance_reviews WHERE tenant_id=? AND id=?',
      args: [parsed.tenantId, parsed.reviewId],
    });
    if (result.rows[0] === undefined) throw new NotFoundError('Compliance review');
    return parseJson(result.rows[0].payload_json, complianceReviewSchema);
  }

  async getDecision(input: Parameters<ComplianceReviewRepository['getDecision']>[0]) {
    const parsed = getReviewDecisionInputSchema.parse(input);
    const result = await this.client.execute({
      sql: 'SELECT payload_json FROM review_decisions WHERE tenant_id=? AND review_id=?',
      args: [parsed.tenantId, parsed.reviewId],
    });
    if (result.rows[0] === undefined) throw new NotFoundError('Review decision');
    return parseJson(result.rows[0].payload_json, reviewDecisionRecordSchema);
  }

  async listPending(input: Parameters<ComplianceReviewRepository['listPending']>[0]) {
    const parsed = listPendingActionsInputSchema.parse(input);
    const result = await this.client.execute({
      sql: `SELECT payload_json FROM compliance_reviews
        WHERE tenant_id=? AND thread_id=? AND status='PENDING' AND expires_at>?
        ORDER BY created_at,id`,
      args: [parsed.tenantId, parsed.threadId, parsed.now],
    });
    return result.rows.map(row => parseJson(row.payload_json, complianceReviewSchema));
  }

  async listQueue(input: Parameters<ComplianceReviewRepository['listQueue']>[0]) {
    const parsed = listComplianceReviewQueueInputSchema.parse(input);
    if (parsed.afterCreatedAt !== undefined && parsed.afterReviewId === undefined) {
      throw new DomainInvariantError('Review queue cursor is incomplete');
    }
    let cursor: { sql: string; args: string[] } = { sql: '', args: [] };
    if (parsed.afterCreatedAt !== undefined) {
      const afterReviewId = parsed.afterReviewId;
      if (afterReviewId === undefined) throw new DomainInvariantError('Review queue cursor is incomplete');
      cursor = {
        sql: 'AND (created_at>? OR (created_at=? AND id>?))',
        args: [parsed.afterCreatedAt, parsed.afterCreatedAt, afterReviewId],
      };
    }
    const result = await this.client.execute({
      sql: `SELECT payload_json FROM compliance_reviews
        WHERE tenant_id=? AND status='PENDING' AND expires_at>?
        ${parsed.requiredRole === undefined ? '' : 'AND required_role=?'} ${cursor.sql}
        ORDER BY created_at,id LIMIT ?`,
      args: [
        parsed.tenantId,
        parsed.now,
        ...(parsed.requiredRole === undefined ? [] : [parsed.requiredRole]),
        ...cursor.args,
        parsed.limit,
      ],
    });
    return result.rows.map(row => parseJson(row.payload_json, complianceReviewSchema));
  }

  async decide(input: Parameters<ComplianceReviewRepository['decide']>[0]) {
    const parsed = decideComplianceReviewInputSchema.parse(input);
    const mutation = await runIdempotentMutation({
      client: this.client,
      tenantId: parsed.decision.tenantId,
      operation: 'DECIDE_COMPLIANCE_REVIEW',
      key: parsed.idempotencyKey,
      requestFingerprint: reviewDecisionFingerprint(parsed),
      createdAt: parsed.decision.decidedAt,
      completedAt: parsed.decision.decidedAt,
      execute: async transaction => {
        const stored = await transaction.execute({
          sql: 'SELECT payload_json FROM compliance_reviews WHERE tenant_id=? AND id=?',
          args: [parsed.decision.tenantId, parsed.decision.reviewId],
        });
        if (stored.rows[0] === undefined) throw new NotFoundError('Compliance review');
        const review = parseJson(stored.rows[0].payload_json, complianceReviewSchema);
        if (review.caseId !== parsed.decision.caseId || review.policy.checksum !== parsed.decision.policy.checksum) {
          throw new DomainInvariantError('Review decision does not match the review binding');
        }
        if (review.status !== 'PENDING' || review.version !== parsed.expectedVersion) {
          throw new PersistenceConflictError('Compliance review');
        }
        const updated = complianceReviewSchema.parse({
          ...review,
          status: 'DECIDED',
          updatedAt: parsed.decision.decidedAt,
          version: review.version + 1,
        });
        await transaction.execute({
          sql: `INSERT INTO review_decisions
            (tenant_id,id,case_id,review_id,reviewer_id,payload_json,decided_at)
            VALUES (?,?,?,?,?,?,?)`,
          args: [
            parsed.decision.tenantId,
            parsed.decision.id,
            parsed.decision.caseId,
            parsed.decision.reviewId,
            parsed.decision.reviewerId,
            JSON.stringify(parsed.decision),
            parsed.decision.decidedAt,
          ],
        });
        if (parsed.feedback !== null) {
          if (
            parsed.feedback.reviewId !== review.id ||
            parsed.feedback.caseId !== review.caseId ||
            parsed.feedback.reviewerId !== parsed.decision.reviewerId
          ) {
            throw new DomainInvariantError('Reviewer feedback does not match the decision');
          }
          await transaction.execute({
            sql: `INSERT INTO reviewer_feedback
              (tenant_id,id,case_id,review_id,payload_json,created_at) VALUES (?,?,?,?,?,?)`,
            args: [
              parsed.feedback.tenantId,
              parsed.feedback.id,
              parsed.feedback.caseId,
              parsed.feedback.reviewId,
              JSON.stringify(parsed.feedback),
              parsed.feedback.createdAt,
            ],
          });
          const structuredResponseCount = [
            parsed.feedback.extractionUseful,
            parsed.feedback.screeningUseful,
            parsed.feedback.riskUseful,
            parsed.feedback.evidenceUseful,
            parsed.feedback.falsePositiveEscalation,
          ].filter(value => value !== null).length;
          await transaction.execute({
            sql: `INSERT OR IGNORE INTO analytics_outbox
              (tenant_id,event_id,event_type,payload_json,created_at,projected_at)
              VALUES (?,?,'REVIEW_FEEDBACK_RECORDED',?,?,NULL)`,
            args: [
              parsed.feedback.tenantId,
              `feedback:${parsed.feedback.id}`,
              JSON.stringify({
                kind: 'feedback',
                caseId: parsed.feedback.caseId,
                reviewId: parsed.feedback.reviewId,
                extractionUseful: parsed.feedback.extractionUseful,
                screeningUseful: parsed.feedback.screeningUseful,
                riskUseful: parsed.feedback.riskUseful,
                evidenceUseful: parsed.feedback.evidenceUseful,
                structuredResponseCount,
                falsePositiveEscalation: parsed.feedback.falsePositiveEscalation,
                curatedForDataset: parsed.feedback.curatedForDataset,
                turnaroundMs: Math.max(
                  0,
                  new Date(parsed.feedback.createdAt).getTime() - new Date(review.createdAt).getTime(),
                ),
              }),
              parsed.feedback.createdAt,
            ],
          });
        }
        const update = await transaction.execute({
          sql: `UPDATE compliance_reviews SET status=?,version=?,payload_json=?,updated_at=?
            WHERE tenant_id=? AND id=? AND version=? AND status='PENDING'`,
          args: [
            updated.status,
            updated.version,
            JSON.stringify(updated),
            updated.updatedAt,
            updated.tenantId,
            updated.id,
            review.version,
          ],
        });
        if (update.rowsAffected !== 1) throw new PersistenceConflictError('Compliance review');
        return { review: updated, decision: reviewDecisionRecordSchema.parse(parsed.decision) };
      },
      parseResult: value => complianceReviewDecisionResultSchema.parse(value),
    });
    return mutation.result;
  }
}

export class LibSqlWorkflowResumeCommandRepository implements WorkflowResumeCommandRepository {
  constructor(private readonly client: Client) {}

  async create(input: Parameters<WorkflowResumeCommandRepository['create']>[0]) {
    const parsed = createResumeCommandInputSchema.parse(input);
    const mutation = await runIdempotentMutation({
      client: this.client,
      tenantId: parsed.command.tenantId,
      operation: 'CREATE_WORKFLOW_RESUME_COMMAND',
      key: parsed.command.idempotencyKey,
      requestFingerprint: parsed.command.requestFingerprint,
      createdAt: parsed.command.createdAt,
      completedAt: parsed.command.updatedAt,
      execute: async transaction => {
        await transaction.execute({
          sql: `INSERT INTO workflow_resume_commands
            (tenant_id,id,case_id,workflow_run_id,workflow_step_id,thread_id,action_type,target_id,authorized_actor_id,required_role,request_fingerprint,payload_fingerprint,idempotency_key,status,version,expires_at,result_json,result_fingerprint,payload_json,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          args: [
            parsed.command.tenantId,
            parsed.command.id,
            parsed.command.caseId,
            parsed.command.workflowRunId,
            parsed.command.workflowStepId,
            parsed.command.threadId,
            parsed.command.actionType,
            parsed.command.targetId,
            parsed.command.authorizedActorId,
            parsed.command.requiredRole,
            parsed.command.requestFingerprint,
            parsed.command.payloadFingerprint,
            parsed.command.idempotencyKey,
            parsed.command.status,
            parsed.command.version,
            parsed.command.expiresAt,
            parsed.command.completedOutcome === null ? null : JSON.stringify(parsed.command.completedOutcome),
            parsed.command.resultFingerprint,
            JSON.stringify(parsed.command),
            parsed.command.createdAt,
            parsed.command.updatedAt,
          ],
        });
        return parsed.command;
      },
      parseResult: value => workflowResumeCommandSchema.parse(value),
    });
    return mutation.result;
  }

  async get(input: Parameters<WorkflowResumeCommandRepository['get']>[0]) {
    const parsed = getResumeCommandInputSchema.parse(input);
    const result = await this.client.execute({
      sql: `SELECT payload_fingerprint,result_json,result_fingerprint,payload_json
        FROM workflow_resume_commands WHERE tenant_id=? AND id=?`,
      args: [parsed.tenantId, parsed.commandId],
    });
    if (result.rows[0] === undefined) throw new NotFoundError('Workflow resume command');
    return parseResumeCommandRow(result.rows[0]);
  }

  async listPending(input: Parameters<WorkflowResumeCommandRepository['listPending']>[0]) {
    const parsed = listPendingActionsInputSchema.parse(input);
    const result = await this.client.execute({
      sql: `SELECT payload_fingerprint,result_json,result_fingerprint,payload_json FROM workflow_resume_commands
        WHERE tenant_id=? AND thread_id=? AND status IN ('PENDING','EXECUTING')
        ORDER BY created_at,id`,
      args: [parsed.tenantId, parsed.threadId],
    });
    return result.rows.map(row => parseResumeCommandRow(row));
  }

  async listForThread(input: Parameters<WorkflowResumeCommandRepository['listForThread']>[0]) {
    const parsed = listThreadResumeCommandsInputSchema.parse(input);
    const result = await this.client.execute({
      sql: `SELECT payload_fingerprint,result_json,result_fingerprint,payload_json FROM workflow_resume_commands
        WHERE tenant_id=? AND thread_id=? ORDER BY updated_at,id`,
      args: [parsed.tenantId, parsed.threadId],
    });
    return result.rows.map(row => parseResumeCommandRow(row));
  }

  acquire(input: Parameters<WorkflowResumeCommandRepository['acquire']>[0]) {
    const parsed = acquireResumeCommandInputSchema.parse(input);
    return serializeLibSqlWriter(async () => {
      const transaction = await this.client.transaction('write');
      try {
        const stored = await transaction.execute({
          sql: `SELECT payload_fingerprint,result_json,result_fingerprint,payload_json
            FROM workflow_resume_commands WHERE tenant_id=? AND id=?`,
          args: [parsed.tenantId, parsed.commandId],
        });
        if (stored.rows[0] === undefined) throw new NotFoundError('Workflow resume command');
        const command = parseResumeCommandRow(stored.rows[0]);
        if (
          command.caseId !== parsed.caseId ||
          command.workflowId !== parsed.workflowId ||
          command.workflowRunId !== parsed.workflowRunId ||
          command.workflowStepId !== parsed.workflowStepId ||
          command.threadId !== parsed.threadId ||
          command.authorizedActorId !== parsed.actorId ||
          !parsed.actorRoles.includes(command.requiredRole) ||
          command.requestFingerprint !== parsed.requestFingerprint
        ) {
          throw new DomainInvariantError('Workflow resume command binding is invalid');
        }
        if (command.payloadFingerprint !== null && command.payloadFingerprint !== parsed.payloadFingerprint) {
          throw new DomainInvariantError('Workflow resume payload binding is invalid');
        }
        if (command.status === 'COMPLETED') {
          await transaction.rollback();
          return command;
        }
        if (command.status === 'EXECUTING') {
          if (command.version !== parsed.expectedVersion) {
            throw new PersistenceConflictError('Workflow resume command');
          }
          if (command.payloadFingerprint === null) {
            const rebound = workflowResumeCommandSchema.parse({
              ...command,
              payloadFingerprint: parsed.payloadFingerprint,
              updatedAt: parsed.acquiredAt,
            });
            const reboundUpdate = await transaction.execute({
              sql: `UPDATE workflow_resume_commands SET payload_fingerprint=?,payload_json=?,updated_at=?
                WHERE tenant_id=? AND id=? AND version=? AND status='EXECUTING' AND payload_fingerprint IS NULL`,
              args: [
                rebound.payloadFingerprint,
                JSON.stringify(rebound),
                rebound.updatedAt,
                rebound.tenantId,
                rebound.id,
                rebound.version,
              ],
            });
            if (reboundUpdate.rowsAffected !== 1) {
              throw new PersistenceConflictError('Workflow resume payload binding');
            }
            await transaction.commit();
            return rebound;
          }
          await transaction.rollback();
          return command;
        }
        if (command.status !== 'PENDING' || command.version !== parsed.expectedVersion) {
          throw new PersistenceConflictError('Workflow resume command');
        }
        if (parsed.acquiredAt > command.expiresAt) {
          const expired = workflowResumeCommandSchema.parse({
            ...command,
            status: 'EXPIRED',
            updatedAt: parsed.acquiredAt,
            version: command.version + 1,
          });
          await transaction.execute({
            sql: `UPDATE workflow_resume_commands SET status='EXPIRED',version=?,payload_json=?,updated_at=?
              WHERE tenant_id=? AND id=? AND version=? AND status='PENDING'`,
            args: [
              expired.version,
              JSON.stringify(expired),
              expired.updatedAt,
              expired.tenantId,
              expired.id,
              command.version,
            ],
          });
          await transaction.commit();
          throw new DomainInvariantError('Workflow resume command expired');
        }
        const acquired = workflowResumeCommandSchema.parse({
          ...command,
          status: 'EXECUTING',
          payloadFingerprint: parsed.payloadFingerprint,
          executionStartedAt: parsed.acquiredAt,
          updatedAt: parsed.acquiredAt,
          version: command.version + 1,
        });
        const update = await transaction.execute({
          sql: `UPDATE workflow_resume_commands SET status='EXECUTING',payload_fingerprint=?,version=?,payload_json=?,updated_at=?
            WHERE tenant_id=? AND id=? AND version=? AND status='PENDING'`,
          args: [
            acquired.payloadFingerprint,
            acquired.version,
            JSON.stringify(acquired),
            acquired.updatedAt,
            acquired.tenantId,
            acquired.id,
            command.version,
          ],
        });
        if (update.rowsAffected !== 1) throw new PersistenceConflictError('Workflow resume command');
        await transaction.commit();
        return acquired;
      } catch (error) {
        await rollbackOpen(transaction);
        await auditRejectedResumeAttempt(this.client, parsed, resumeRejectionReason(error));
        throw error;
      }
    });
  }

  async auditRejected(input: Parameters<WorkflowResumeCommandRepository['auditRejected']>[0]) {
    const parsed = auditRejectedResumeAttemptInputSchema.parse(input);
    const { reasonCode, ...attempt } = parsed;
    await auditRejectedResumeAttempt(this.client, attempt, reasonCode);
  }

  complete(input: Parameters<WorkflowResumeCommandRepository['complete']>[0]) {
    const parsed = completeResumeCommandInputSchema.parse(input);
    return serializeLibSqlWriter(async () => {
      const transaction = await this.client.transaction('write');
      try {
        const stored = await transaction.execute({
          sql: `SELECT payload_fingerprint,result_json,result_fingerprint,payload_json
            FROM workflow_resume_commands WHERE tenant_id=? AND id=?`,
          args: [parsed.tenantId, parsed.commandId],
        });
        if (stored.rows[0] === undefined) throw new NotFoundError('Workflow resume command');
        const command = parseResumeCommandRow(stored.rows[0]);
        if (command.status === 'COMPLETED') {
          if (
            command.resultReference === parsed.resultReference &&
            command.completedOutcome === null &&
            command.resultFingerprint === null
          ) {
            const recovered = workflowResumeCommandSchema.parse({
              ...command,
              completedOutcome: parsed.completedOutcome,
              resultFingerprint: parsed.resultFingerprint,
              updatedAt: parsed.completedAt,
            });
            const recoveredUpdate = await transaction.execute({
              sql: `UPDATE workflow_resume_commands SET result_json=?,result_fingerprint=?,payload_json=?,updated_at=?
                WHERE tenant_id=? AND id=? AND status='COMPLETED' AND result_json IS NULL AND result_fingerprint IS NULL`,
              args: [
                JSON.stringify(recovered.completedOutcome),
                recovered.resultFingerprint,
                JSON.stringify(recovered),
                recovered.updatedAt,
                recovered.tenantId,
                recovered.id,
              ],
            });
            if (recoveredUpdate.rowsAffected !== 1) {
              throw new PersistenceConflictError('Workflow resume command result recovery');
            }
            await transaction.commit();
            return recovered;
          }
          if (
            command.resultReference !== parsed.resultReference ||
            command.resultFingerprint !== parsed.resultFingerprint ||
            JSON.stringify(command.completedOutcome) !== JSON.stringify(parsed.completedOutcome)
          ) {
            throw new PersistenceConflictError('Workflow resume command result');
          }
          await transaction.rollback();
          return command;
        }
        if (command.status !== 'EXECUTING' || command.version !== parsed.expectedVersion) {
          throw new PersistenceConflictError('Workflow resume command');
        }
        const completed = workflowResumeCommandSchema.parse({
          ...command,
          status: 'COMPLETED',
          consumedAt: parsed.completedAt,
          resultReference: parsed.resultReference,
          completedOutcome: parsed.completedOutcome,
          resultFingerprint: parsed.resultFingerprint,
          updatedAt: parsed.completedAt,
          version: command.version + 1,
        });
        const update = await transaction.execute({
          sql: `UPDATE workflow_resume_commands SET status='COMPLETED',version=?,result_json=?,result_fingerprint=?,payload_json=?,updated_at=?
            WHERE tenant_id=? AND id=? AND version=? AND status='EXECUTING'`,
          args: [
            completed.version,
            JSON.stringify(completed.completedOutcome),
            completed.resultFingerprint,
            JSON.stringify(completed),
            completed.updatedAt,
            completed.tenantId,
            completed.id,
            command.version,
          ],
        });
        if (update.rowsAffected !== 1) throw new PersistenceConflictError('Workflow resume command');
        await transaction.commit();
        return completed;
      } catch (error) {
        await rollbackOpen(transaction);
        throw error;
      }
    });
  }
}
