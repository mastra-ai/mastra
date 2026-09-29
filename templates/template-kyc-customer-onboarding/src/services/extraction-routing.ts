import { z } from 'zod';

import type { CaseRepository } from '../contracts/repositories/case-repository.js';
import type { Clock, IdGenerator } from '../contracts/technical/primitives.js';
import { kycCaseSchema } from '../domain/case.js';
import { executionContextSchema } from '../domain/context.js';
import { caseIdSchema, evidenceIdSchema, idempotencyKeySchema } from '../domain/identifiers.js';
import { extractionAssessmentSchema } from './extraction-assessment.js';
import { fingerprintValue } from './stable-identifiers.js';

export const routeExtractionInputSchema = z
  .object({
    execution: executionContextSchema,
    caseId: caseIdSchema,
    evidenceId: evidenceIdSchema,
    assessment: extractionAssessmentSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export class ExtractionRoutingService {
  constructor(
    private readonly cases: CaseRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async route(rawInput: z.infer<typeof routeExtractionInputSchema>) {
    const input = routeExtractionInputSchema.parse(rawInput);
    const currentCase = await this.cases.get({
      tenantId: input.execution.tenantId,
      caseId: input.caseId,
    });
    const ready = input.assessment.route === 'READY_FOR_CHECKS';
    const command = ready ? ('BEGIN_CHECKS' as const) : ('REQUEST_INFORMATION' as const);
    const result = await this.cases.transition({
      tenantId: currentCase.tenantId,
      caseId: currentCase.id,
      expectedVersion: currentCase.version,
      command,
      eventId: this.ids.generate('event'),
      reasonCode: ready ? 'EXTRACTION_COMPLETE' : 'DOCUMENT_INFORMATION_REQUIRED',
      actor: input.execution.actor,
      occurredAt: this.clock.now().toISOString(),
      correlationId: input.execution.correlationId,
      policy: input.execution.policy,
      evidenceIds: [input.evidenceId],
      idempotencyKey: `${input.idempotencyKey}:route`,
      requestFingerprint: fingerprintValue({
        caseId: currentCase.id,
        command,
        evidenceId: input.evidenceId,
        assessment: input.assessment,
      }),
    });
    return kycCaseSchema.parse(result.case);
  }
}
