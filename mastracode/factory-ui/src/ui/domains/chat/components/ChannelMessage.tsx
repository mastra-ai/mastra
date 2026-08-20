import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Slack } from 'lucide-react';
import { useState } from 'react';

import type { MessageEntry } from '../services/transcript';
import { messageClock } from './MessageMeta';
import { ROW_RAIL, ROW_TRIGGER, TranscriptRow } from './TranscriptRow';

import { parseChannelMessage } from './channel-message';
import type { ChannelContextMessage, MentionNames } from './channel-message';

export type { ChannelContextMessage } from './channel-message';

const CHANNEL_PLATFORM_LABEL: Record<string, string> = {
  slack: 'Slack',
};

/** Author and bot facts `agent-channels` stamps on `providerMetadata.mastra.channels.<platform>`. */
export interface ChannelOrigin {
  platform: string;
  authorName?: string;
  bot?: { userId: string; userName?: string };
}

export function channelOrigin(entry: MessageEntry): ChannelOrigin | undefined {
  const mastra = entry.message.content.providerMetadata?.mastra;
  const channels = isRecord(mastra) ? mastra.channels : undefined;
  if (!isRecord(channels)) return undefined;
  const platform = Object.keys(channels)[0];
  if (!platform) return undefined;
  const info = channels[platform];
  const author = isRecord(info) && isRecord(info.author) ? info.author : undefined;
  const bot = isRecord(info) && isRecord(info.bot) ? info.bot : undefined;
  const authorName =
    typeof author?.fullName === 'string'
      ? author.fullName
      : typeof author?.userName === 'string'
        ? author.userName
        : undefined;
  return {
    platform,
    authorName,
    ...(typeof bot?.userId === 'string'
      ? { bot: { userId: bot.userId, ...(typeof bot.userName === 'string' ? { userName: bot.userName } : {}) } }
      : {}),
  };
}

type MessageParts = MessageEntry['message']['content']['parts'];

/** The thread history lifted out of the text part that carried it, leaving only what was said. */
export function channelMessageView(
  parts: MessageParts,
  origin: ChannelOrigin,
): { platform: string; context: ChannelContextMessage[]; parts: MessageParts } | undefined {
  const index = parts.findIndex(part => part.type === 'text');
  const source = parts[index];
  if (!source || source.type !== 'text') return undefined;

  const { context, body } = parseChannelMessage(source.text, mentionNames(origin));
  const rewritten = parts.map((part, at) => (at === index ? { ...part, text: body } : part));
  return {
    platform: origin.platform,
    context,
    parts: rewritten.filter(part => part.type !== 'text' || part.text.trim().length > 0),
  };
}

/** Names the transcript can put to the platform ids a message mentions. */
function mentionNames(origin: ChannelOrigin): MentionNames {
  const names = new Map<string, string>();
  if (origin.bot?.userName) names.set(origin.bot.userId, origin.bot.userName);
  return names;
}

export function ChannelOriginBadge({ origin }: { origin: ChannelOrigin }) {
  const label = platformLabel(origin.platform);
  return (
    <div className="text-ui-xs text-icon3 mt-1 flex items-center gap-1" aria-label={`Sent from ${label}`}>
      <PlatformIcon platform={origin.platform} />
      <span>
        via {label}
        {origin.authorName ? ` · ${origin.authorName}` : ''}
      </span>
    </div>
  );
}

/** The thread the agent was pulled into, as messages rather than as the block the model reads. */
export function ChannelThreadContext({ platform, messages }: { platform: string; messages: ChannelContextMessage[] }) {
  const [expanded, setExpanded] = useState(false);
  const label = `${messages.length} earlier message${messages.length === 1 ? '' : 's'}`;

  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="max-w-full min-w-0"
      role="group"
      aria-label={`${platformLabel(platform)} thread context`}
    >
      <CollapsibleTrigger className={ROW_TRIGGER}>
        <TranscriptRow icon={<PlatformIcon platform={platform} />} label={label} expanded={expanded} />
      </CollapsibleTrigger>
      <CollapsibleContent className="max-w-full min-w-0">
        <div className={ROW_RAIL}>
          {messages.map(message => (
            <div key={message.id} className="mb-2 last:mb-0">
              <div className="flex items-baseline gap-1.5">
                <Txt as="span" variant="ui-sm" className="text-icon5">
                  {message.author}
                </Txt>
                {message.isBot && (
                  <Txt as="span" variant="ui-xs" className="text-icon3">
                    bot
                  </Txt>
                )}
                {message.at && (
                  <time className="text-ui-xs text-icon3" dateTime={message.at.toISOString()}>
                    {messageClock.format(message.at)}
                  </time>
                )}
              </div>
              <Txt as="p" variant="ui-sm" className="text-icon4 m-0 whitespace-pre-wrap">
                {message.text}
              </Txt>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function platformLabel(platform: string): string {
  return CHANNEL_PLATFORM_LABEL[platform] ?? platform;
}

function PlatformIcon({ platform }: { platform: string }) {
  return platform === 'slack' ? <Slack className="size-3" aria-hidden="true" /> : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
