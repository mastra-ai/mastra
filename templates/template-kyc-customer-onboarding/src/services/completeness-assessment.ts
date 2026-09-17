import { z } from 'zod';

import { durableJurisdictionPolicySchema } from '../contracts/policies/policies.js';
import type { DocumentExtractionRepository } from '../contracts/repositories/document-extraction-repository.js';
import type { DocumentRepository } from '../contracts/repositories/document-repository.js';
import { extractionQualityPolicySchema } from '../config/policies/extraction-quality.js';
import { identityDocumentSchema } from '../domain/documents.js';
import { NotFoundError } from '../domain/errors.js';
import { requestedInformationItemSchema } from '../domain/hitl.js';
import { caseIdSchema, tenantIdSchema } from '../domain/identifiers.js';
import { documentIdSchema } from '../domain/identifiers.js';
import { reasonCodeSchema } from '../domain/reasons.js';

const extractableFieldSchema = z.enum([
  'fullName',
  'dateOfBirth',
  'documentNumber',
  'expirationDate',
  'nationality',
  'residentialAddress',
]);

const persistedExtractionShapeSchema = z.object({
  documentId: z.string().min(1),
  result: z.object({
    fields: z.record(z.string(), z.unknown()),
    quality: z.enum(['READABLE', 'LOW_QUALITY', 'UNREADABLE']),
  }),
});

export const completenessAssessmentSchema = z
  .object({
    tenantId: tenantIdSchema,
    caseId: caseIdSchema,
    status: z.enum(['COMPLETE', 'MISSING_INFORMATION', 'INSUFFICIENT_INFORMATION']),
    completedRounds: z.number().int().nonnegative(),
    maxRounds: z.number().int().positive(),
    requestedItems: z.array(requestedInformationItemSchema),
    reasonCodes: z.array(reasonCodeSchema).min(1),
    missingFields: z.array(extractableFieldSchema),
    lowConfidenceFields: z.array(extractableFieldSchema),
    documentIds: z.array(z.string().min(1)),
    primaryDocumentId: documentIdSchema.nullable(),
  })
  .strict();

export type CompletenessAssessment = z.infer<typeof completenessAssessmentSchema>;

type DurablePolicy = z.infer<typeof durableJurisdictionPolicySchema>;
type QualityPolicy = z.infer<typeof extractionQualityPolicySchema>;
type IdentityDocument = z.infer<typeof identityDocumentSchema>;
type PersistedExtraction = z.infer<typeof persistedExtractionShapeSchema>;

const fieldToItem = {
  fullName: 'FULL_NAME',
  dateOfBirth: 'DATE_OF_BIRTH',
  documentNumber: 'DOCUMENT_NUMBER',
  expirationDate: 'EXPIRATION_DATE',
  residentialAddress: 'RESIDENTIAL_ADDRESS',
  nationality: 'FULL_NAME',
} as const;

const unique = <Value extends string>(values: readonly Value[]): Value[] => [...new Set(values)];

