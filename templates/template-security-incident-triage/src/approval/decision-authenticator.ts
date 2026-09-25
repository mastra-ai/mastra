import type { AuthenticatedDecisionContext } from '../schemas/approval.js';

export type DecisionAuthenticationInput = Readonly<{
  method: string;
  path: string;
  rawBody: Uint8Array;
  signature: string | undefined;
  nonce: string | undefined;
  tenantId: string | undefined;
}>;

export interface DecisionAuthenticator {
  authenticate(input: DecisionAuthenticationInput): Promise<AuthenticatedDecisionContext>;
}

export class DecisionAuthenticationError extends Error {
  constructor(
    readonly code:
      | 'AUTHENTICATION_REQUIRED'
      | 'AUTHENTICATION_INVALID'
      | 'AUTHENTICATION_EXPIRED'
      | 'AUTHENTICATION_REPLAYED'
      | 'AUTHENTICATION_MODE_DENIED',
  ) {
    super('Decision authentication failed.');
    this.name = 'DecisionAuthenticationError';
  }
}
