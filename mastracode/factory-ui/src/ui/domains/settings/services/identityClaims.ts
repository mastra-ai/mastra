/**
 * Browser-side client for the `/web/identity/*` routes. Backs the settings
 * `IdentityClaimsSection` (Phase 5) and the `useResolvedMe` hook that both
 * the board `@me` chip and the Cmd+K `@me` token depend on.
 *
 * The `@me` filter and the settings UI read the same claim table on the
 * server, so a fresh claim/unclaim shows up in both surfaces after a single
 * cache invalidation.
 */

export interface IdentityClaim {
  /** Integration the claim belongs to (matches `FactoryIntegration.id`). */
  integrationId: string;
  /** Provider-native external-user id (login, uuid, accountId, etc.). */
  externalUserId: string;
  /** Human-visible label. */
  label: string;
  /** Optional email captured when the candidate carried one. */
  email?: string;
  /** ISO timestamp when the user claimed the account. */
  claimedAt: string;
}

export interface IdentityCandidate {
  externalUserId: string;
  label: string;
  email?: string;
  sources: Array<'observed' | 'api-listed'>;
}

export interface IdentityCandidateAcrossIntegrations extends IdentityCandidate {
  integrationId: string;
}

export interface IdentityIntegrationDescriptor {
  id: string;
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

/** List every integration that opted into the identity capability. */
export async function listIdentityIntegrations(baseUrl: string): Promise<IdentityIntegrationDescriptor[]> {
  const res = await fetch(`${baseUrl}/web/identity/integrations`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw await parseError(res);
  const { integrations } = (await res.json()) as { integrations: IdentityIntegrationDescriptor[] };
  return integrations;
}

/** All claims the acting user has made across every integration. */
export async function listMyIdentityClaims(baseUrl: string): Promise<IdentityClaim[]> {
  const res = await fetch(`${baseUrl}/web/identity/claims`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw await parseError(res);
  const { claims } = (await res.json()) as { claims: IdentityClaim[] };
  return claims;
}

/**
 * Candidate accounts for a specific integration. `query` is an optional
 * server-side substring match against `label`/`email`/`externalUserId`.
 */
export async function listIdentityCandidates(
  baseUrl: string,
  integrationId: string,
  query?: string,
): Promise<IdentityCandidate[]> {
  const qs = query && query.trim().length > 0 ? `?query=${encodeURIComponent(query.trim())}` : '';
  const res = await fetch(`${baseUrl}/web/identity/candidates/${encodeURIComponent(integrationId)}${qs}`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw await parseError(res);
  const { candidates } = (await res.json()) as { candidates: IdentityCandidate[] };
  return candidates;
}

/** Candidate accounts across every identity-capable integration. */
export async function listAllIdentityCandidates(
  baseUrl: string,
  query?: string,
): Promise<IdentityCandidateAcrossIntegrations[]> {
  const qs = query && query.trim().length > 0 ? `?query=${encodeURIComponent(query.trim())}` : '';
  const res = await fetch(`${baseUrl}/web/identity/candidates${qs}`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw await parseError(res);
  const { candidates } = (await res.json()) as { candidates: IdentityCandidateAcrossIntegrations[] };
  return candidates;
}

/** Persist a claim; idempotent (POST twice returns 200 the second time). */
export async function upsertIdentityClaim(
  baseUrl: string,
  input: { integrationId: string; externalUserId: string; label: string; email?: string },
): Promise<IdentityClaim> {
  const res = await fetch(`${baseUrl}/web/identity/claims`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await parseError(res);
  const { claim } = (await res.json()) as { claim: IdentityClaim };
  return claim;
}

/** Remove a claim; idempotent (204 whether or not one existed). */
export async function removeIdentityClaim(
  baseUrl: string,
  key: { integrationId: string; externalUserId: string },
): Promise<void> {
  const res = await fetch(
    `${baseUrl}/web/identity/claims/${encodeURIComponent(key.integrationId)}/${encodeURIComponent(key.externalUserId)}`,
    { method: 'DELETE', credentials: 'include' },
  );
  if (!res.ok && res.status !== 204) throw await parseError(res);
}
