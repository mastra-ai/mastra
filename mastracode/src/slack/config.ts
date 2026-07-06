/**
 * Wiring for Slack's remote MCP server (`mcp.slack.com`).
 *
 * The Slack user token is NEVER written to mcp.json. Instead we register the
 * server programmatically via `createMcpManager`'s async `extraServers`
 * resolver, injecting `Authorization: Bearer <token>` at connect/reload time.
 * The token is sourced from `AuthStorage.getApiKey('slack')`, which silently
 * refreshes the PKCE token when it has expired.
 *
 * When Slack is disabled in settings, or no token is stored, the resolver
 * returns an empty map so no MCP entry, tools, or network calls exist.
 */

import type { AuthStorage } from '../auth/storage.js';
import type { McpServerConfig } from '../mcp/types.js';
import type { SlackSettings } from '../onboarding/settings.js';
import { SLACK_AUTH_PROVIDER_ID } from './oauth.js';

/** The config key / display name used for the Slack MCP server entry. */
export const SLACK_MCP_SERVER_NAME = 'slack';

/** Slack's official remote MCP endpoint (Streamable HTTP). */
export const SLACK_MCP_URL = 'https://mcp.slack.com/mcp';

/**
 * Build the programmatic MCP server map for Slack. Returns an empty object
 * (no entry) when the feature is disabled or no valid token is available.
 *
 * This is the async resolver passed to `createMcpManager` so the bearer token
 * is re-fetched (and refreshed if needed) on every init/reload.
 */
export async function buildSlackMcpServers(
  authStorage: AuthStorage,
  slackSettings: SlackSettings | undefined,
): Promise<Record<string, McpServerConfig>> {
  if (!slackSettings?.enabled) return {};

  const token = await authStorage.getApiKey(SLACK_AUTH_PROVIDER_ID);
  if (!token) return {};

  return {
    [SLACK_MCP_SERVER_NAME]: {
      url: SLACK_MCP_URL,
      headers: { Authorization: `Bearer ${token}` },
    },
  };
}

/** Whether a Slack user token is currently stored (regardless of validity). */
export function hasSlackToken(authStorage: AuthStorage): boolean {
  return authStorage.get(SLACK_AUTH_PROVIDER_ID)?.type === 'oauth';
}
