import type { Logger } from 'chat';
import { describe, expectTypeOf, it } from 'vitest';
import type {
  ChannelHandlers,
  SlashCommandChannelHandler,
  SlashCommandChannelHandlerConfig,
  SlashCommandEvent,
  toChatLogger,
} from './index';

describe('channels public type exports', () => {
  it('exports slash-command handler types matching ChannelHandlers.onSlashCommand', () => {
    expectTypeOf<SlashCommandChannelHandlerConfig>().toEqualTypeOf<ChannelHandlers['onSlashCommand']>();
    expectTypeOf<Parameters<SlashCommandChannelHandler>[0]>().toEqualTypeOf<SlashCommandEvent>();
  });

  it('exports toChatLogger returning the Chat SDK Logger', () => {
    expectTypeOf<ReturnType<typeof toChatLogger>>().toEqualTypeOf<Logger>();
  });
});
