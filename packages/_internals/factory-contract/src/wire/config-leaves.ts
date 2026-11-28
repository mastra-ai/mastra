// Leaf types the config and voice wire shapes name. Factory's storage and voice modules import these;
// the code SDK owns the custom-provider ones and `mastracode/factory/src/routes/wire-parity.ts` keeps them equal.

export type CredentialScope = 'user' | 'org';

export type LoginSessionKind = 'paste-code' | 'device-code';

export interface CustomProviderLastCheck {
  /** When the test ran, as an ISO 8601 string. */
  at: string;
  ok: boolean;
  /** The failure message when the test failed. */
  message?: string;
}

export type CustomProviderAuthScheme = 'bearer' | 'x-api-key';

export interface CustomProviderCheckFailure {
  kind: 'http' | 'network' | 'timeout' | 'redirect' | 'invalid_response';
  /** One line, for example "HTTP 403 Forbidden from https://host/v1/models". */
  message: string;
  status?: number;
  /** Upstream body excerpt as plain text, at most 1,000 characters. */
  detail?: string;
}

export type CustomProviderModelsResult =
  | { ok: true; models: string[]; latencyMs: number }
  | { ok: false; failure: CustomProviderCheckFailure; latencyMs: number };

export type CustomProviderModelTestResult =
  | { ok: true; reply: string; finishReason?: string; latencyMs: number }
  | { ok: false; failure: CustomProviderCheckFailure; latencyMs: number };

/** Whose settings a session reads: the Factory's or the caller's own. */
export type EffectiveModelScope = 'factory' | 'user';

export interface RealtimeSession {
  url: string;
  token: string;
  expiresAt: string;
}
