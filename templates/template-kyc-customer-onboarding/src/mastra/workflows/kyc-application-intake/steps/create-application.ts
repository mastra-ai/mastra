import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import { durableJurisdictionPolicySchema } from '../../../../contracts/policies/policies.js';
import { kycCaseStatusSchema } from '../../../../domain/case.js';
import { DomainInvariantError } from '../../../../domain/errors.js';
import { caseIdSchema, idempotencyKeySchema } from '../../../../domain/identifiers.js';
import { getFixtureScenario } from '../../../../fixtures/provider-scenarios.js';
import { fingerprintValue } from '../../../../services/stable-identifiers.js';
import {
  contextFrom,
  fixtureKycApplicationWorkflowInputSchema,
  kycApplicationWorkflowInputSchema,
  kycWorkflowRequestContextSchema,
  type KycApplicationWorkflowDependencies,
} from '../contracts.js';

export const caseCreatedSchema = z
  .object({
    source: z.enum(['fixture', 'persisted-case']),
    scenario: fixtureKycApplicationWorkflowInputSchema.shape.scenario.nullable(),
    idempotencyKey: idempotencyKeySchema,
    caseId: caseIdSchema,
    status: kycCaseStatusSchema,
  })
  .strict();

export const createApplicationStep = (dependencies: KycApplicationWorkflowDependencies) =>
  createStep({
    id: 'create-application-case-v1',
    description: 'Create and persist the KYC application and case',
    inputSchema: kycApplicationWorkflowInputSchema,
    outputSchema: caseCreatedSchema,
    requestContextSchema: kycWorkflowRequestContextSchema,
    execute: async ({ inputData, requestContext, runId }) => {
      const context = kycWorkflowRequestContextSchema.parse(requestContext.all);
      const selectedPolicy = durableJurisdictionPolicySchema.parse(
        await dependencies.jurisdictionPolicy.resolve({
          jurisdiction: 'US',
          profile: context.policyProfile,
        }),
      );
      if (
        selectedPolicy.id !== context.policy.id ||
        selectedPolicy.version !== context.policy.version ||
        selectedPolicy.checksum !== context.policy.checksum
      ) {
        throw new DomainInvariantError('Workflow context does not match the selected policy');
      }
      const persistedCase =
        'source' in inputData
          ? await dependencies.cases.get({ tenantId: context.tenantId, caseId: inputData.caseId })
          : (
              await dependencies.applicationIntake.intake({
                execution: contextFrom(context),
                policyProfile: context.policyProfile,
                application: getFixtureScenario(inputData.scenario).application,
                idempotencyKey: `${inputData.idempotencyKey}:application`,
                workflowRunId: runId,
              })
            ).case;
      if ('source' in inputData && (persistedCase.workflowRunId !== runId || persistedCase.status !== 'EXTRACTING')) {
        throw new DomainInvariantError('Persisted case is not bound to this workflow run in EXTRACTING');
      }
      await dependencies.casePolicySnapshots.put({
        snapshot: {
          tenantId: context.tenantId,
          caseId: persistedCase.id,
          policy: selectedPolicy,
          createdAt: persistedCase.createdAt,
        },
        idempotencyKey: `${inputData.idempotencyKey}:policy-snapshot`,
      });
      if (inputData.studioThreadKey !== undefined) {
        const occurredAt = dependencies.clock.now().toISOString();
        await dependencies.studioCaseLinks.put({
          link: {
            tenantId: context.tenantId,
            threadId: inputData.studioThreadKey,
            caseId: persistedCase.id,
            workflowRunId: runId,
            status: 'ACTIVE',
            createdAt: occurredAt,
            updatedAt: occurredAt,
          },
          idempotencyKey: `${inputData.idempotencyKey}:studio-link`,
          requestFingerprint: fingerprintValue({
            tenantId: context.tenantId,
            threadId: inputData.studioThreadKey,
            caseId: persistedCase.id,
            workflowRunId: runId,
          }),
        });
      }
      return caseCreatedSchema.parse({
        source: 'source' in inputData ? 'persisted-case' : 'fixture',
        scenario: 'source' in inputData ? null : inputData.scenario,
        idempotencyKey: inputData.idempotencyKey,
        caseId: persistedCase.id,
        status: persistedCase.status,
      });
    },
  });
