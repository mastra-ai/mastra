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

/** List the caller's own linked channel accounts. */
export async function listChannelAccounts(baseUrl: string): Promise<ConnectedChannelAccount[]> {
  const res = await fetch(`${baseUrl}/web/channel-accounts`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw await parseError(res);
  const { accounts } = (await res.json()) as { accounts: ConnectedChannelAccount[] };
  return accounts;
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
