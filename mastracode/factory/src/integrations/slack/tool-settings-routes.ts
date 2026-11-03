import { registerApiRoute } from '@mastra/core/server';
import type { ApiRoute } from '@mastra/core/server';
import type { SlackAdapter } from '@mastra/slack';
import type { Chat } from 'chat';

import type { RouteAuth } from '../../routes/route.js';
import type { ChannelIdentityStorage } from '../../storage/domains/channel-identity/base.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import { readSlackToolSettings, slackToolSettingsSchema } from './tool-settings.js';
import type { SlackToolSettings } from './tool-settings.js';

/** A channel the Settings page can offer, from the app's point of view. */
export interface SlackChannelOption {
  id: string;
  name: string;
  isPrivate: boolean;
  /** Whether the app is in the channel, so sessions can actually read it. */
  appIsMember: boolean;
}

export interface SlackToolSettingsPayload {
  settings: SlackToolSettings;
  /**
   * Channels the caller is in (from their linked Slack account) plus any
   * already selected. Empty with `linked: false` when the caller hasn't
   * connected Slack.
   */
  channels: SlackChannelOption[];
  linked: boolean;
}

type SlackClient = SlackAdapter['webClient'];

/** Pages read when listing channels, so one request can't walk a huge workspace. */
const MAX_CHANNEL_PAGES = 10;
const CHANNEL_ID = /^[CG][A-Z0-9]+$/;

/**
 * Run `fn` with a client for `teamId`'s installation. Multi-workspace apps keep
 * a bot token per workspace and bind none outside Slack's own requests, so a
 * Settings page request has to bind it; a single-workspace app has one already.
 */
async function withTeamClient<T>(adapter: SlackAdapter, teamId: string, fn: (client: SlackClient) => Promise<T>) {
  const installation = await adapter.getInstallation(teamId).catch(() => null);
  if (installation?.botToken) return adapter.withBotToken(installation.botToken, () => fn(adapter.webClient));
  return fn(adapter.webClient);
}

function slackErrorCode(error: unknown): string | undefined {
  return (error as { data?: { error?: string } })?.data?.error;
}

/**
 * Settings › Slack routes for what a Factory's sessions may do in Slack, the
 * channels to choose from, and adding the app to a public channel.
 */
