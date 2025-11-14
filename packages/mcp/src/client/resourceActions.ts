import type { IMastraLogger } from '@mastra/core/logger';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { Resource, ResourceTemplate } from '@modelcontextprotocol/sdk/types.js';
import type { InternalMastraMCPClient } from './client';

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
        this.logger.warn(`Resources response from server ${this.client.name} did not have expected structure.`, {
          response,
        });
        return [];
      }
    } catch (e: any) {
      // MCP Server might not support resources, so we return an empty array
      if (e.code === ErrorCode.MethodNotFound) {
        return [];
      }
      this.logger.error(`Error getting resources from server ${this.client.name}`, {
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
  public async templates(): Promise<ResourceTemplate[]> {
    try {
      const response = await this.client.listResourceTemplates();
      if (response && response.resourceTemplates && Array.isArray(response.resourceTemplates)) {
        return response.resourceTemplates;
      } else {
        this.logger.warn(
          `Resource templates response from server ${this.client.name} did not have expected structure.`,
          { response },
        );
        return [];
      }
    } catch (e: any) {
      // MCP Server might not support resources, so we return an empty array
      if (e.code === ErrorCode.MethodNotFound) {
        return [];
      }
      this.logger.error(`Error getting resource templates from server ${this.client.name}`, {
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
   * Subscribes to updates for a specific resource.
   *
   * After subscribing, you'll receive notifications via the `onUpdated` handler
   * when the resource content changes.
   *
   * @param uri - URI of the resource to subscribe to
   * @returns Promise resolving when subscription is established
   * @throws {Error} If subscription fails
   *
   * @example
   * ```typescript
   * await client.resources.subscribe('file://data/config.json');
   * ```
   */
  public async subscribe(uri: string) {
    return this.client.subscribeResource(uri);
  }

  /**
   * Unsubscribes from updates for a specific resource.
   *
   * Stops receiving notifications for this resource URI.
   *
   * @param uri - URI of the resource to unsubscribe from
   * @returns Promise resolving when unsubscription is complete
   * @throws {Error} If unsubscription fails
   *
   * @example
   * ```typescript
   * await client.resources.unsubscribe('file://data/config.json');
   * ```
   */
  public async unsubscribe(uri: string) {
    return this.client.unsubscribeResource(uri);
  }

  /**
   * Sets a notification handler for when subscribed resources are updated.
   *
   * The handler is called whenever the server sends a resource update notification
   * for any resource you've subscribed to.
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
    this.client.setResourceListChangedNotificationHandler(handler);
  }
}
