export { MastraChannel } from './base';
export { ChatAdapterChannel } from './chat-adapter/channel';
export { ChatChannelProcessor } from './chat-adapter/processor';
export { InMemoryStateShim } from './chat-adapter/state-shim';
export type { ChatAdapterChannelConfig } from './chat-adapter/types';
export type {
  ChannelCommand,
  ChannelContext,
  ChannelEvent,
  ChannelEventType,
  ChannelMessageContent,
  ChannelSendParams,
  ChannelSendResult,
  ChannelThreadMetadata,
  GetOrCreateThreadParams,
  ProcessWebhookEventParams,
  ProcessWebhookResult,
} from './types';
