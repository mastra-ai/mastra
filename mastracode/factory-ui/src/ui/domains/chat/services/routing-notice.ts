import {
  ACCOUNT_SWITCH_PART_TYPE,
  MODEL_FALLBACK_PART_TYPE,
  accountSwitchNoticeText,
  isAccountSwitchReason,
  isModelFallbackReason,
  modelFallbackNoticeText,
} from '@mastra/code-sdk/auth/account-switch';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function account(value: unknown): { id: string; label: string } | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.label !== 'string') return null;
  return { id: value.id, label: value.label };
}

function route(value: unknown): { entryId: string; label: string } | null {
  if (!isRecord(value) || typeof value.entryId !== 'string' || typeof value.label !== 'string') return null;
  return { entryId: value.entryId, label: value.label };
}

function accountSwitchText(data: unknown): string | undefined {
  if (!isRecord(data) || typeof data.provider !== 'string' || !isAccountSwitchReason(data.reason)) return undefined;
  // `to: null` is the persisted marker for "no usable account". Any other
  // unparseable endpoint is drift and reads as unknown, not as pool exhaustion.
  const to = data.to === null || data.to === undefined ? null : (account(data.to) ?? { id: '', label: 'unknown' });
  return accountSwitchNoticeText({
    provider: data.provider,
    from: account(data.from),
    to,
    reason: data.reason,
    at: typeof data.at === 'string' ? data.at : '',
    exclusive: data.exclusive === true,
  });
}

function modelFallbackText(data: unknown): string | undefined {
  if (!isRecord(data) || !isModelFallbackReason(data.reason)) return undefined;
  const from = route(data.from);
  const to = route(data.to);
  if (!from || !to) return undefined;
  return modelFallbackNoticeText({ from, to, reason: data.reason, at: typeof data.at === 'string' ? data.at : '' });
}

/**
 * The transcript line for a persisted account-switch or model-fallback part,
 * worded exactly as the TUI words it. Undefined for any other part, and for
 * parts whose payload this build cannot read.
 */
export function routingNoticeText(part: unknown): string | undefined {
  if (!isRecord(part)) return undefined;
  if (part.type === ACCOUNT_SWITCH_PART_TYPE) return accountSwitchText(part.data);
  if (part.type === MODEL_FALLBACK_PART_TYPE) return modelFallbackText(part.data);
  return undefined;
}
