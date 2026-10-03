import { MASTRA_AVATAR_SCHEME } from './validate-avatar';

/**
 * Compute the server-relative avatar URL for a `mastra-avatar:<agentId>` reference.
 * `routePrefix` typically comes from the server adapter (`/api` by default). A
 * missing prefix falls back to `/api` to match the historical default.
 */
export function computeAvatarRouteUrl(agentId: string, routePrefix?: string): string {
  const raw = (routePrefix ?? '/api').trim() || '/api';
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  const prefix = withSlash.endsWith('/') ? withSlash.slice(0, -1) : withSlash;
  return `${prefix}/agents/${encodeURIComponent(agentId)}/avatar`;
}

/**
 * Rewrite a `mastra-avatar:<agentId>` URL to the server-relative avatar route
 * URL so `<img src>` renders it without client-side awareness of the scheme.
 * Returns the original value unchanged for any other URL shape.
 */
export function rewriteMastraAvatarUrl(value: unknown, agentId: string, routePrefix?: string): unknown {
  if (typeof value !== 'string' || !value.startsWith(MASTRA_AVATAR_SCHEME)) return value;
  const id = value.slice(MASTRA_AVATAR_SCHEME.length);
  // Only rewrite when the URL points at the same agent the record belongs to;
  // any mismatch is left alone so the caller can spot invalid data.
  if (id !== agentId) return value;
  return computeAvatarRouteUrl(agentId, routePrefix);
}

/**
 * Return a copy of a stored-agent record with its `metadata.avatarUrl`
 * rewritten from `mastra-avatar:<agentId>` to the server-relative avatar route
 * URL. Records without a matching avatarUrl are returned unchanged.
 */
export function rewriteStoredAgentAvatar<T extends { id: string; metadata?: Record<string, unknown> | null }>(
  record: T,
  routePrefix?: string,
): T {
  const avatarUrl = record.metadata?.avatarUrl;
  if (typeof avatarUrl !== 'string' || !avatarUrl.startsWith(MASTRA_AVATAR_SCHEME)) return record;
  const rewritten = rewriteMastraAvatarUrl(avatarUrl, record.id, routePrefix);
  if (rewritten === avatarUrl) return record;
  return {
    ...record,
    metadata: {
      ...(record.metadata ?? {}),
      avatarUrl: rewritten,
    },
  };
}

/**
 * Inverse of {@link rewriteMastraAvatarUrl}: if a caller submits a server-
 * relative or absolute avatar route URL (e.g. the one returned by GET), map
 * it back to the canonical `mastra-avatar:<agentId>` reference before
 * validation and persistence. This keeps GET → PATCH round-trips working
 * without clients needing to know about the scheme.
 *
 * Any other URL shape (data:, http(s): to a different host, mastra-avatar:
 * already) is returned unchanged.
 */
export function normalizeIncomingAvatarUrl(value: unknown, agentId: string, routePrefix?: string): unknown {
  if (typeof value !== 'string') return value;
  if (value.startsWith(MASTRA_AVATAR_SCHEME)) return value;

  const canonical = `${MASTRA_AVATAR_SCHEME}${agentId}`;
  const encodedId = encodeURIComponent(agentId);

  // Shape of the server avatar route — accept it whether the configured
  // routePrefix matches, the default `/api`, no prefix at all, or an
  // absolute URL whose pathname matches any of the above.
  const candidatePaths = new Set<string>([
    computeAvatarRouteUrl(agentId, routePrefix),
    computeAvatarRouteUrl(agentId, '/api'),
    `/agents/${encodedId}/avatar`,
  ]);

  if (candidatePaths.has(value)) return canonical;

  try {
    const u = new URL(value, 'http://_local');
    if (candidatePaths.has(u.pathname)) return canonical;
  } catch {
    // not a URL — fall through
  }

  return value;
}

/**
 * Companion to {@link normalizeIncomingAvatarUrl} for a full metadata object.
 * Returns the same reference when nothing changes, so callers can cheaply pass
 * the result through to persistence without creating garbage.
 */
export function normalizeIncomingAvatarMetadata<T extends Record<string, unknown> | undefined | null>(
  metadata: T,
  agentId: string,
  routePrefix?: string,
): T {
  if (!metadata || !('avatarUrl' in metadata)) return metadata;
  const normalized = normalizeIncomingAvatarUrl(metadata.avatarUrl, agentId, routePrefix);
  if (normalized === metadata.avatarUrl) return metadata;
  return { ...metadata, avatarUrl: normalized } as T;
}
