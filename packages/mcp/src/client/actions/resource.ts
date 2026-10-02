import type { IMastraLogger } from '@mastra/core/logger';
import type { Resource, ResourceTemplateType } from '@modelcontextprotocol/client';
import { ProtocolErrorCode } from '@modelcontextprotocol/client';
import type { InternalMastraMCPClient } from '../client';

interface ResourceClientActionsConfig {
  client: InternalMastraMCPClient;
  logger: IMastraLogger;
}

/**
 * Client-side resource actions for interacting with MCP server resources.
 *
 * Provides methods to list, read, subscribe to, and manage resources exposed by an MCP server.
 * Resources represent any kind of data that a server wants to make available (files, database
 * records, API responses, etc.).
 */
export class ResourceClientActions {
  private readonly client: InternalMastraMCPClient;
  private readonly logger: IMastraLogger;

  /**
   * @internal
   */
  constructor({ client, logger }: ResourceClientActionsConfig) {
    this.client = client;
    this.logger = logger;
  }

  /**
   * Retrieves all available resources from the connected MCP server.
   *
   * Returns an empty array if the server doesn't support resources (MethodNotFound error).
   *
   * @returns Promise resolving to array of resources
   * @throws {Error} If fetching resources fails (excluding MethodNotFound)
   *
   * @example
   * ```typescript
   * const resources = await client.resources.list();
   * resources.forEach(resource => {
   *   console.log(`${resource.name}: ${resource.uri}`);
   * });
   * ```
   */
  public async list(): Promise<Resource[]> {
    try {
      const response = await this.client.listResources();
      if (response && response.resources && Array.isArray(response.resources)) {
        return response.resources;
      } else {
        this.logger.warn('Resources response did not have expected structure', {
          server: this.client.name,
          response,
        });
        return [];
      }
    } catch (e: any) {
      // MCP Server might not support resources, so we return an empty array
      if (e.code === ProtocolErrorCode.MethodNotFound) {
        return [];
      }
      this.logger.error('Error getting resources from server', {
        server: this.client.name,
        error: e instanceof Error ? e.message : String(e),
      });
      throw new Error(
        `Failed to fetch resources from server ${this.client.name}: ${e instanceof Error ? e.stack || e.message : String(e)}`,
      );
    }
  }

  /**
   * Retrieves all available resource templates from the connected MCP server.
   *
   * Resource templates are URI templates (RFC 6570) that describe dynamic resources.
   * Returns an empty array if the server doesn't support resource templates.
   *
   * @returns Promise resolving to array of resource templates
   * @throws {Error} If fetching resource templates fails (excluding MethodNotFound)
   *
   * @example
   * ```typescript
   * const templates = await client.resources.templates();
   * templates.forEach(template => {
   *   console.log(`${template.name}: ${template.uriTemplate}`);
   * });
   * ```
   */
  public async templates(): Promise<ResourceTemplateType[]> {
    try {
      const response = await this.client.listResourceTemplates();
      if (response && response.resourceTemplates && Array.isArray(response.resourceTemplates)) {
        return response.resourceTemplates;
      } else {
        this.logger.warn('Resource templates response did not have expected structure', {
          server: this.client.name,
          response,
        });
        return [];
      }
    } catch (e: any) {
      // MCP Server might not support resources, so we return an empty array
      if (e.code === ProtocolErrorCode.MethodNotFound) {
        return [];
      }
      this.logger.error('Error getting resource templates from server', {
        server: this.client.name,
        error: e instanceof Error ? e.message : String(e),
      });
      throw new Error(
        `Failed to fetch resource templates from server ${this.client.name}: ${e instanceof Error ? e.stack || e.message : String(e)}`,
      );
    }
  }

  /**
   * Reads the content of a specific resource from the MCP server.
   *
   * @param uri - URI of the resource to read (e.g., 'file://path/to/file.txt')
   * @returns Promise resolving to the resource content
   * @throws {Error} If reading the resource fails or resource not found
   *
   * @example
   * ```typescript
   * const result = await client.resources.read('file://data/config.json');
   * console.log(result.contents[0].text); // Resource text content
   * ```
   */
  public async read(uri: string) {
    return this.client.readResource(uri);
  }

  /**
   * Subscribes to update notifications for a resource. The client carries every
   * subscription on one `subscriptions/listen` stream and reopens it after reconnects.
   *
   * @param uri - URI of the resource to watch
   * @throws {Error} If the server declines the subscription
   *
   * @example
   * ```typescript
   * await client.resources.onUpdated(({ uri }) => console.log(`updated ${uri}`));
   * await client.resources.subscribe('file://data/config.json');
   * ```
   */
  public async subscribe(uri: string): Promise<void> {
    await this.client.subscribeResource(uri);
  }

  /** Stops update notifications for a resource previously passed to {@link subscribe}. */
  public async unsubscribe(uri: string): Promise<void> {
    await this.client.unsubscribeResource(uri);
  }

  /**
   * Sets a notification handler for when subscribed resources are updated.
   *
   * Updates arrive for resources passed to {@link subscribe}.
   *
   * @param handler - Callback function receiving the updated resource URI
   *
   * @example
   * ```typescript
   * await client.resources.onUpdated(async (params) => {
   *   console.log(`Resource updated: ${params.uri}`);
   *   // Re-fetch the resource
   *   const content = await client.resources.read(params.uri);
   *   console.log('New content:', content);
   * });
   * ```
   */
  public async onUpdated(handler: (params: { uri: string }) => void): Promise<void> {
    this.client.setResourceUpdatedNotificationHandler(handler);
  }

  /**
   * Sets a notification handler for when the list of available resources changes.
   *
   * The handler is called when resources are added or removed from the server.
   *
   * @param handler - Callback function invoked when the resource list changes
   *
   * @example
   * ```typescript
   * await client.resources.onListChanged(async () => {
   *   console.log('Resource list changed, re-fetching...');
   *   const resources = await client.resources.list();
   *   console.log('Updated resource count:', resources.length);
   * });
   * ```
   */
  public async onListChanged(handler: () => void): Promise<void> {
    await this.client.setResourceListChangedNotificationHandler(handler);
  }
}