export function createSlackToolSettingsRoutes(deps: {
  auth: RouteAuth;
  projects: FactoryProjectsStorage;
  accountLinks: ChannelIdentityStorage;
  chat: () => Chat | null | undefined;
  /** The deployment's settings, used for anything a Factory hasn't saved. */
  defaults?: SlackToolSettings;
}): ApiRoute[] {
  const { auth, projects, accountLinks, chat, defaults } = deps;
  type RouteAuthContext = Parameters<RouteAuth['ensureUser']>[0];
  const loose = (c: unknown): RouteAuthContext => c as RouteAuthContext;

  /** The caller's Factory, or an error response. Any member of the Factory's org may manage it. */
  async function factoryFor(raw: unknown) {
    const c = loose(raw);
    await auth.ensureUser(c);
    const tenant = auth.tenant(c);
    if (!tenant) return { response: c.json({ error: 'unauthorized' }, 401) };
    if (!tenant.orgId) return { response: c.json({ error: 'organization_required' }, 403) };
    const factory = await projects.get({ orgId: tenant.orgId, id: c.req.param('id') ?? '' });
    if (!factory) return { response: c.json({ error: 'Factory not found' }, 404) };
    return { tenant: { orgId: tenant.orgId, userId: tenant.userId }, factory };
  }

  /** The caller's Slack account in the workspace the app is installed in, with a client for it. */
  async function slackFor(userId: string) {
    const adapter = chat()?.getAdapter('slack') as SlackAdapter | undefined;
    if (!adapter) return null;
    const links = (await accountLinks.listAccountLinksForUser(userId)).filter(link => link.platform === 'slack');
    for (const link of links) {
      const installed = await withTeamClient(adapter, link.externalTeamId, async client => {
        const result = await client.auth.test().catch(() => null);
        return result?.team_id === link.externalTeamId;
      }).catch(() => false);
      if (installed) {
        return {
          slackUserId: link.externalUserId,
          use: <T>(fn: (client: SlackClient) => Promise<T>) => withTeamClient(adapter, link.externalTeamId, fn),
        };
      }
    }
    return null;
  }

  return [
    registerApiRoute('/web/factory/projects/:id/slack-tools', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const found = await factoryFor(c);
        if ('response' in found) return found.response;
        const settings = readSlackToolSettings(found.factory.slackToolSettings, defaults);
        const slack = await slackFor(found.tenant.userId);
        if (!slack) return c.json({ settings, channels: [], linked: false } satisfies SlackToolSettingsPayload);

        const channels = await slack.use(async client => {
          const mine: SlackChannelOption[] = [];
          let cursor: string | undefined;
          for (let page = 0; page < MAX_CHANNEL_PAGES; page++) {
            const result = await client.users.conversations({
              user: slack.slackUserId,
              types: 'public_channel,private_channel',
              exclude_archived: true,
              limit: 1000,
              cursor,
            });
            for (const channel of result.channels ?? []) {
              if (!channel.id) continue;
              mine.push({
                id: channel.id,
                name: channel.name ?? channel.id,
                isPrivate: Boolean(channel.is_private),
                // users.conversations reports membership for the user asked about,
                // not the app; a private channel only shows up when the app is in it.
                appIsMember: Boolean(channel.is_private),
              });
            }
            cursor = result.response_metadata?.next_cursor || undefined;
            if (!cursor) break;
          }
          // Whether the app is in each public channel: the app's own membership list.
          const appChannels = new Set<string>();
          cursor = undefined;
          for (let page = 0; page < MAX_CHANNEL_PAGES; page++) {
            const result = await client.users.conversations({
              types: 'public_channel',
              exclude_archived: true,
              limit: 1000,
              cursor,
            });
            for (const channel of result.channels ?? []) if (channel.id) appChannels.add(channel.id);
            cursor = result.response_metadata?.next_cursor || undefined;
            if (!cursor) break;
          }
          for (const channel of mine) if (!channel.isPrivate) channel.appIsMember = appChannels.has(channel.id);

          // Keep channels someone else selected listed, so saving doesn't drop them.
          const listed = new Set(mine.map(channel => channel.id));
          for (const id of settings.channelIds.filter(id => !listed.has(id))) {
            const info = await client.conversations.info({ channel: id }).catch(() => null);
            mine.push({
              id,
              name: info?.channel?.name ?? id,
              isPrivate: Boolean(info?.channel?.is_private),
              appIsMember: Boolean(info?.channel?.is_member),
            });
          }
          return mine.sort((a, b) => a.name.localeCompare(b.name));
        });
        return c.json({ settings, channels, linked: true } satisfies SlackToolSettingsPayload);
      },
    }),
    registerApiRoute('/web/factory/projects/:id/slack-tools', {
      method: 'PUT',
      requiresAuth: false,
      handler: async c => {
        const found = await factoryFor(c);
        if ('response' in found) return found.response;
        const parsed = slackToolSettingsSchema.safeParse(await c.req.json().catch(() => null));
        if (!parsed.success) return c.json({ error: 'invalid_settings' }, 400);
        const settings: SlackToolSettings = {
          ...parsed.data,
          channelIds: [...new Set(parsed.data.channelIds)],
        };
        const saved = await projects.update({
          orgId: found.tenant.orgId,
          id: found.factory.id,
          input: { slackToolSettings: settings },
        });
        if (!saved) return c.json({ error: 'Factory not found' }, 404);
        return c.json({ settings: readSlackToolSettings(saved.slackToolSettings, defaults) });
      },
    }),
    // Adds the app to a public channel so sessions can read it. Slack doesn't
    // let an app add itself to a private channel; someone in it has to invite it.
    registerApiRoute('/web/factory/projects/:id/slack-tools/channels/:channelId/join', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const found = await factoryFor(c);
        if ('response' in found) return found.response;
        const channelId = c.req.param('channelId') ?? '';
        if (!CHANNEL_ID.test(channelId)) return c.json({ error: 'invalid_channel' }, 400);
        const slack = await slackFor(found.tenant.userId);
        if (!slack) return c.json({ error: 'slack_not_linked', message: 'Connect your Slack account first.' }, 409);
        try {
          await slack.use(client => client.conversations.join({ channel: channelId }));
          return c.json({ joined: true });
        } catch (error) {
          const code = slackErrorCode(error);
          if (code === 'missing_scope') {
            return c.json(
              {
                error: code,
                message: 'The Slack app needs the channels:join permission. Reinstall the app to add it.',
              },
              409,
            );
          }
          if (code === 'method_not_supported_for_channel_type' || code === 'channel_not_found') {
            return c.json(
              { error: code, message: 'Private channels need an invite: run /invite with the app in that channel.' },
              409,
            );
          }
          if (code === 'is_archived') return c.json({ error: code, message: 'That channel is archived.' }, 409);
          throw error;
        }
      },
    }),
  ];
}
