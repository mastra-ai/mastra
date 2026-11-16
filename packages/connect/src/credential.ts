import type { ConnectClientOptions, ConnectionCredential } from './client.js';
import { getCredential, resolveClient } from './client.js';

/**
 * Fetches the raw credential for a connection, for building custom
 * interactions (own SDKs, MCP servers). Never log the result.
 *
 * Pass `resourceId` when the connection is scoped to an end user: the call
 * then asserts `x-mastra-resource-id`, which the platform requires for
 * resource-scoped connections (mismatch or omission → not found).
 */
export async function credential(
  connectionId: string,
  options?: { client?: ConnectClientOptions; resourceId?: string },
): Promise<ConnectionCredential> {
  const client = resolveClient(
    options?.resourceId !== undefined ? { ...options?.client, resourceId: options.resourceId } : options?.client,
  );
  return getCredential(client, connectionId);
}
