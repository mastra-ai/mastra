import { MastraBase } from '../base';
import type { StorageThreadType } from '../memory/types';
import type { ApiRoute } from '../server/types';

import type {
  ChannelEvent,
  ChannelRouteConfig,
  ChannelSendParams,
  ChannelSendResult,
  GetOrCreateThreadParams,
} from './types';

export abstract class MastraChannel extends MastraBase {
  /** Platform identifier (e.g. 'slack', 'discord'). */
  abstract readonly platform: string;

  /** Route configuration mapping agent names to event types. */
  protected routes: ChannelRouteConfig;

  constructor({ name, routes }: { name?: string; routes: ChannelRouteConfig }) {
    super({ component: 'CHANNEL', name });
    this.routes = routes;
  }

  /**
   * Returns API routes for receiving webhook events from the platform.
   * These routes should be registered via `server.apiRoutes` in the Mastra config.
   */
  abstract getWebhookRoutes(): ApiRoute[];

  /**
   * Verifies that an incoming webhook request is authentic.
   * Each platform has its own verification mechanism (e.g. Slack signing secret).
   */
  abstract verifyWebhook(request: Request): Promise<boolean>;

  /**
   * Parses a verified webhook request into a normalized ChannelEvent.
   */
  abstract parseWebhookEvent(request: Request): Promise<ChannelEvent>;

  /**
   * Sends a message to the platform.
   */
  abstract send(params: ChannelSendParams): Promise<ChannelSendResult>;

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
      'channel.platform': this.platform,
      'channel.externalThreadId': externalThreadId,
      'channel.externalChannelId': channelId,
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
        resourceId,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata,
      },
    });
  }

  /**
   * Finds the agent name configured to handle the given event type.
   * Returns undefined if no agent is configured for this event type.
   */
  protected resolveAgentForEvent(eventType: string): string | undefined {
    for (const [agentName, config] of Object.entries(this.routes)) {
      if (config.events.includes(eventType as any)) {
        return agentName;
      }
    }
    return undefined;
  }
}
