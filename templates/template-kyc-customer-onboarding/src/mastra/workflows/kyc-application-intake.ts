import { createWorkflow, type Step } from '@mastra/core/workflows';
import type { z } from 'zod';

import {
  kycApplicationWorkflowInputSchema,
  kycApplicationWorkflowOutputSchema,
  kycWorkflowRequestContextSchema,
  type KycApplicationWorkflowDependencies,
} from './kyc-application-intake/contracts.js';
import {
  extractionAssessedSchema,
  createAssessCompletenessStep,
} from './kyc-application-intake/steps/assess-completeness.js';
import { createAddressVerificationStep } from './kyc-application-intake/steps/address-verification.js';
import { createAggregateChecksStep } from './kyc-application-intake/steps/aggregate-checks.js';
import { createApplicationStep } from './kyc-application-intake/steps/create-application.js';
import { createExtractDocumentStep } from './kyc-application-intake/steps/extract-document.js';
import { createIdentityVerificationStep } from './kyc-application-intake/steps/identity-verification.js';
import { createPepScreeningStep } from './kyc-application-intake/steps/pep-screening.js';
import { createRouteMissingStep } from './kyc-application-intake/steps/route-missing.js';
import { createRouteReadyStep } from './kyc-application-intake/steps/route-ready.js';
import { createSanctionsScreeningStep } from './kyc-application-intake/steps/sanctions-screening.js';
import { createSummarizeStep } from './kyc-application-intake/steps/summarize.js';
import { createValidateAndStoreDocumentStep } from './kyc-application-intake/steps/validate-and-store-document.js';

export {
  kycApplicationWorkflowInputSchema,
  kycApplicationWorkflowOutputSchema,
  kycWorkflowRequestContextSchema,
  type KycApplicationWorkflowDependencies,
  type KycWorkflowRequestContext,
} from './kyc-application-intake/contracts.js';

export const createKycApplicationWorkflow = (dependencies: KycApplicationWorkflowDependencies) => {
  const createApplication = createApplicationStep(dependencies);
  const validateAndStoreDocument = createValidateAndStoreDocumentStep(dependencies);
  const extractDocument = createExtractDocumentStep(dependencies);
  const assessCompleteness = createAssessCompletenessStep(dependencies);
  const routeReady = createRouteReadyStep(dependencies);
  const routeMissing = createRouteMissingStep(dependencies);
  const identityVerification = createIdentityVerificationStep(dependencies);
  const addressVerification = createAddressVerificationStep(dependencies);
  const sanctionsScreening = createSanctionsScreeningStep(dependencies);
  const pepScreening = createPepScreeningStep(dependencies);
  const aggregateChecks = createAggregateChecksStep();
  const summarize = createSummarizeStep();

  const readyForChecks = createWorkflow({
    id: 'ready-for-verification-checks-v1',
    description: 'Run independent identity, address, sanctions, and PEP checks in parallel',
    inputSchema: extractionAssessedSchema,
    outputSchema: kycApplicationWorkflowOutputSchema,
    requestContextSchema: kycWorkflowRequestContextSchema,
  })
    .then(routeReady)
    .parallel([identityVerification, addressVerification, sanctionsScreening, pepScreening])
    .then(aggregateChecks)
    .commit();

  const readyForChecksStep = readyForChecks as unknown as Step<
    'ready-for-verification-checks-v1',
    unknown,
    z.infer<typeof extractionAssessedSchema>,
    z.infer<typeof kycApplicationWorkflowOutputSchema>
  >;

  return createWorkflow({
    id: 'kyc-application-intake-v1',
    description: 'Deterministic intake, extraction, and parallel verification workflow',
    inputSchema: kycApplicationWorkflowInputSchema,
    outputSchema: kycApplicationWorkflowOutputSchema,
    requestContextSchema: kycWorkflowRequestContextSchema,
  })
    .then(createApplication)
    .then(validateAndStoreDocument)
    .then(extractDocument)
    .then(assessCompleteness)
    .branch([
      [({ inputData }) => Promise.resolve(inputData.assessment.route === 'READY_FOR_CHECKS'), readyForChecksStep],
      [({ inputData }) => Promise.resolve(inputData.assessment.route === 'MISSING_INFORMATION'), routeMissing],
    ])
    .then(summarize)
    .commit();
};

export type KycApplicationWorkflow = ReturnType<typeof createKycApplicationWorkflow>;
