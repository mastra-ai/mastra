import type { DashboardTimelineEvent } from './contracts.js';

const safeScalar = (value: unknown): string | number | boolean | null => {
  if (typeof value === 'string') return value.slice(0, 160);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  return '[redacted]';
};

/** Never spread persistence rows: DTOs are closed and explicitly allowlisted. */
export function redactTimelinePayload(value: unknown): DashboardTimelineEvent['payloadRedacted'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  // Event payloads are untrusted operational data.  A deny-list on key names
  // cannot protect values such as { note: "token …" }; only typed status data
  // is useful in a live timeline and is safe to project by construction.
  const allowed = new Set(['status', 'state', 'code', 'durationMs', 'attempt', 'actionId']);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => allowed.has(key))
      .slice(0, 20)
      .map(([key, item]) => [key, safeScalar(item)]),
  );
}

export function safeExternalUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    // The dashboard has no approved external provider contract. Do not expose an
    // arbitrary HTTPS URL until a provider + host + path allowlist exists.
    return url.protocol === 'https:' &&
      url.hostname === 'linear.app' &&
      /^\/team\/[A-Za-z0-9_-]{1,128}$/u.test(url.pathname) &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.search &&
      !url.hash
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
