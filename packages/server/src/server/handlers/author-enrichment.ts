import type { Mastra } from '@mastra/core';
import type { IUserProvider, User } from '@mastra/core/auth';
import type { RequestContext } from '@mastra/core/di';
import type { IMastraAuthProvider } from '@mastra/core/server';

/**
 * Public-safe resolved author shape — same fields exposed by `/auth/me`.
 * Provider-specific extras are intentionally stripped to avoid leaking
 * unexpected data through the stored-agent (and future stored-resource) APIs.
 */
export type ResolvedAuthor = {
  id: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
};

/**
 * Locate the auth provider from a Mastra instance using the same
 * private helper pattern as `auth.ts`. Returns null when:
 * - no server config is registered;
 * - `server.auth` is a `MastraAuthConfig`, not a `MastraAuthProvider`.
 */
function getAuthProvider(mastra: Mastra): IMastraAuthProvider | null {
  const serverConfig = (mastra as { getServer?: () => { auth?: unknown } }).getServer?.();
  if (!serverConfig?.auth) return null;
  if (typeof (serverConfig.auth as { authenticateToken?: unknown }).authenticateToken === 'function') {
    return serverConfig.auth as IMastraAuthProvider;
  }
  return null;
}

function isUserProvider(p: unknown): p is IUserProvider {
  return (
    p !== null &&
    typeof p === 'object' &&
    typeof (p as { getCurrentUser?: unknown }).getCurrentUser === 'function' &&
    typeof (p as { getUser?: unknown }).getUser === 'function'
  );
}

function dedupeIds(authorIds: ReadonlyArray<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const id of authorIds) {
    if (typeof id === 'string' && id.length > 0) set.add(id);
  }
  return Array.from(set);
}

function projectUser(user: User | null): Omit<ResolvedAuthor, 'id'> | null {
  if (!user) return null;
  const out: Omit<ResolvedAuthor, 'id'> = {};
  if (typeof user.name === 'string') out.name = user.name;
  if (typeof user.email === 'string') out.email = user.email;
  if (typeof user.avatarUrl === 'string') out.avatarUrl = user.avatarUrl;
  return out;
}

/**
 * Resolve a set of author IDs against the configured auth provider in one
 * shot. Soft-gated: returns `null` when there is no auth provider, the
 * provider does not implement `IUserProvider`, or the input has no valid
 * IDs to look up. Callers should treat `null` as "do not attach an `author`
 * field" so behavior matches setups without user awareness.
 *
 * When the provider exposes the optional `getUsers` batch method, the helper
 * calls it once with the deduped ID list. Otherwise it falls back to
 * `Promise.all(getUser(id))`, parallelized per unique ID. Provider errors
 * per ID are caught and treated as "unresolved" — they do not reject the
 * enrichment call.
 *
 * The returned map is keyed by the **requested** ID (not the user's `id`
 * field) to be robust against providers that normalize identifiers.
 */
export async function prepareAuthorEnrichment(
  mastra: Mastra,
  _requestContext: RequestContext,
  authorIds: ReadonlyArray<string | null | undefined>,
): Promise<Map<string, ResolvedAuthor> | null> {
  const provider = getAuthProvider(mastra);
  if (!provider || !isUserProvider(provider)) return null;

  const uniqueIds = dedupeIds(authorIds);
  if (uniqueIds.length === 0) return new Map();

  let users: Array<User | null>;
  if (typeof provider.getUsers === 'function') {
    try {
      users = await provider.getUsers(uniqueIds);
    } catch {
      // Batch lookup failed entirely — degrade gracefully to "no enrichment"
      return new Map();
    }
  } else {
    users = await Promise.all(uniqueIds.map(id => provider.getUser(id).catch((): User | null => null)));
  }

  const map = new Map<string, ResolvedAuthor>();
  uniqueIds.forEach((id, index) => {
    const projected = projectUser(users[index] ?? null);
    if (projected !== null) {
      map.set(id, { id, ...projected });
    }
  });
  return map;
}

/**
 * Attach a resolved `author` to a record by looking it up in the map by
 * `record.authorId`. When `authors` is `null` (feature off) or the id is
 * missing from the map, the record passes through unchanged.
 */
export function attachAuthor<T extends { authorId?: string | null }>(
  record: T,
  authors: Map<string, ResolvedAuthor> | null,
): T & { author?: ResolvedAuthor } {
  if (!authors) return record;
  const id = record.authorId;
  if (typeof id !== 'string' || id.length === 0) return record;
  const author = authors.get(id);
  if (!author) return record;
  return { ...record, author };
}
