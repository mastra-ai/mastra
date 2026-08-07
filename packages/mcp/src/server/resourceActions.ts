import type { IMastraLogger } from '@mastra/core/logger';
import type { Server } from '@modelcontextprotocol/server';
import { broadcastNotification } from './notificationBroadcast';

interface ServerResourceActionsDependencies {
  getSubscribedServers: (uri: string) => Server[];
  getLogger: () => IMastraLogger;
  getSdkServers: () => Server[];
}

/**
 * Server-side resource actions for notifying clients about resource changes.
 *
 * This class provides methods for MCP servers to notify connected clients when
 * resources are updated or when the resource list changes.
 *
 * Notifications are broadcast to every active server instance (the main
 * stdio/SSE instance plus each streamable HTTP session). Clients connected in
 * stateless/serverless mode cannot receive notifications because each request
 * uses a transient server instance.
 */
export class ServerResourceActions {
  private readonly getSubscribedServers: (uri: string) => Server[];
  private readonly getLogger: () => IMastraLogger;
  private readonly getSdkServers: () => Server[];

  /**
   * @internal
   */
  constructor(dependencies: ServerResourceActionsDependencies) {
    this.getSubscribedServers = dependencies.getSubscribedServers;
    this.getLogger = dependencies.getLogger;
    this.getSdkServers = dependencies.getSdkServers;
  }

  /**
   * Notifies subscribed clients that a specific resource has been updated.
   *
   * Only clients that subscribed to the resource URI (via `resources/subscribe`)
   * receive a `notifications/resources/updated` message prompting them to
   * re-fetch the resource content.
   *
   * @param params - Notification parameters
   * @param params.uri - URI of the resource that was updated
   * @throws {MastraError} If sending the notification fails on all subscribed server instances
   *
   * @example
   * ```typescript
   * // After updating a file resource
   * await server.resources.notifyUpdated({ uri: 'file://data.txt' });
   * ```
   */
  public async notifyUpdated({ uri }: { uri: string }): Promise<void> {
    const subscribedServers = this.getSubscribedServers(uri);
    if (subscribedServers.length === 0) {
      this.getLogger().debug(`Resource ${uri} was updated, but no active subscriptions for it.`);
      return;
    }
    this.getLogger().info(`Sending notifications/resources/updated for externally notified resource: ${uri}`);
    await broadcastNotification({
      servers: subscribedServers,
      send: server => server.sendResourceUpdated({ uri }),
      logger: this.getLogger(),
      errorId: 'MCP_SERVER_RESOURCE_UPDATED_NOTIFICATION_FAILED',
      errorText: 'Failed to send resource updated notification',
      errorDetails: { uri },
    });
  }

  /**
   * Notifies clients that the overall list of available resources has changed.
   *
   * This sends a `notifications/resources/list_changed` message to all clients, prompting
   * them to re-fetch the resource list. Resource lists and templates are always evaluated
   * per request, so there is no server-side cache to clear.
   *
   * @throws {MastraError} If sending the notification fails on all server instances
   *
   * @example
   * ```typescript
   * // After adding a new resource to your resource handler
   * await server.resources.notifyListChanged();
   * ```
   */
  public async notifyListChanged(): Promise<void> {
    this.getLogger().info('Resource list change externally notified. Sending notification.');
    await broadcastNotification({
      servers: this.getSdkServers(),
      send: server => server.sendResourceListChanged(),
      logger: this.getLogger(),
      errorId: 'MCP_SERVER_RESOURCE_LIST_CHANGED_NOTIFICATION_FAILED',
      errorText: 'Failed to send resource list changed notification',
    });
  }
}
