import type { IMastraLogger } from '@mastra/core/logger';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { Resource, ResourceTemplate } from '@modelcontextprotocol/sdk/types.js';
import type { InternalMastraMCPClient } from './client';

interface ResourceClientActionsConfig {
  client: InternalMastraMCPClient;
  logger: IMastraLogger;
}

export class ResourceClientActions {
  private readonly client: InternalMastraMCPClient;
  private readonly logger: IMastraLogger;

  constructor({ client, logger }: ResourceClientActionsConfig) {
    this.client = client;
    this.logger = logger;
  }

  /**
   * Get all resources from the connected MCP server.
   * @returns A list of resources.
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
   * Get all resource templates from the connected MCP server.
   * @returns A list of resource templates.
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
   * Read a specific resource.
   * @param uri The URI of the resource to read.
   * @returns The resource content.
   */
  public async read(uri: string) {
    return this.client.readResource(uri);
  }

  /**
   * Subscribe to a specific resource.
   * @param uri The URI of the resource to subscribe to.
   */
  public async subscribe(uri: string) {
    return this.client.subscribeResource(uri);
  }

  /**
   * Unsubscribe from a specific resource.
   * @param uri The URI of the resource to unsubscribe from.
   */
  public async unsubscribe(uri: string) {
    return this.client.unsubscribeResource(uri);
  }

  /**
   * Set a notification handler for when a specific resource is updated.
   * @param handler The callback function to handle the notification.
   */
  public async onUpdated(handler: (params: { uri: string }) => void): Promise<void> {
    this.client.setResourceUpdatedNotificationHandler(handler);
  }

  /**
   * Set a notification handler for when the list of available resources changes.
   * @param handler The callback function to handle the notification.
   */
  public async onListChanged(handler: () => void): Promise<void> {
    this.client.setResourceListChangedNotificationHandler(handler);
  }
}
