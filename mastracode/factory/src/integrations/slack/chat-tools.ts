import { createChannelTools, createChannelToolScope, resolveChannelToolsSettings } from '@mastra/core/channels';
import { createSlackTools } from '@mastra/slack';
import type { Adapter, Chat } from 'chat';

import type { IntegrationTools } from '../base.js';
import type { SlackToolSettings } from './tool-settings.js';

/**
 * The shared channel tools for one session: the Chat SDK's read and post
 * tools from core plus the Slack-only lookups, search and attachment tool
 * from `@mastra/slack`, confined to the channels `settings` grant. They act
 * as the app, so a session never reaches a channel the app isn't in, and
 * posting needs no approval.
 */
export async function createSlackChatTools({
  chat,
  sessionThreadId,
  settings,
}: {
  chat: Chat;
  /** The session's own chat thread id, e.g. `slack:C123:1700000000.000100`. */
  sessionThreadId: string;
  settings: SlackToolSettings;
}): Promise<IntegrationTools> {
  const scope = createChannelToolScope({
    chat,
    adapter: chat.getAdapter('slack') as Adapter,
    platform: 'slack',
    threadId: sessionThreadId,
    settings: resolveChannelToolsSettings({
      channels: settings.channels,
      channelIds: settings.channelIds.map(id => `slack:${id}`),
      access: settings.channelAccess,
      directMessages: settings.directMessages,
    }),
  });
  return { ...(await createChannelTools({ scope })), ...createSlackTools({ scope }) } as IntegrationTools;
}
