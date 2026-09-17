import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import type { DocumentExtractionService } from '../../../../services/document-extraction.js';
import { DomainInvariantError } from '../../../../domain/errors.js';
import { evidenceIdSchema, providerIdSchema } from '../../../../domain/identifiers.js';
import { extractionAssessmentSchema } from '../../../../services/extraction-assessment.js';
import { contextFrom, kycWorkflowRequestContextSchema, type KycApplicationWorkflowDependencies } from '../contracts.js';
import { documentStoredSchema } from './validate-and-store-document.js';

export const documentExtractedSchema = documentStoredSchema
  .extend({
    evidenceId: evidenceIdSchema,
    extractionEvidenceIds: z.array(evidenceIdSchema).min(1),
    providerId: providerIdSchema,
    quality: extractionAssessmentSchema.shape.quality,
    providerMissingFields: z.array(z.string().min(1).max(100)),
    providerWarnings: z.array(z.string().min(1).max(200)),
  })
  .strict();

export const createExtractDocumentStep = (dependencies: KycApplicationWorkflowDependencies) =>
  createStep({
    id: 'extract-structured-document-v1',
    description: 'Extract schema-validated fields without placing sensitive values in step output',
    inputSchema: documentStoredSchema,
    outputSchema: documentExtractedSchema,
    requestContextSchema: kycWorkflowRequestContextSchema,
    execute: async ({ inputData, requestContext, tracingContext, runId }) => {
      const context = kycWorkflowRequestContextSchema.parse(requestContext.all);
      const results: Readonly<{
        documentId: string;
        result: Awaited<ReturnType<DocumentExtractionService['extract']>>;
      }>[] = [];
      for (let offset = 0; offset < inputData.documentIds.length; offset += 3) {
        const batch = inputData.documentIds.slice(offset, offset + 3);
        results.push(
          ...(await Promise.all(
            batch.map(async documentId => {
              const storedDocument = await dependencies.documents.get({
                tenantId: context.tenantId,
                documentId,
              });
              return {
                documentId,
                result: await dependencies.documentExtraction.extract(
                  {
                    execution: contextFrom(context),
                    document: storedDocument,
                    modelId: dependencies.modelId,
                    schemaVersion: dependencies.schemaVersion,
                    timeoutMs: dependencies.timeoutMs,
                    idempotencyKey: `${inputData.idempotencyKey}:extraction:${documentId}`,
                    workflowRunId: runId,
                  },
                  tracingContext,
                ),
              };
            }),
          )),
        );
      }
      const selected = results.find(({ documentId }) => documentId === inputData.documentId);
      if (selected === undefined) throw new DomainInvariantError('Primary extraction is missing');
      const { result } = selected;
      return documentExtractedSchema.parse({
        ...inputData,
        evidenceId: result.evidence.id,
        extractionEvidenceIds: results.map(({ result: extracted }) => extracted.evidence.id),
        providerId: result.extraction.provider.providerId,
        quality: result.extraction.quality,
        providerMissingFields: result.extraction.missingFields,
        providerWarnings: result.extraction.warnings,
      });
    },
  });
