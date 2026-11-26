import type { ButtonElement, CardElement, Logger, Thread } from 'chat';
import { describe, expectTypeOf, it } from 'vitest';
import type { RequestContext } from '../request-context';
import type {
  ChannelHandlers,
  ChannelRun,
  ChannelSuspendPayload,
  getChannelRun,
  SlashCommandChannelHandler,
  SlashCommandChannelHandlerConfig,
  SlashCommandEvent,
  toChatLogger,
  toolResumeButton,
  TOOL_RESUME_ACTION_PREFIX,
} from './index';

describe('channels public type exports', () => {
  it('exports slash-command handler types matching ChannelHandlers.onSlashCommand', () => {
    expectTypeOf<SlashCommandChannelHandlerConfig>().toEqualTypeOf<ChannelHandlers['onSlashCommand']>();
    expectTypeOf<Parameters<SlashCommandChannelHandler>[0]>().toEqualTypeOf<SlashCommandEvent>();
  });

  it('exports toChatLogger returning the Chat SDK Logger', () => {
    expectTypeOf<ReturnType<typeof toChatLogger>>().toEqualTypeOf<Logger>();
  });

  it('exports the paused-tool card API', () => {
    expectTypeOf<ChannelSuspendPayload['channelCard']>().toEqualTypeOf<CardElement | undefined>();
    expectTypeOf<ReturnType<typeof toolResumeButton>>().toEqualTypeOf<ButtonElement>();
    expectTypeOf<typeof TOOL_RESUME_ACTION_PREFIX>().toEqualTypeOf<'tool_resume:'>();
    expectTypeOf<Parameters<typeof getChannelRun>[0]>().toEqualTypeOf<RequestContext | undefined>();
    expectTypeOf<ReturnType<typeof getChannelRun>>().toEqualTypeOf<ChannelRun | undefined>();
    expectTypeOf<ChannelRun['thread']>().toEqualTypeOf<Thread>();
    expectTypeOf<ChannelRun['actorResourceId']>().toEqualTypeOf<string | undefined>();
  });
});
