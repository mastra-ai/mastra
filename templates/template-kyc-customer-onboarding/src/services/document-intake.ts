import { z } from 'zod';

import type { DocumentStorage } from '../contracts/providers/document-storage.js';
import type { CaseRepository } from '../contracts/repositories/case-repository.js';
import type { DocumentRepository } from '../contracts/repositories/document-repository.js';
import type { Clock, IdGenerator } from '../contracts/technical/primitives.js';
import { kycCaseSchema } from '../domain/case.js';
import { documentSideSchema, documentTypeSchema, identityDocumentSchema } from '../domain/documents.js';
import { executionContextSchema } from '../domain/context.js';
import { caseIdSchema, idempotencyKeySchema } from '../domain/identifiers.js';
import { validateDocumentUpload } from './document-validation.js';
import { createStableIdentifier, fingerprintValue } from './stable-identifiers.js';

export const documentIntakeInputSchema = z
  .object({
    execution: executionContextSchema,
    caseId: caseIdSchema,
    documentType: documentTypeSchema.exclude(['UNKNOWN']),
    side: documentSideSchema,
    declaredMimeType: z.string().min(1).max(100),
    bytes: z.instanceof(Uint8Array),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const documentIntakeResultSchema = z
  .object({
    case: kycCaseSchema,
    document: identityDocumentSchema,
    pageCount: z.number().int().positive().nullable(),
  })
  .strict();

export class DocumentIntakeService {
  constructor(
    private readonly cases: CaseRepository,
    private readonly documents: DocumentRepository,
    private readonly storage: DocumentStorage,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async intake(rawInput: z.infer<typeof documentIntakeInputSchema>) {
    const input = documentIntakeInputSchema.parse(rawInput);
    const validated = validateDocumentUpload({
      declaredMimeType: input.declaredMimeType,
      bytes: input.bytes,
    });
    const currentCase = await this.cases.get({
      tenantId: input.execution.tenantId,
      caseId: input.caseId,
    });
    const occurredAt = this.clock.now().toISOString();
    const documentId = createStableIdentifier('document', input.execution.tenantId, input.idempotencyKey);
    const reference = await this.storage.store({
      tenantId: input.execution.tenantId,
      caseId: currentCase.id,
      documentId,
      mimeType: validated.mimeType,
      bytes: validated.bytes,
      idempotencyKey: `${input.idempotencyKey}:bytes`,
    });
    const document = await this.documents.put({
      document: identityDocumentSchema.parse({
        id: documentId,
        tenantId: input.execution.tenantId,
        caseId: currentCase.id,
        type: input.documentType,
        side: input.side,
        content: reference,
        createdAt: occurredAt,
        updatedAt: occurredAt,
        version: 1,
      }),
      idempotencyKey: `${input.idempotencyKey}:metadata`,
      requestFingerprint: fingerprintValue({
        caseId: currentCase.id,
        documentType: input.documentType,
        side: input.side,
        reference,
      }),
    });
    const transitionCommand =
      currentCase.status === 'MISSING_INFORMATION'
        ? 'RESUME_EXTRACTION'
        : currentCase.status === 'EXTRACTING'
          ? 'ADD_DOCUMENT'
          : 'BEGIN_EXTRACTION';
    const extracting = await this.cases.transition({
      tenantId: currentCase.tenantId,
      caseId: currentCase.id,
      expectedVersion: currentCase.version,
      command: transitionCommand,
      eventId: this.ids.generate('event'),
      reasonCode: 'DOCUMENT_STORED',
      actor: input.execution.actor,
      occurredAt,
      correlationId: input.execution.correlationId,
      policy: input.execution.policy,
      evidenceIds: [],
      idempotencyKey: `${input.idempotencyKey}:case-document`,
      requestFingerprint: fingerprintValue({ caseId: currentCase.id, documentId }),
    });
    return documentIntakeResultSchema.parse({
      case: extracting.case,
      document,
      pageCount: validated.pageCount,
    });
  }
}
