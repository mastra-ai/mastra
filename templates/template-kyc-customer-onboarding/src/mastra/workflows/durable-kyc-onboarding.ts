import { createWorkflow, type Step } from '@mastra/core/workflows';
import type { z } from 'zod';

import { kycWorkflowRequestContextSchema } from './kyc-application-intake.js';
import type { kycApplicationWorkflowOutputSchema } from './kyc-application-intake.js';
import {
  durableKycWorkflowInputSchema,
  durableKycWorkflowOutputSchema,
  durableKycWorkflowStateSchema,
  type DurableKycWorkflowDependencies,
} from './durable-kyc-onboarding/contracts.js';
import { createDurableWorkflowRuntime } from './durable-kyc-onboarding/runtime.js';
import { createAddressVerificationStep } from './durable-kyc-onboarding/steps/address-verification.js';
import { createAggregateResumedChecksStep } from './durable-kyc-onboarding/steps/aggregate-resumed-checks.js';
import { createAssessRiskStep } from './durable-kyc-onboarding/steps/assess-risk.js';
import { createCollectComplianceReviewStep } from './durable-kyc-onboarding/steps/collect-compliance-review.js';
import { createCollectMissingInformationStep } from './durable-kyc-onboarding/steps/collect-missing-information.js';
import { createIdentityVerificationStep } from './durable-kyc-onboarding/steps/identity-verification.js';
import { createMergeChecksStep } from './durable-kyc-onboarding/steps/merge-checks.js';
import { createMergeCompletenessStep } from './durable-kyc-onboarding/steps/merge-completeness.js';
import { createPassCompleteIntakeStep } from './durable-kyc-onboarding/steps/pass-complete-intake.js';
import { createPassExistingChecksStep } from './durable-kyc-onboarding/steps/pass-existing-checks.js';
import { createPassInsufficientEvidenceStep } from './durable-kyc-onboarding/steps/pass-insufficient-evidence.js';
import { createPepScreeningStep } from './durable-kyc-onboarding/steps/pep-screening.js';
import { createPrepareProgressStep, progressSchema } from './durable-kyc-onboarding/steps/prepare-progress.js';
import { createPrepareResumedChecksStep } from './durable-kyc-onboarding/steps/prepare-resumed-checks.js';
import { createPrepareReviewStep, reviewProgressSchema } from './durable-kyc-onboarding/steps/prepare-review.js';
import { createProvisionStep } from './durable-kyc-onboarding/steps/provision.js';
import { createSanctionsScreeningStep } from './durable-kyc-onboarding/steps/sanctions-screening.js';

export {
  durableKycWorkflowInputSchema,
  durableKycWorkflowOutputSchema,
  durableKycWorkflowStateSchema,
  type DurableKycWorkflowDependencies,
} from './durable-kyc-onboarding/contracts.js';
export {
  missingInformationResumeSchema,
  missingInformationSuspendSchema,
} from './durable-kyc-onboarding/steps/collect-missing-information.js';
export {
  complianceReviewResumeSchema,
  complianceReviewSuspendSchema,
} from './durable-kyc-onboarding/steps/collect-compliance-review.js';

