/**
 * Browser-side helpers for the caller's linked channel accounts (Settings ›
 * General › Connected accounts). A link binds a platform sender identity
 * (e.g. a Slack user in a workspace) to the signed-in Mastra user so channel
 * runs resolve their model credentials.
 */

export interface ConnectedChannelAccount {
  platform: string;
  externalTeamId: string;
  externalUserId: string;
  linkedAt: string;
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

export interface ChannelAccountsPayload {
  accounts: ConnectedChannelAccount[];
  /** Whether the server has the "Sign in with Slack" (OIDC) connect flow configured. */
  canConnect: boolean;
}

/** List the caller's own linked channel accounts. */
export async function listChannelAccounts(baseUrl: string): Promise<ChannelAccountsPayload> {
  const res = await fetch(`${baseUrl}/web/channel-accounts`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw await parseError(res);
  const { accounts, canConnect } = (await res.json()) as {
    accounts: ConnectedChannelAccount[];
    canConnect?: boolean;
  };
  return { accounts, canConnect: canConnect === true };
}

/**
 * The "Sign in with Slack" entry point. A full-page navigation (not fetch):
 * the route replies with a redirect chain out to Slack's consent screen.
 */
export function connectSlackUrl(baseUrl: string): string {
  return `${baseUrl}/connect/slack/oidc/start`;
}

/** Sever one of the caller's own links, addressed by its platform sender key. */
export async function disconnectChannelAccount(
  baseUrl: string,
  key: Pick<ConnectedChannelAccount, 'platform' | 'externalTeamId' | 'externalUserId'>,
): Promise<boolean> {
  const res = await fetch(`${baseUrl}/web/channel-accounts`, {
    method: 'DELETE',
    headers: { Accept: 'application/json', 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(key),
  });
  if (!res.ok) throw await parseError(res);
  const { deleted } = (await res.json()) as { deleted: boolean };
  return deleted;
}
