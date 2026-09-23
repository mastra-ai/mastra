/**
 * Browser-side client for the consolidated `/web/identity` endpoint.
 *
 * The endpoint returns every identity from every integration that opted into
 * the identity capability, each annotated with whether the acting user has
 * already claimed it. Both the settings `IdentityClaimsSection` and the
 * `useResolvedMe` hook (board `@me` chip + Cmd+K `@me` token) read the same
 * server-side claim table, so a fresh POST/DELETE shows up in both surfaces
 * after a single cache invalidation.
 */

export interface IdentityIntegrationDescriptor {
  id: string;
}

export interface IdentityRow {
  integrationId: string;
  externalUserId: string;
  label: string;
  email?: string;
  /**
   * Provider-served avatar URL when the integration surfaces one. Used by
   * the identity settings dropdown and `@me` chips so rows render a face
   * instead of the initials fallback whenever possible.
   */
  avatarUrl?: string;
  claimed: boolean;
}

export interface IdentityIndex {
  integrations: IdentityIntegrationDescriptor[];
  identities: IdentityRow[];
}

async function parseError(res: Response): Promise<Error> {
  let message = `Request failed (${res.status})`;
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    if (body.message) message = body.message;
    else if (body.error) message = body.error;
  } catch {
    /* ignore non-JSON */
  }
  return new Error(message);
}

/** Fetch the merged identity index (integrations + identities with claimed flags). */
export async function listIdentity(baseUrl: string): Promise<IdentityIndex> {
  const res = await fetch(`${baseUrl}/web/identity`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as IdentityIndex;
}

/** Claim an identity. Idempotent (POST twice returns 200 the second time). */
export async function claimIdentity(
  baseUrl: string,
  input: { integrationId: string; externalUserId: string; label: string; email?: string },
): Promise<void> {
  const res = await fetch(`${baseUrl}/web/identity`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await parseError(res);
}

/** Unclaim an identity. Idempotent (204 whether or not one existed). */
export async function unclaimIdentity(
  baseUrl: string,
  key: { integrationId: string; externalUserId: string },
): Promise<void> {
  const qs = new URLSearchParams({
    integrationId: key.integrationId,
    externalUserId: key.externalUserId,
  }).toString();
  const res = await fetch(`${baseUrl}/web/identity?${qs}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok && res.status !== 204) throw await parseError(res);
}
