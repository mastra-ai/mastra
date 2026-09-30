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
