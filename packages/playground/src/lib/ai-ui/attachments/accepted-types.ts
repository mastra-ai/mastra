/**
 * Configurable allowlist for chat attachment file types.
 *
 * Configured via the `MASTRA_STUDIO_ATTACHMENT_TYPES` env var (comma-separated
 * MIME types, wildcards allowed — e.g. `image/*,application/pdf,text/csv`),
 * injected into the page as `window.MASTRA_STUDIO_ATTACHMENT_TYPES`.
 * When unset, all file types are accepted (current behavior).
 */

const PLACEHOLDER = /^%%.*%%$/;

/** Parsed allowlist, or null when unconfigured (= accept everything). */
export const getAcceptedAttachmentTypes = (): string[] | null => {
  const raw =
    typeof window === 'undefined'
      ? undefined
      : ((window as unknown as Record<string, unknown>).MASTRA_STUDIO_ATTACHMENT_TYPES as string | undefined);
  if (!raw || PLACEHOLDER.test(raw)) return null;
  const types = raw
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);
  return types.length > 0 ? types : null;
};

/** Match a content type against the allowlist (exact match, `type/*` wildcard, or a lone `*`). */
export const isAcceptedAttachmentType = (contentType: string, accepted: string[] | null): boolean => {
  if (!accepted) return true;
  const normalized = (contentType.split(';')[0] ?? '').trim().toLowerCase();
  return accepted.some(pattern => {
    const p = pattern.toLowerCase();
    if (p === '*/*' || p === '*') return true;
    if (p.endsWith('/*')) return normalized.startsWith(p.slice(0, -1));
    return normalized === p;
  });
};

/** Value for the file input's `accept` attribute, or undefined when unrestricted. */
export const acceptAttributeValue = (accepted: string[] | null): string | undefined =>
  accepted ? accepted.join(',') : undefined;
