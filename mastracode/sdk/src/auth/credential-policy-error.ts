export type CredentialPolicyFailure = 'missing-user-context' | 'no-policy-for-principal';

const CREDENTIAL_POLICY_UNRESOLVED = 'Tenant model credential policy could not be resolved';

const FAILURE_DETAIL: Record<CredentialPolicyFailure, string> = {
  'missing-user-context': 'the request has no authenticated user',
  'no-policy-for-principal': 'no credential policy applies to this request',
};

export function credentialPolicyFailureMessage(failure: CredentialPolicyFailure): string {
  return `${CREDENTIAL_POLICY_UNRESOLVED}: ${FAILURE_DETAIL[failure]}.`;
}

export function readCredentialPolicyFailure(message: string): CredentialPolicyFailure | undefined {
  const lower = message.toLowerCase();
  if (!lower.includes(CREDENTIAL_POLICY_UNRESOLVED.toLowerCase())) return undefined;
  return lower.includes(FAILURE_DETAIL['missing-user-context']) ? 'missing-user-context' : 'no-policy-for-principal';
}
