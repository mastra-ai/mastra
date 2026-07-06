/**
 * Public OAuth client_id for the Mastra-published Slack app ("Mastra Code").
 *
 * The app is a PKCE public client, so there is NO client secret — this id is
 * safe to ship in the binary. Restricted orgs can override it with their own
 * BYO app via `SlackSettings.clientId` or `/slack connect --byo <client_id>`.
 *
 * NOTE: Until the Mastra Slack app is published, this is a placeholder. The
 * `SLACK_APP_PUBLISHED` flag gates the one-click flow; when false, users must
 * supply a BYO client_id.
 */

/** The published public client_id, or undefined until the app ships. */
export const MASTRA_SLACK_CLIENT_ID: string | undefined = process.env.MASTRACODE_SLACK_CLIENT_ID || undefined;

/** Whether Mastra's published Slack app is available for one-click connect. */
export const SLACK_APP_PUBLISHED = Boolean(MASTRA_SLACK_CLIENT_ID);

/**
 * Resolve the client_id to use: an explicit BYO id wins, otherwise Mastra's
 * published id. Returns undefined when neither is available (BYO required).
 */
export function resolveSlackClientId(byoClientId?: string): string | undefined {
  const byo = byoClientId?.trim();
  if (byo) return byo;
  return MASTRA_SLACK_CLIENT_ID;
}