export const assessCaseCompleteness = (
  input: Readonly<{
    tenantId: string;
    caseId: string;
    documents: readonly IdentityDocument[];
    extractions: readonly PersistedExtraction[];
    policy: DurablePolicy;
    qualityPolicy: QualityPolicy;
    completedRounds: number;
  }>,
) => {
  const policy = durableJurisdictionPolicySchema.parse(input.policy);
  const qualityPolicy = extractionQualityPolicySchema.parse(input.qualityPolicy);
  const documents = input.documents.map(document => identityDocumentSchema.parse(document));
  const requestedItems: z.infer<typeof requestedInformationItemSchema>[] = [];
  const reasonCodes: z.infer<typeof reasonCodeSchema>[] = [];

  const identityRequirement = policy.identityDocumentRequirements.find(requirement =>
    documents.some(document => document.type === requirement.type),
  );
  if (identityRequirement === undefined) {
    requestedItems.push('IDENTITY_DOCUMENT');
    reasonCodes.push('COMPLETENESS_REQUIRED_DOCUMENT_MISSING');
  } else {
    const presentSides = new Set(
      documents.filter(document => document.type === identityRequirement.type).map(document => document.side),
    );
    for (const side of identityRequirement.sides) {
      if (!presentSides.has(side)) {
        requestedItems.push(side === 'BACK' ? 'IDENTITY_DOCUMENT_BACK' : 'IDENTITY_DOCUMENT');
        reasonCodes.push('COMPLETENESS_REQUIRED_DOCUMENT_SIDE_MISSING');
      }
    }
  }

  for (const requirement of policy.supplementalDocumentRequirements) {
    const matching = documents.filter(document => document.type === requirement.type);
    if (matching.length === 0) {
      requestedItems.push('PROOF_OF_ADDRESS');
      reasonCodes.push('COMPLETENESS_REQUIRED_DOCUMENT_MISSING');
      continue;
    }
    const sides = new Set(matching.map(document => document.side));
    if (requirement.sides.some(side => !sides.has(side))) {
      requestedItems.push('PROOF_OF_ADDRESS');
      reasonCodes.push('COMPLETENESS_REQUIRED_DOCUMENT_SIDE_MISSING');
    }
  }

  const parsedExtractions = input.extractions.map(extraction => persistedExtractionShapeSchema.parse(extraction));
  if (identityRequirement !== undefined) {
    const identityDocumentIds = new Set(
      documents.filter(document => document.type === identityRequirement.type).map(document => document.id),
    );
    const identityExtractions = parsedExtractions.filter(extraction => identityDocumentIds.has(extraction.documentId));
    if (
      identityExtractions.length === 0 ||
      identityExtractions.every(extraction => extraction.result.quality === 'UNREADABLE')
    ) {
      requestedItems.push('DOCUMENT_READABILITY');
      reasonCodes.push('COMPLETENESS_DOCUMENT_UNREADABLE');
    }
  }

  const missingFields: z.infer<typeof extractableFieldSchema>[] = [];
  const lowConfidenceFields: z.infer<typeof extractableFieldSchema>[] = [];
  for (const rawField of policy.requiredFields) {
    const parsedField = extractableFieldSchema.safeParse(rawField);
    if (!parsedField.success) continue;
    const field = parsedField.data;
    const candidates = parsedExtractions.flatMap(extraction => {
      const value = extraction.result.fields[field];
      if (typeof value !== 'object' || value === null) return [];
      const record = value as Record<string, unknown>;
      return [{ normalizedValue: record.normalizedValue, confidence: record.confidence }];
    });
    const populated = candidates.filter(
      candidate => typeof candidate.normalizedValue === 'string' && candidate.normalizedValue !== '',
    );
    if (populated.length === 0) {
      missingFields.push(field);
      requestedItems.push(fieldToItem[field]);
      reasonCodes.push('COMPLETENESS_REQUIRED_FIELD_MISSING');
      continue;
    }
    const confident = populated.some(
      candidate =>
        typeof candidate.confidence === 'number' && candidate.confidence >= qualityPolicy.minimumFieldConfidence,
    );
    if (!confident) {
      lowConfidenceFields.push(field);
      if (qualityPolicy.enforceMinimumFieldConfidence) {
        requestedItems.push(fieldToItem[field]);
        reasonCodes.push('COMPLETENESS_FIELD_CONFIDENCE_LOW');
      }
    }
  }

  const canonicalItems = unique(requestedItems);
  const missing = canonicalItems.length > 0;
  const status = !missing
    ? 'COMPLETE'
    : input.completedRounds >= policy.missingInformation.maxRounds
      ? 'INSUFFICIENT_INFORMATION'
      : 'MISSING_INFORMATION';
  const primaryDocumentId =
    identityRequirement === undefined
      ? null
      : (documents
          .filter(document => document.type === identityRequirement.type)
          .filter(document => parsedExtractions.some(extraction => extraction.documentId === document.id))
          .at(-1)?.id ?? null);
  const canonicalReasons = unique([
    ...reasonCodes,
    ...(status === 'COMPLETE' ? (['EVIDENCE_COMPLETE'] as const) : []),
    ...(status === 'INSUFFICIENT_INFORMATION' ? (['COMPLETENESS_MISSING_INFORMATION_ROUND_LIMIT'] as const) : []),
  ]);
  return completenessAssessmentSchema.parse({
    tenantId: input.tenantId,
    caseId: input.caseId,
    status,
    completedRounds: input.completedRounds,
    maxRounds: policy.missingInformation.maxRounds,
    requestedItems: canonicalItems,
    reasonCodes: canonicalReasons,
    missingFields: unique(missingFields),
    lowConfidenceFields: unique(lowConfidenceFields),
    documentIds: documents.map(document => document.id).sort(),
    primaryDocumentId,
  });
};

export class CompletenessAssessmentService {
  constructor(
    private readonly documents: DocumentRepository,
    private readonly extractions: DocumentExtractionRepository,
  ) {}

  async evaluate(
    input: Readonly<{
      tenantId: string;
      caseId: string;
      policy: DurablePolicy;
      qualityPolicy: QualityPolicy;
      completedRounds: number;
    }>,
  ) {
    const documents = await this.documents.list({ tenantId: input.tenantId, caseId: input.caseId });
    const extractions = await Promise.all(
      documents.map(async document => {
        try {
          return await this.extractions.get({
            tenantId: input.tenantId,
            documentId: document.id,
          });
        } catch (error) {
          if (error instanceof NotFoundError) return undefined;
          throw error;
        }
      }),
    );
    return assessCaseCompleteness({
      ...input,
      documents,
      extractions: extractions.filter(value => value !== undefined),
    });
  }
}
