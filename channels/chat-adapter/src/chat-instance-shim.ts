import type { ChannelEvent, ChannelEventType } from '@mastra/core/channels';
import type { Mastra } from '@mastra/core/mastra';

import type {
  ActionEvent,
  Adapter,
  AppHomeOpenedEvent,
  AssistantContextChangedEvent,
  AssistantThreadStartedEvent,
  ChatInstance,
  Logger,
  MemberJoinedChannelEvent,
  Message,
  ModalCloseEvent,
  ModalResponse,
  ModalSubmitEvent,
  ReactionEvent,
  SlashCommandEvent,
  StateAdapter,
  WebhookOptions,
} from 'chat';

import type { ChatAdapterChannel } from './channel';

/**
 * A ChatInstance shim that adapts Chat SDK adapter callbacks into Mastra's
 * channel event pipeline.
 *
 * When a Chat SDK adapter calls `processMessage()`, this shim:
 * 1. Converts the Chat SDK `Message` into a Mastra `ChannelEvent`
 * 2. Calls `ChatAdapterChannel.processWebhookEvent()` to run the
 *    agent pipeline (resolve agent → get/create thread → generate → send)
 */
export class MastraChatInstance implements ChatInstance {
  private state: StateAdapter;
  private userName: string;
  private channel: ChatAdapterChannel;
  private mastra: Mastra;

  constructor(opts: {
    state: StateAdapter;
    userName: string;
    channel: ChatAdapterChannel;
    mastra: Mastra;
  }) {
    this.state = opts.state;
    this.userName = opts.userName;
    this.channel = opts.channel;
    this.mastra = opts.mastra;
  }

  getLogger(prefix?: string): Logger {
    // Return a Logger-compatible wrapper around Mastra's logger
    const base = this.channel.channelLogger;
    const tag = prefix ? `[${prefix}]` : '';
    return {
      debug: (msg: string, ...args: unknown[]) => base.debug(`${tag} ${msg}`, ...args),
      info: (msg: string, ...args: unknown[]) => base.info(`${tag} ${msg}`, ...args),
      warn: (msg: string, ...args: unknown[]) => base.warn(`${tag} ${msg}`, ...args),
      error: (msg: string, ...args: unknown[]) => base.error(`${tag} ${msg}`, ...args),
      child: (childPrefix: string) => this.getLogger(prefix ? `${prefix}:${childPrefix}` : childPrefix),
    };
  }

  getState(): StateAdapter {
    return this.state;
  }

  getUserName(): string {
    return this.userName;
  }

  /**
   * Core bridge: Chat SDK adapter calls this when a message arrives.
   * We convert it to a Mastra ChannelEvent and run the pipeline.
   */
  processMessage(
    adapter: Adapter,
    threadId: string,
    message: Message | (() => Promise<Message>),
    _options?: WebhookOptions,
  ): void {
    const run = async () => {
      const msg = typeof message === 'function' ? await message() : message;

      const event: ChannelEvent = {
        type: 'message' as ChannelEventType,
        platform: this.channel.platform,
        externalThreadId: threadId,
        externalChannelId: adapter.channelIdFromThreadId(threadId),
        userId: msg.author.userId,
        userName: msg.author.fullName || msg.author.userName,
        text: msg.text,
        rawEvent: msg,
      };

      await this.channel.processWebhookEvent({ event, mastra: this.mastra });
    };

    run().catch(err => {
      this.channel.channelLogger.error('Error processing message from Chat SDK adapter', err);
    });
  }

  processReaction(
    event: Omit<ReactionEvent, 'adapter' | 'thread'> & { adapter?: Adapter },
    _options?: WebhookOptions,
  ): void {
    const run = async () => {
      const channelEvent: ChannelEvent = {
        type: 'reaction' as ChannelEventType,
        platform: this.channel.platform,
        externalThreadId: event.threadId,
        externalChannelId: event.adapter?.channelIdFromThreadId(event.threadId) ?? event.threadId,
        userId: event.user.userId,
        userName: event.user.fullName || event.user.userName,
        text: String(event.emoji),
        rawEvent: event,
      };

      await this.channel.processWebhookEvent({ event: channelEvent, mastra: this.mastra });
    };

    run().catch(err => {
      this.channel.channelLogger.error('Error processing reaction from Chat SDK adapter', err);
    });
  }

  processSlashCommand(
    event: Omit<SlashCommandEvent, 'channel' | 'openModal'> & {
      adapter: Adapter;
      channelId: string;
    },
    _options?: WebhookOptions,
  ): void {
    const run = async () => {
      const channelEvent: ChannelEvent = {
        type: 'slash_command' as ChannelEventType,
        platform: this.channel.platform,
        externalThreadId: event.channelId,
        externalChannelId: event.channelId,
        userId: event.user.userId,
        userName: event.user.fullName || event.user.userName,
        text: `${event.command} ${event.text ?? ''}`.trim(),
        rawEvent: event,
      };

      await this.channel.processWebhookEvent({ event: channelEvent, mastra: this.mastra });
    };

    run().catch(err => {
      this.channel.channelLogger.error('Error processing slash command from Chat SDK adapter', err);
    });
  }

  processAction(
    event: Omit<ActionEvent, 'thread' | 'openModal'> & { adapter: Adapter },
    _options?: WebhookOptions,
  ): void {
    // Actions (button clicks) don't have a direct Mastra event type yet.
    // Log and no-op for now.
    this.channel.channelLogger.debug('Chat SDK action event received (not yet mapped to Mastra)', {
      actionId: event.actionId,
    });
  }

  processAppHomeOpened(_event: AppHomeOpenedEvent, _options?: WebhookOptions): void {
    this.channel.channelLogger.debug('Chat SDK app_home_opened event received (not yet mapped to Mastra)');
  }

  processAssistantContextChanged(_event: AssistantContextChangedEvent, _options?: WebhookOptions): void {
    this.channel.channelLogger.debug('Chat SDK assistant_context_changed event received (not yet mapped to Mastra)');
  }

  processAssistantThreadStarted(_event: AssistantThreadStartedEvent, _options?: WebhookOptions): void {
    this.channel.channelLogger.debug('Chat SDK assistant_thread_started event received (not yet mapped to Mastra)');
  }

  processMemberJoinedChannel(_event: MemberJoinedChannelEvent, _options?: WebhookOptions): void {
    this.channel.channelLogger.debug('Chat SDK member_joined_channel event received (not yet mapped to Mastra)');
  }

  async handleIncomingMessage(adapter: Adapter, threadId: string, message: Message): Promise<void> {
    // Deprecated method — delegates to processMessage
    this.processMessage(adapter, threadId, message);
  }

  processModalClose(
    _event: Omit<ModalCloseEvent, 'relatedThread' | 'relatedMessage' | 'relatedChannel'>,
    _contextId?: string,
    _options?: WebhookOptions,
  ): void {
    this.channel.channelLogger.debug('Chat SDK modal_close event received (not yet mapped to Mastra)');
  }

  async processModalSubmit(
    _event: Omit<ModalSubmitEvent, 'relatedThread' | 'relatedMessage' | 'relatedChannel'>,
    _contextId?: string,
    _options?: WebhookOptions,
  ): Promise<ModalResponse | undefined> {
    this.channel.channelLogger.debug('Chat SDK modal_submit event received (not yet mapped to Mastra)');
    return undefined;
  }
}
