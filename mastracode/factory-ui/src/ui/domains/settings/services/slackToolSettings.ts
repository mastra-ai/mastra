/** Browser-side helpers for what a Factory's sessions may do in Slack (Settings › Slack). */

export interface SlackToolSettings {
  /** `session`: the channel the session started in. `selected`: plus `channelIds`. `all`: any channel the app is in. */
  channels: 'session' | 'selected' | 'all';
  channelIds: string[];
  /** `read`: other channels are read only. `post`: sessions can post in them too. */
  channelAccess: 'read' | 'post';
  directMessages: 'none' | 'linked' | 'anyone';
}

export interface SlackChannelOption {
  id: string;
  name: string;
  isPrivate: boolean;
  /** Whether the Slack app is in the channel, so sessions can read it. */
  appIsMember: boolean;
}

export interface SlackToolSettingsPayload {
  settings: SlackToolSettings;
  /** Channels the caller is in, plus any already selected. */
  channels: SlackChannelOption[];
  /** Whether the caller has connected their Slack account; without it there's no channel list. */
  linked: boolean;
}

async function parseError(res: Response): Promise<Error> {
  const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
  return new Error(body?.message ?? body?.error ?? `Request failed (${res.status})`);
}

const settingsPath = (baseUrl: string, factoryProjectId: string) =>
  `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/slack-tools`;

export async function getSlackToolSettings(
  baseUrl: string,
  factoryProjectId: string,
): Promise<SlackToolSettingsPayload> {
  const res = await fetch(settingsPath(baseUrl, factoryProjectId), {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as SlackToolSettingsPayload;
}

export async function saveSlackToolSettings(
  baseUrl: string,
  factoryProjectId: string,
  settings: SlackToolSettings,
): Promise<SlackToolSettings> {
  const res = await fetch(settingsPath(baseUrl, factoryProjectId), {
    method: 'PUT',
    headers: { Accept: 'application/json', 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw await parseError(res);
  return ((await res.json()) as { settings: SlackToolSettings }).settings;
}

/** Add the Slack app to a public channel, so sessions can read it. */
export async function joinSlackChannel(baseUrl: string, factoryProjectId: string, channelId: string): Promise<void> {
  const res = await fetch(`${settingsPath(baseUrl, factoryProjectId)}/channels/${encodeURIComponent(channelId)}/join`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw await parseError(res);
}
