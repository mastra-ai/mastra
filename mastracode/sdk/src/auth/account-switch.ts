/**
 * Browser-safe account-switch and model-fallback notice types.
 *
 * The rotation processor emits these parts and the TUI renders them; a
 * browser UI (Factory) renders the same persisted parts. This module must
 * therefore stay free of imports, direct or transitive — it holds only
 * constants, types and pure formatters.
 */

export const ACCOUNT_SWITCH_PART_TYPE = 'data-mastracode-account-switch';

/** Labels and instance ids only — never token material (do-not list). */
export interface AccountSwitchPartData {
  provider: string;
  from: { id: string; label: string } | null;
  to: { id: string; label: string } | null;
  reason:
    | 'rate-limit'
    | 'quota-exhausted'
    | 'auth-failed'
    | 'pool-exhausted'
    | 'persistent-outage'
    | 'preferred-routing';
  at: string;
  /**
   * Set on a `to: null` part when a route pinned to a single account reported
   * that account unusable. The provider's other subscriptions were never
   * consulted (A12), so "all accounts unavailable" would misreport what
   * happened.
   */
  exclusive?: boolean;
}

/** Persisted data-part type for a model-route hop. */
export const MODEL_FALLBACK_PART_TYPE = 'data-mastracode-model-fallback' as const;

/** Non-secret transcript payload for a model-route hop. */
export interface ModelFallbackPartData {
  from: { entryId: string; label: string };
  to: { entryId: string; label: string };
  reason: 'pool-exhausted' | 'persistent-outage';
  at: string;
}

/** Session-state key set when account rotation advances the model route. */
export const MODEL_FALLBACK_STATE_KEY = 'mastracodePendingModelFallback' as const;

/** Payload written to session state under MODEL_FALLBACK_STATE_KEY. */
export interface PendingModelFallback {
  fromEntryId: string;
  toEntryId: string;
  toModelId: string;
  threadId?: string;
  reason: 'pool-exhausted' | 'persistent-outage';
  at: string;
}

/** Friendly names for the part/notice copy (display only — never auth data). */
export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  anthropic: 'Anthropic',
  'kimi-for-coding': 'Kimi',
  'openai-codex': 'Codex',
  'github-copilot': 'GitHub Copilot',
  xai: 'xAI',
};

const REASON_TEXT: Record<AccountSwitchPartData['reason'], string> = {
  'rate-limit': 'rate limit',
  'quota-exhausted': 'quota exhausted',
  'auth-failed': 'auth failed',
  'pool-exhausted': 'pool exhausted',
  'persistent-outage': 'persistent outage',
  'preferred-routing': 'subscription routing',
};

/** Validates untrusted `reason` values (e.g. persisted message parts). */
export function isAccountSwitchReason(value: unknown): value is AccountSwitchPartData['reason'] {
  // Own-property check: `in` would accept prototype names like 'toString',
  // which would then interpolate the inherited function into the notice text.
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(REASON_TEXT, value);
}

/**
 * One-line transcript copy for a switch part. Shared by the live `info`
 * controller event (the TUI shows controller `info` events as transcript
 * lines, and no message event carries data parts mid-run) and by the TUI's
 * history rendering of the persisted part — one formatter, identical text.
 */
export function accountSwitchNoticeText(data: AccountSwitchPartData): string {
  const provider = PROVIDER_DISPLAY_NAMES[data.provider] ?? data.provider;
  const reason = REASON_TEXT[data.reason];
  if (data.to === null) {
    // A12: a targeted route reports *its* account, not the pool — the other
    // subscriptions were never tried, so "all accounts unavailable" would be
    // wrong and would read as if the pool had been walked.
    if (data.exclusive) {
      return `Pinned ${provider} account unavailable (${reason})`;
    }
    return `All ${provider} accounts unavailable (${reason})`;
  }
  const from = data.from?.label ?? 'unknown';
  return `Switched ${provider} account: ${from} → ${data.to.label} (${reason})`;
}

/** Transcript line for a model-route hop; shared by the live info event and the TUI's history render. */
export function modelFallbackNoticeText(data: ModelFallbackPartData): string {
  const reason = REASON_TEXT[data.reason] ?? data.reason;
  return `Switched model route: ${data.from.label} → ${data.to.label} (${reason})`;
}

/**
 * Whether a persisted model-fallback reason is one this build understands.
 * `REASON_TEXT` also covers the account-switch reasons, so the notice text
 * alone would happily render a foreign value such as `rate-limit` as a
 * model-fallback reason; history parsed from another build's part must be
 * rejected instead.
 */
export function isModelFallbackReason(value: unknown): value is ModelFallbackPartData['reason'] {
  return value === 'pool-exhausted' || value === 'persistent-outage';
}
