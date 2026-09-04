import type { ConnectClientOptions, ConnectionCredential } from './client.js';
import { getCredential, resolveClient } from './client.js';

/**
 * Fetches the raw credential for a connection, for building custom
 * interactions (own SDKs, MCP servers). Never log the result.
 */
export async function credential(
  connectionId: string,
  options?: { client?: ConnectClientOptions },
): Promise<ConnectionCredential> {
  const client = resolveClient(options?.client);
  return getCredential(client, connectionId);
}
