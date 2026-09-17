import { z } from 'zod';

import type { ApplicationRepository } from '../contracts/repositories/application-repository.js';
import type { CaseRepository } from '../contracts/repositories/case-repository.js';
import type { Clock, IdGenerator } from '../contracts/technical/primitives.js';
import { applicationDataSchema, applicationSchema } from '../domain/application.js';
import { initialKycCaseSchema, kycCaseSchema } from '../domain/case.js';
import { executionContextSchema } from '../domain/context.js';
import { idempotencyKeySchema, workflowRunIdSchema } from '../domain/identifiers.js';
import { createStableIdentifier, fingerprintValue } from './stable-identifiers.js';

export const applicationIntakeInputSchema = z
  .object({
    execution: executionContextSchema,
    policyProfile: z.enum(['demo-default', 'demo-strict']),
    application: applicationDataSchema,
    idempotencyKey: idempotencyKeySchema,
    workflowRunId: workflowRunIdSchema.optional(),
  })
  .strict();

export const applicationIntakeResultSchema = z.object({ case: kycCaseSchema, application: applicationSchema }).strict();

export class ApplicationIntakeService {
  constructor(
    private readonly cases: CaseRepository,
    private readonly applications: ApplicationRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async intake(rawInput: z.infer<typeof applicationIntakeInputSchema>) {
    const input = applicationIntakeInputSchema.parse(rawInput);
    const occurredAt = this.clock.now().toISOString();
    const caseId = createStableIdentifier('case', input.execution.tenantId, input.idempotencyKey);
    const applicationId = createStableIdentifier('application', input.execution.tenantId, input.idempotencyKey);
    const requestFingerprint = fingerprintValue({
      tenantId: input.execution.tenantId,
      jurisdiction: input.execution.jurisdiction,
      policy: input.execution.policy,
      policyProfile: input.policyProfile,
      application: input.application,
      workflowRunId: input.workflowRunId ?? null,
    });
    const created = await this.cases.create({
      case: initialKycCaseSchema.parse({
        id: caseId,
        tenantId: input.execution.tenantId,
        applicationId,
        jurisdiction: input.execution.jurisdiction,
        policyProfile: input.policyProfile,
        policy: input.execution.policy,
        status: 'DRAFT',
        workflowRunId: null,
        createdAt: occurredAt,
        updatedAt: occurredAt,
        version: 1,
      }),
      eventId: this.ids.generate('event'),
      actor: input.execution.actor,
      correlationId: input.execution.correlationId,
      policy: input.execution.policy,
      idempotencyKey: `${input.idempotencyKey}:create`,
      requestFingerprint,
    });
    const application = await this.applications.put({
      application: applicationSchema.parse({
        id: created.case.applicationId,
        tenantId: created.case.tenantId,
        caseId: created.case.id,
        data: input.application,
        createdAt: occurredAt,
        updatedAt: occurredAt,
        version: 1,
      }),
      idempotencyKey: `${input.idempotencyKey}:application`,
      requestFingerprint,
    });
    const submitted = await this.cases.transition({
      tenantId: created.case.tenantId,
      caseId: created.case.id,
      expectedVersion: created.case.version,
      command: 'SUBMIT_APPLICATION',
      eventId: this.ids.generate('event'),
      reasonCode: 'APPLICATION_RECEIVED',
      actor: input.execution.actor,
      occurredAt,
      correlationId: input.execution.correlationId,
      policy: input.execution.policy,
      evidenceIds: [],
      idempotencyKey: `${input.idempotencyKey}:submit`,
      requestFingerprint: fingerprintValue({
        caseId: created.case.id,
        command: 'SUBMIT_APPLICATION',
      }),
      ...(input.workflowRunId === undefined ? {} : { workflowRunId: input.workflowRunId }),
    });
    return applicationIntakeResultSchema.parse({ case: submitted.case, application });
  }
}
