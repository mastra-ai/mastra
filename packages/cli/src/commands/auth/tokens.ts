import { MASTRA_PLATFORM_API_URL, authHeaders, platformFetch, throwApiError } from './client.js';
import { getToken, getCurrentOrgId } from './credentials.js';

async function resolveOrgId(): Promise<string | null> {
  return process.env.MASTRA_ORG_ID ?? (await getCurrentOrgId());
}

interface TokenInfo {
  id: string;
  name: string;
  obfuscatedValue: string;
  lastUsedAt: string | null;
  createdAt: string;
  /** Absent from Platform versions that predate token permissions. */
  permissions?: string[];
}

export async function createToken(
  token: string,
  orgId: string,
  name: string,
  permissions: string[] = [],
): Promise<{ id: string; secret: string; permissions: string[] }> {
  const resp = await platformFetch(`${MASTRA_PLATFORM_API_URL}/v1/auth/tokens`, {
    method: 'POST',
    headers: {
      ...authHeaders(token, orgId),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(permissions.length > 0 ? { name, permissions } : { name }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throwApiError('Failed to create token', resp.status, text);
  }

  const data = (await resp.json()) as { token: TokenInfo; secret: string };
  const granted = data.token.permissions ?? [];
  // A Platform that predates token permissions ignores the field and mints a
  // plain key; revoke it and fail rather than hand back a key that will 403 later.
  const missing = permissions.filter(p => !granted.includes(p));
  if (missing.length > 0) {
    const problem = `Token ${data.token.id} was created without ${missing.join(', ')}; this Platform may not support token permissions yet.`;
    try {
      await revokeToken(token, orgId, data.token.id);
    } catch {
      throw new Error(`${problem} Revoking it also failed. Revoke it with: mastra auth tokens revoke ${data.token.id}`);
    }
    throw new Error(`${problem} It has been revoked.`);
  }
  return { id: data.token.id, secret: data.secret, permissions: granted };
}

export async function createTokenAction(name: string, options: { permission?: string[] } = {}) {
  const token = await getToken();
  const orgId = await resolveOrgId();
  if (!orgId) throw new Error('No organization selected. Run: mastra auth orgs switch');

  const result = await createToken(token, orgId, name, options.permission ?? []);

  console.info('\nToken created successfully!\n');
  console.info(`  Name:    ${name}`);
  console.info(`  ID:      ${result.id}`);
  if (result.permissions.length > 0) {
    console.info(`  Permissions: ${result.permissions.join(', ')}`);
  }
  console.info('');
  console.info(`  Secret:  ${result.secret}`);
  console.info('');
  console.info('  Save this secret — it will not be shown again.');
  console.info('  Set it as MASTRA_API_TOKEN in your CI environment.\n');
}

export async function listTokensAction() {
  const token = await getToken();
  const orgId = await resolveOrgId();
  if (!orgId) throw new Error('No organization selected. Run: mastra auth orgs switch');

  const resp = await platformFetch(`${MASTRA_PLATFORM_API_URL}/v1/auth/tokens`, {
    headers: authHeaders(token, orgId),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throwApiError('Failed to list tokens', resp.status, text);
  }

  const data = (await resp.json()) as { tokens: TokenInfo[] };

  if (data.tokens.length === 0) {
    console.info('\nNo tokens found.\n');
    return;
  }

  console.info('\nTokens:\n');
  for (const t of data.tokens) {
    const lastUsed = t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleDateString() : 'never';
    console.info(`  ${t.name}`);
    console.info(`    ID: ${t.id}  Key: ${t.obfuscatedValue}  Last used: ${lastUsed}`);
    if (t.permissions?.length) {
      console.info(`    Permissions: ${t.permissions.join(', ')}`);
    }
  }
  console.info('');
}

export async function revokeToken(token: string, orgId: string, tokenId: string): Promise<void> {
  const resp = await platformFetch(`${MASTRA_PLATFORM_API_URL}/v1/auth/tokens/${encodeURIComponent(tokenId)}`, {
    method: 'DELETE',
    headers: authHeaders(token, orgId),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throwApiError('Failed to revoke token', resp.status, text);
  }
}

export async function revokeTokenAction(tokenId: string) {
  const token = await getToken();
  const orgId = await resolveOrgId();
  if (!orgId) throw new Error('No organization selected. Run: mastra auth orgs switch');

  await revokeToken(token, orgId, tokenId);

  console.info(`\nToken ${tokenId} revoked.\n`);
}
