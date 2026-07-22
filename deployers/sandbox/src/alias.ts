import type { SandboxAliasOptions } from './types';

/**
 * Upsert a Vercel Edge Config item so a stable key always points at the
 * current sandbox URL. Used for Tier 3 routing: apps read the key from Edge
 * Config (e.g. in middleware) instead of hardcoding the rotating sandbox URL.
 */
export async function updateEdgeConfigAlias(options: SandboxAliasOptions & { url: string }): Promise<void> {
  const { token, teamId } = options;
  if (!token) {
    throw new Error('Updating the Edge Config alias requires a Vercel API token. Pass `alias.token`.');
  }

  const endpoint = new URL(`https://api.vercel.com/v1/edge-config/${options.edgeConfigId}/items`);
  if (teamId) {
    endpoint.searchParams.set('teamId', teamId);
  }

  const res = await fetch(endpoint, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: [{ operation: 'upsert', key: options.key, value: options.url }],
    }),
    // Bounded so a hung Vercel API request can't keep `mastra build` open
    // after the sandbox itself is already deployed.
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to update Edge Config alias "${options.key}" (${res.status}): ${body}`);
  }
}
