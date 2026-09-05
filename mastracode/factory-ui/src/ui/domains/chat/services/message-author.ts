import type { MastraDBMessage } from '@mastra/core/agent-controller';

import { isRecord } from '../../../../lib/isRecord';

export interface MessageAuthor {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface ChannelOrigin {
  platform: string;
  authorName?: string;
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === 'string');
}

/** Wherever this copy of a user signal keeps its provider options: persisted message, signal envelope, live data part. */
function mastraOptions(message: MastraDBMessage): Record<string, unknown> | undefined {
  const signal = message.content.metadata?.signal;
  const dataPart: unknown = message.content.parts.find(part => part.type === 'data-user-message');
  const candidates = [
    message.content.providerMetadata,
    isRecord(signal) ? signal.providerOptions : undefined,
    isRecord(dataPart) && isRecord(dataPart.data) ? dataPart.data.providerOptions : undefined,
  ];
  for (const candidate of candidates) {
    if (isRecord(candidate) && isRecord(candidate.mastra)) return candidate.mastra;
  }
  return undefined;
}

function channelStamp(mastra: Record<string, unknown>) {
  const channels = mastra.channels;
  if (!isRecord(channels)) return undefined;
  const platform = Object.keys(channels)[0];
  if (!platform) return undefined;
  const info = channels[platform];
  const author = isRecord(info) && isRecord(info.author) ? info.author : undefined;
  return {
    platform,
    userId: firstString(author?.userId),
    name: firstString(author?.fullName, author?.userName),
  };
}

/** Channel provenance `agent-channels` stamps on a message that arrived from Slack and friends. */
export function channelOrigin(message: MastraDBMessage): ChannelOrigin | undefined {
  const mastra = mastraOptions(message);
  const channel = mastra && channelStamp(mastra);
  return channel && { platform: channel.platform, authorName: channel.name };
}

/** Who sent a user message: the person the server stamped, else the channel account it came from. */
export function messageAuthor(message: MastraDBMessage): MessageAuthor | undefined {
  const mastra = mastraOptions(message);
  if (!mastra) return undefined;
  const stamped = mastra.author;
  if (isRecord(stamped) && typeof stamped.id === 'string') {
    return {
      id: stamped.id,
      name: firstString(stamped.name) ?? stamped.id,
      ...(typeof stamped.avatarUrl === 'string' ? { avatarUrl: stamped.avatarUrl } : {}),
    };
  }
  const channel = channelStamp(mastra);
  if (!channel?.userId) return undefined;
  return { id: `${channel.platform}:${channel.userId}`, name: channel.name ?? channel.userId };
}

/** True when nothing the viewer typed can be the echo of this signal: it came in from a channel, or someone else sent it. */
export function sentByOther(message: MastraDBMessage, viewerId: string | undefined): boolean {
  if (channelOrigin(message)) return true;
  const author = messageAuthor(message);
  return author !== undefined && author.id !== viewerId;
}
