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
}

export async function createToken(token: string, orgId: string, name: string): Promise<{ id: string; secret: string }> {
  const resp = await platformFetch(`${MASTRA_PLATFORM_API_URL}/v1/auth/tokens`, {
    method: 'POST',
    headers: {
      ...authHeaders(token, orgId),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throwApiError('Failed to create token', resp.status, text);
  }

  const data = (await resp.json()) as { token: TokenInfo; secret: string };
  return { id: data.token.id, secret: data.secret };
}

export async function createTokenAction(name: string) {
  const token = await getToken();
  const orgId = await resolveOrgId();
  if (!orgId) throw new Error('No organization selected. Run: mastra auth orgs switch');

  const result = await createToken(token, orgId, name);

  console.info('\nToken created successfully!\n');
  console.info(`  Name:    ${name}`);
  console.info(`  ID:      ${result.id}`);
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
  }
  console.info('');
}

export async function revokeTokenAction(tokenId: string) {
  const token = await getToken();
  const orgId = await resolveOrgId();
  if (!orgId) throw new Error('No organization selected. Run: mastra auth orgs switch');

  const resp = await platformFetch(`${MASTRA_PLATFORM_API_URL}/v1/auth/tokens/${encodeURIComponent(tokenId)}`, {
    method: 'DELETE',
    headers: authHeaders(token, orgId),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throwApiError('Failed to revoke token', resp.status, text);
  }

  console.info(`\nToken ${tokenId} revoked.\n`);
}
