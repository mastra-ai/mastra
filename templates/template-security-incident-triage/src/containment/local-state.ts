export type LocalContainmentState = {
  sessions: Map<string, 'active' | 'revoked'>;
  roles: Map<string, string>;
  devices: Map<string, 'clear' | 'pending'>;
  reauthentication: Map<string, string>;
  calls: Map<string, number>;
  failActions?: Set<string>;
  failAfterEffectActions?: Set<string>;
  verificationFailures?: Set<string>;
  delayMs?: number;
};
