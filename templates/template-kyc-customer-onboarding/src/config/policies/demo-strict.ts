import { durableJurisdictionPolicySchema, jurisdictionPolicyV1Schema } from '../../contracts/policies/policies.js';
import { calculatePolicyChecksum } from '../../contracts/policies/policy-checksum.js';
import { deepFreeze } from '../../domain/immutable.js';

const policyData = {
  id: 'US-demo-strict',
  version: '1.1.0',
  jurisdiction: 'US',
  profile: 'demo-strict',
  acceptedDocuments: ['PASSPORT', 'DRIVERS_LICENSE', 'STATE_ID', 'PROOF_OF_ADDRESS'],
  identityDocumentRequirements: [
    { type: 'PASSPORT', sides: ['SINGLE'] },
    { type: 'DRIVERS_LICENSE', sides: ['FRONT', 'BACK'] },
    { type: 'STATE_ID', sides: ['FRONT', 'BACK'] },
  ],
  supplementalDocumentRequirements: [{ type: 'PROOF_OF_ADDRESS', sides: ['SINGLE'] }],
  requiredFields: ['fullName', 'dateOfBirth', 'documentNumber', 'expirationDate', 'residentialAddress'],
  requiredChecks: ['IDENTITY', 'ADDRESS', 'SANCTIONS', 'PEP'],
  requiredReviewerRole: 'senior-reviewer',
  seniorReviewerRole: 'senior-reviewer',
  requireDistinctSeniorReviewer: true,
  escalationThreshold: 50,
  missingInformation: {
    maxRounds: 1,
    resumeTtlHours: 24,
    exhaustedRoute: 'INSUFFICIENT_INFORMATION',
  },
  risk: {
    weights: {
      identityMismatch: 35,
      addressMismatch: 20,
      sanctionsPossible: 40,
      sanctionsStrong: 70,
      pepPossible: 30,
      pepStrong: 50,
      inconclusive: 15,
      unavailable: 25,
    },
    thresholds: { lowMax: 19, mediumMax: 49 },
  },
  reasonTaxonomyVersion: '1.0.0',
} as const;

export const demoStrictPolicy = durableJurisdictionPolicySchema.parse({
  ...policyData,
  checksum: calculatePolicyChecksum(policyData),
});

deepFreeze(demoStrictPolicy);

const legacyPolicyData = {
  id: 'US-demo-strict',
  version: '1.0.0',
  jurisdiction: 'US',
  profile: 'demo-strict',
  acceptedDocuments: ['PASSPORT', 'DRIVERS_LICENSE', 'STATE_ID', 'PROOF_OF_ADDRESS'],
  requiredFields: ['fullName', 'dateOfBirth', 'documentNumber', 'expirationDate', 'residentialAddress'],
  requiredChecks: ['IDENTITY', 'ADDRESS', 'SANCTIONS', 'PEP'],
  requiredReviewerRole: 'senior-reviewer',
  escalationThreshold: 50,
} as const;

export const demoStrictPolicyV1 = jurisdictionPolicyV1Schema.parse({
  ...legacyPolicyData,
  checksum: calculatePolicyChecksum(legacyPolicyData),
});

deepFreeze(demoStrictPolicyV1);
