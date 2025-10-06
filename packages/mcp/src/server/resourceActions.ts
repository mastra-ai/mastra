import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { IMastraLogger } from '@mastra/core/logger';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

interface ServerResourceActionsDependencies {
  getSubscriptions: () => Set<string>;
  getLogger: () => IMastraLogger;
  getSdkServer: () => Server;
  clearDefinedResources: () => void;
  clearDefinedResourceTemplates: () => void;
}

/**
 * Server-side resource actions for notifying clients about resource changes.
 *
 * This class provides methods for MCP servers to notify connected clients when
 * resources are updated or when the resource list changes.
 */
export class ServerResourceActions {
  private readonly getSubscriptions: () => Set<string>;
  private readonly getLogger: () => IMastraLogger;
  private readonly getSdkServer: () => Server;
  private readonly clearDefinedResources: () => void;
  private readonly clearDefinedResourceTemplates: () => void;

  /**
   * @internal
   */
  constructor(dependencies: ServerResourceActionsDependencies) {
    this.getSubscriptions = dependencies.getSubscriptions;
    this.getLogger = dependencies.getLogger;
    this.getSdkServer = dependencies.getSdkServer;
    this.clearDefinedResources = dependencies.clearDefinedResources;
    this.clearDefinedResourceTemplates = dependencies.clearDefinedResourceTemplates;
  }

  /**
   * Notifies subscribed clients that a specific resource has been updated.
   *
   * If clients are subscribed to the resource URI, they will receive a
   * `notifications/resources/updated` message to re-fetch the resource content.
   *
   * @param params - Notification parameters
   * @param params.uri - URI of the resource that was updated
   * @throws {MastraError} If sending the notification fails
   *
   * @example
   * ```typescript
   * // After updating a file resource
   * await server.resources.notifyUpdated({ uri: 'file://data.txt' });
   * ```
   */
  public async notifyUpdated({ uri }: { uri: string }): Promise<void> {
    if (this.getSubscriptions().has(uri)) {
      this.getLogger().info(`Sending notifications/resources/updated for externally notified resource: ${uri}`);
      try {
        await this.getSdkServer().sendResourceUpdated({ uri });
      } catch (error) {
        const mastraError = new MastraError(
          {
            id: 'MCP_SERVER_RESOURCE_UPDATED_NOTIFICATION_FAILED',
            domain: ErrorDomain.MCP,
            category: ErrorCategory.THIRD_PARTY,
            text: 'Failed to send resource updated notification',
            details: {
              uri,
            },
          },
          error,
        );
        this.getLogger().trackException(mastraError);
        this.getLogger().error('Failed to send resource updated notification:', {
          error: mastraError.toString(),
        });
        throw mastraError;
      }
    } else {
      this.getLogger().debug(`Resource ${uri} was updated, but no active subscriptions for it.`);
    }
  }

  /**
   * Notifies clients that the overall list of available resources has changed.
   *
   * This clears the internal resource cache and sends a `notifications/resources/list_changed`
   * message to all clients, prompting them to re-fetch the resource list.
   *
   * @throws {MastraError} If sending the notification fails
   *
   * @example
   * ```typescript
   * // After adding a new resource to your resource handler
   * await server.resources.notifyListChanged();
   * ```
   */
  public async notifyListChanged(): Promise<void> {
    this.getLogger().info(
      'Resource list change externally notified. Clearing definedResources and sending notification.',
    );
    this.clearDefinedResources(); // Clear cached resources
    this.clearDefinedResourceTemplates(); // Clear cached resource templates
    try {
      await this.getSdkServer().sendResourceListChanged();
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MCP_SERVER_RESOURCE_LIST_CHANGED_NOTIFICATION_FAILED',
          domain: ErrorDomain.MCP,
          category: ErrorCategory.THIRD_PARTY,
          text: 'Failed to send resource list changed notification',
        },
        error,
      );
      this.getLogger().trackException(mastraError);
      this.getLogger().error('Failed to send resource list changed notification:', {
        error: mastraError.toString(),
      });
      throw mastraError;
    }
  }
}
