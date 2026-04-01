export { AgentChannels } from './agent-channels';
export type {
  ChannelAdapterConfig,
  ChannelConfig,
  ChannelHandler,
  ChannelHandlerConfig,
  ChannelHandlers,
  ChannelOptions,
  PostableMessage,
} from './agent-channels';
export { ChatChannelProcessor } from './processor';
export { MastraStateAdapter } from './state-adapter';
export type { ChannelContext } from './types';

// Re-export Chat SDK types for convenience
export type { ChatConfig } from 'chat';
