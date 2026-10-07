import { channels } from '@mastra/connect';
import type { ChannelsResolver } from '@mastra/connect';

let channelResolver: Promise<ChannelsResolver> | undefined;

export function getConnectChannels(enabled: boolean) {
  if (!enabled) return undefined;
  return (channelResolver ??= channels());
}
