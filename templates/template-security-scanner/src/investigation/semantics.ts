import type { Category } from '../knowledge/playbooks.js';

type CategorySemantics = {
  criterionMeaning: 'SECURE_BEHAVIOR' | 'AUTHORIZED_REPRODUCTION';
  confirmationCondition: string;
};

// Category policy is identical for every case. No observed verdict or case label belongs here.
const categorySemantics: Readonly<Record<Category, CategorySemantics>> = {
  idor: {
    criterionMeaning: 'SECURE_BEHAVIOR',
    confirmationCondition:
      'Distinct identities receive the same owned resource marker with owner and alternate HTTP 200 responses.',
  },
  authentication_bypass: {
    criterionMeaning: 'SECURE_BEHAVIOR',
    confirmationCondition:
      'The authenticated baseline is HTTP 200 and a public or invalid session also receives HTTP 200 with the protected marker.',
  },
  bfla: {
    criterionMeaning: 'SECURE_BEHAVIOR',
    confirmationCondition:
      'Distinct admin and low roles both receive HTTP 200 with the same admin marker from the read-only function.',
  },
  ssrf: {
    criterionMeaning: 'AUTHORIZED_REPRODUCTION',
    confirmationCondition:
      'A current recorded approval in the owned lab permits the owned callback, and the callback is observed.',
  },
  misconfiguration: {
    criterionMeaning: 'SECURE_BEHAVIOR',
    confirmationCondition:
      'The observed security header value differs from its documented expected value, including a missing header.',
  },
  cors: {
    criterionMeaning: 'SECURE_BEHAVIOR',
    confirmationCondition: 'The disallowed cross-origin browser can read the harmless sensitive fixture.',
  },
  open_redirect: {
    criterionMeaning: 'SECURE_BEHAVIOR',
    confirmationCondition:
      'The unfollowed Location is outside the approved origin and exactly matches the submitted controlled destination.',
  },
  information_exposure: {
    criterionMeaning: 'SECURE_BEHAVIOR',
    confirmationCondition: 'The public response contains the known harmless marker.',
  },
};

export function vulnerabilityAssessmentContract(category: Category) {
  return { claim: 'VULNERABILITY_PRESENT' as const, ...categorySemantics[category] };
}
