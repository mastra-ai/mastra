import { durableJurisdictionPolicySchema, jurisdictionPolicyV1Schema } from '../../contracts/policies/policies.js';
import { calculatePolicyChecksum } from '../../contracts/policies/policy-checksum.js';
import { deepFreeze } from '../../domain/immutable.js';

const policyData = {
  id: 'US-demo-default',
  version: '1.1.0',
  jurisdiction: 'US',
  profile: 'demo-default',
  acceptedDocuments: ['PASSPORT', 'DRIVERS_LICENSE', 'STATE_ID'],
  identityDocumentRequirements: [
    { type: 'PASSPORT', sides: ['SINGLE'] },
    { type: 'DRIVERS_LICENSE', sides: ['FRONT'] },
    { type: 'STATE_ID', sides: ['FRONT'] },
  ],
  supplementalDocumentRequirements: [],
  requiredFields: ['fullName', 'dateOfBirth', 'documentNumber', 'expirationDate'],
  requiredChecks: ['IDENTITY', 'ADDRESS', 'SANCTIONS', 'PEP'],
  requiredReviewerRole: 'reviewer',
  seniorReviewerRole: 'senior-reviewer',
  requireDistinctSeniorReviewer: true,
  escalationThreshold: 70,
  missingInformation: {
    maxRounds: 2,
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
    thresholds: { lowMax: 29, mediumMax: 69 },
  },
  reasonTaxonomyVersion: '1.0.0',
} as const;

export const demoDefaultPolicy = durableJurisdictionPolicySchema.parse({
  ...policyData,
  checksum: calculatePolicyChecksum(policyData),
});

deepFreeze(demoDefaultPolicy);

const legacyPolicyData = {
  id: 'US-demo-default',
  version: '1.0.0',
  jurisdiction: 'US',
  profile: 'demo-default',
  acceptedDocuments: ['PASSPORT', 'DRIVERS_LICENSE', 'STATE_ID'],
  requiredFields: ['fullName', 'dateOfBirth', 'documentNumber', 'expirationDate'],
  requiredChecks: ['IDENTITY', 'ADDRESS', 'SANCTIONS', 'PEP'],
  requiredReviewerRole: 'reviewer',
  escalationThreshold: 70,
} as const;

export const demoDefaultPolicyV1 = jurisdictionPolicyV1Schema.parse({
  ...legacyPolicyData,
  checksum: calculatePolicyChecksum(legacyPolicyData),
});

deepFreeze(demoDefaultPolicyV1);
