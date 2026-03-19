import type { Agent } from '../agent/agent';
import { MastraBase } from '../base';
import type { StorageThreadType } from '../memory/types';
import { RequestContext } from '../request-context';
import type { ApiRoute } from '../server/types';

import type {
  ChannelCommand,
  ChannelContext,
  ChannelSendParams,
  ChannelSendResult,
  GetOrCreateThreadParams,
  ProcessWebhookEventParams,
  ProcessWebhookResult,
} from './types';

export abstract class MastraChannel extends MastraBase {
  /** Platform identifier (e.g. 'slack', 'discord'). */
  abstract readonly platform: string;

  /** The agent that owns this channel. Set during Agent construction. */
  #agent?: Agent<any, any, any, any>;

  /** Slash command definitions. */
  protected commands: Record<string, ChannelCommand>;

  constructor({ name, commands }: { name?: string; commands?: Record<string, ChannelCommand> }) {
    super({ component: 'CHANNEL', name });
    this.commands = commands ?? {};
  }

  /**
   * Returns API routes for receiving webhook events from the platform.
   * These routes are auto-registered when the channel's agent is added to Mastra.
   */
  abstract getWebhookRoutes(): ApiRoute[];

  /**
   * Sends a message to the platform.
   */
  abstract send(params: ChannelSendParams): Promise<ChannelSendResult>;

  /**
   * Returns tools that let the agent interact with this channel.
   * Override in subclasses to provide platform-specific tools.
   */
  getTools(): Record<string, unknown> {
    return {};
  }

  /**
   * Sets the owning agent. Called by the Agent constructor.
   * @internal
   */
  __setAgent(agent: Agent<any, any, any, any>): void {
    this.#agent = agent;
  }

  /**
   * Returns the owning agent.
   */
  get agent(): Agent<any, any, any, any> {
    if (!this.#agent) {
      throw new Error(`Channel "${this.platform}" has no owning agent. Channels must be registered on an agent.`);
    }
    return this.#agent;
  }

  /**
   * Resolves the prompt for a slash command, or undefined if no command is registered.
   */
  protected resolveCommand(commandName: string): ChannelCommand | undefined {
    return this.commands[commandName];
  }

  /**
   * Shared webhook processing pipeline: get/create thread → generate → send.
   * Always routes to the owning agent. For slash commands, prepends the command prompt.
   */
  async processWebhookEvent({ event, mastra }: ProcessWebhookEventParams): Promise<ProcessWebhookResult> {
    const agent = this.agent;

    // For slash commands, resolve the command prompt
    let prompt = event.text || '';
    if (event.type === 'slash_command' && event.commandName) {
      const command = this.resolveCommand(event.commandName);
      if (command) {
        // Prepend command prompt, append any user-provided text
        prompt = event.text ? `${command.prompt}\n\n${event.text}` : command.prompt;
      } else {
        this.logger.debug(`No command registered for: ${event.commandName}`);
        return { handled: false };
      }
    }

    const resourceId = `${this.platform}:${event.externalChannelId}:${event.externalThreadId}`;

    const thread = await this.getOrCreateThread({
      externalThreadId: event.externalThreadId,
      channelId: event.externalChannelId,
      resourceId,
      mastra,
    });

    const channelCtx: ChannelContext = {
      platform: this.platform,
      eventType: event.type,
      userId: event.userId,
      userName: event.userName,
    };

    const requestContext = new RequestContext();
    requestContext.set('channel', channelCtx);

    const result = await agent.generate(prompt, {
      requestContext,
      memory: {
        thread,
        resource: `${this.platform}:${event.userId}`,
      },
    });

    let sendResult: ChannelSendResult | undefined;

    if (result.text) {
      sendResult = await this.send({
        channelId: event.externalChannelId,
        threadId: event.externalThreadId,
        content: { text: result.text },
      });
    }

    return {
      handled: true,
      threadId: thread.id,
      responseText: result.text,
      sendResult,
    };
  }

  /**
   * Resolves an existing Mastra thread for the given external IDs, or creates one.
   * Uses `listThreads` with metadata filtering — no schema migration needed.
   */
  async getOrCreateThread({
    externalThreadId,
    channelId,
    resourceId,
    mastra,
  }: GetOrCreateThreadParams): Promise<StorageThreadType> {
    const storage = mastra.getStorage();
    if (!storage) {
      throw new Error('Storage is required for channel thread mapping. Configure storage in your Mastra instance.');
    }

    const memoryStore = await storage.getStore('memory');
    if (!memoryStore) {
      throw new Error(
        'Memory store is required for channel thread mapping. Configure storage in your Mastra instance.',
      );
    }

    const metadata = {
      channel_platform: this.platform,
      channel_externalThreadId: externalThreadId,
      channel_externalChannelId: channelId,
    };

    const { threads } = await memoryStore.listThreads({
      filter: { metadata },
      perPage: 1,
    });

    if (threads.length > 0) {
      return threads[0]!;
    }

    return memoryStore.saveThread({
      thread: {
        id: crypto.randomUUID(),
        title: `${this.platform} conversation`,
        resourceId,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata,
      },
    });
  }
}