export const createDurableKycOnboardingWorkflow = (dependencies: DurableKycWorkflowDependencies) => {
  const { transition, measureWorkflowStep } = createDurableWorkflowRuntime(dependencies);
  const initialWorkflowStep = dependencies.initialWorkflow as unknown as Step<
    'kyc-application-intake-v1',
    unknown,
    z.infer<typeof durableKycWorkflowInputSchema>,
    z.infer<typeof kycApplicationWorkflowOutputSchema>
  >;
  const prepareProgress = createPrepareProgressStep(dependencies, transition);
  const collectMissingInformation = createCollectMissingInformationStep(dependencies, transition);
  const passCompleteIntake = createPassCompleteIntakeStep();
  const mergeCompleteness = createMergeCompletenessStep();
  const prepareResumedChecks = createPrepareResumedChecksStep();
  const identityVerification = createIdentityVerificationStep(dependencies);
  const addressVerification = createAddressVerificationStep(dependencies);
  const sanctionsScreening = createSanctionsScreeningStep(dependencies);
  const pepScreening = createPepScreeningStep(dependencies);
  const aggregateResumedChecks = createAggregateResumedChecksStep();
  const passChecks = createPassExistingChecksStep();
  const passInsufficient = createPassInsufficientEvidenceStep();
  const mergeChecks = createMergeChecksStep();
  const assessRisk = createAssessRiskStep(dependencies, transition, measureWorkflowStep);
  const prepareReview = createPrepareReviewStep();
  const collectComplianceReview = createCollectComplianceReviewStep(dependencies, transition, measureWorkflowStep);
  const provision = createProvisionStep(dependencies, transition);

  const missingInformationLoop = createWorkflow({
    id: 'missing-information-loop-v1',
    inputSchema: progressSchema,
    outputSchema: progressSchema,
    stateSchema: durableKycWorkflowStateSchema,
    requestContextSchema: kycWorkflowRequestContextSchema,
  })
    .dowhile(collectMissingInformation, ({ inputData }) =>
      Promise.resolve(inputData.completenessStatus === 'MISSING_INFORMATION'),
    )
    .commit();
  const missingInformationLoopStep = missingInformationLoop as unknown as Step<
    'missing-information-loop-v1',
    z.infer<typeof durableKycWorkflowStateSchema>,
    z.infer<typeof progressSchema>,
    z.infer<typeof progressSchema>
  >;

  const resumedChecksWorkflow = createWorkflow({
    id: 'resumed-verification-checks-v1',
    inputSchema: progressSchema,
    outputSchema: progressSchema,
    requestContextSchema: kycWorkflowRequestContextSchema,
  })
    .then(prepareResumedChecks)
    .parallel([identityVerification, addressVerification, sanctionsScreening, pepScreening])
    .then(aggregateResumedChecks)
    .commit();
  const resumedChecksStep = resumedChecksWorkflow as unknown as Step<
    'resumed-verification-checks-v1',
    unknown,
    z.infer<typeof progressSchema>,
    z.infer<typeof progressSchema>
  >;

  const reviewLoop = createWorkflow({
    id: 'compliance-review-loop-v1',
    inputSchema: reviewProgressSchema,
    outputSchema: reviewProgressSchema,
    stateSchema: durableKycWorkflowStateSchema,
    requestContextSchema: kycWorkflowRequestContextSchema,
  })
    .dowhile(collectComplianceReview, ({ inputData }) => Promise.resolve(inputData.needsSeniorReview))
    .commit();
  const reviewLoopStep = reviewLoop as unknown as Step<
    'compliance-review-loop-v1',
    z.infer<typeof durableKycWorkflowStateSchema>,
    z.infer<typeof reviewProgressSchema>,
    z.infer<typeof reviewProgressSchema>
  >;

  return (
    createWorkflow({
      id: 'durable-kyc-onboarding-v1',
      description: 'Durable policy-pinned onboarding with missing information, risk, human review, and provisioning',
      inputSchema: durableKycWorkflowInputSchema,
      outputSchema: durableKycWorkflowOutputSchema,
      stateSchema: durableKycWorkflowStateSchema,
      requestContextSchema: kycWorkflowRequestContextSchema,
    })
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Mastra nested workflows erase their engine generic.
      .then(initialWorkflowStep)
      .then(prepareProgress)
      .branch([
        [({ inputData }) => Promise.resolve(inputData.status === 'MISSING_INFORMATION'), missingInformationLoopStep],
        [({ inputData }) => Promise.resolve(inputData.status === 'CHECKING'), passCompleteIntake],
      ])
      .then(mergeCompleteness)
      .branch([
        [
          ({ inputData }) => Promise.resolve(inputData.status === 'CHECKING' && inputData.checks === null),
          resumedChecksStep,
        ],
        [({ inputData }) => Promise.resolve(inputData.status === 'CHECKING' && inputData.checks !== null), passChecks],
        [({ inputData }) => Promise.resolve(inputData.status === 'ASSESSING_RISK'), passInsufficient],
      ])
      .then(mergeChecks)
      .then(assessRisk)
      .then(prepareReview)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Mastra nested workflows erase their engine generic.
      .then(reviewLoopStep)
      .then(provision)
      .commit()
  );
};

export type DurableKycOnboardingWorkflow = ReturnType<typeof createDurableKycOnboardingWorkflow>;
