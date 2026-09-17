import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import { durableJurisdictionPolicySchema } from '../../../../contracts/policies/policies.js';
import { DomainInvariantError } from '../../../../domain/errors.js';
import { documentIdSchema } from '../../../../domain/identifiers.js';
import { getFixtureScenario } from '../../../../fixtures/provider-scenarios.js';
import { contextFrom, kycWorkflowRequestContextSchema, type KycApplicationWorkflowDependencies } from '../contracts.js';
import { caseCreatedSchema } from './create-application.js';

export const documentStoredSchema = caseCreatedSchema
  .extend({
    documentId: documentIdSchema,
    documentIds: z.array(documentIdSchema).min(1),
    status: z.literal('EXTRACTING'),
    pageCount: z.number().int().positive().nullable(),
  })
  .strict();

export const createValidateAndStoreDocumentStep = (dependencies: KycApplicationWorkflowDependencies) =>
  createStep({
    id: 'validate-store-document-v1',
    description: 'Validate and store the selected document by opaque reference',
    inputSchema: caseCreatedSchema,
    outputSchema: documentStoredSchema,
    requestContextSchema: kycWorkflowRequestContextSchema,
    execute: async ({ inputData, requestContext }) => {
      const context = kycWorkflowRequestContextSchema.parse(requestContext.all);
      if (inputData.source === 'persisted-case') {
        const documents = await dependencies.documents.list({
          tenantId: context.tenantId,
          caseId: inputData.caseId,
        });
        const first = documents.at(0);
        if (first === undefined) throw new DomainInvariantError('Persisted case has no document to process');
        const policy = durableJurisdictionPolicySchema.parse(
          await dependencies.jurisdictionPolicy.resolve({
            jurisdiction: 'US',
            profile: context.policyProfile,
          }),
        );
        const primary =
          policy.identityDocumentRequirements
            .flatMap(requirement =>
              documents
                .filter(document => document.type === requirement.type)
                .toSorted((left, right) =>
                  [left.side === 'SINGLE' ? '0' : left.side === 'FRONT' ? '1' : '2', left.createdAt, left.id]
                    .join('\0')
                    .localeCompare(
                      [
                        right.side === 'SINGLE' ? '0' : right.side === 'FRONT' ? '1' : '2',
                        right.createdAt,
                        right.id,
                      ].join('\0'),
                    ),
                ),
            )
            .at(0) ?? first;
        return documentStoredSchema.parse({
          ...inputData,
          documentId: primary.id,
          documentIds: documents.map(({ id }) => id),
          status: 'EXTRACTING',
          pageCount: null,
        });
      }
      if (inputData.scenario === null) throw new DomainInvariantError('Fixture scenario is missing');
      const fixture = getFixtureScenario(inputData.scenario);
      const result = await dependencies.documentIntake.intake({
        execution: contextFrom(context),
        caseId: inputData.caseId,
        documentType: fixture.documentType,
        side: 'SINGLE',
        declaredMimeType: fixture.mimeType,
        bytes: fixture.bytes,
        idempotencyKey: `${inputData.idempotencyKey}:document`,
      });
      return documentStoredSchema.parse({
        ...inputData,
        documentId: result.document.id,
        documentIds: [result.document.id],
        status: result.case.status,
        pageCount: result.pageCount,
      });
    },
  });
