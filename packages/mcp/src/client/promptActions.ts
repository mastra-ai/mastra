import type { IMastraLogger } from '@mastra/core/logger';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { GetPromptResult, Prompt } from '@modelcontextprotocol/sdk/types.js';
import type { InternalMastraMCPClient } from './client';

interface PromptClientActionsConfig {
  client: InternalMastraMCPClient;
  logger: IMastraLogger;
}

/**
 * Client-side prompt actions for listing, getting, and subscribing to prompt changes.
 */
export class PromptClientActions {
  private readonly client: InternalMastraMCPClient;
  private readonly logger: IMastraLogger;

  constructor({ client, logger }: PromptClientActionsConfig) {
    this.client = client;
    this.logger = logger;
  }

  /**
   * Get all prompts from the connected MCP server.
   * @returns A list of prompts with their versions.
   */
  public async list(): Promise<Prompt[]> {
    try {
      const response = await this.client.listPrompts();
      if (response && response.prompts && Array.isArray(response.prompts)) {
        return response.prompts.map(prompt => ({ ...prompt, version: prompt.version || '' }));
      } else {
        this.logger.warn(`Prompts response from server ${this.client.name} did not have expected structure.`, {
          response,
        });
        return [];
      }
    } catch (e: any) {
      // MCP Server might not support prompts, so we return an empty array
      if (e.code === ErrorCode.MethodNotFound) {
        return [];
      }
      this.logger.error(`Error getting prompts from server ${this.client.name}`, {
        error: e instanceof Error ? e.message : String(e),
      });
      throw new Error(
        `Failed to fetch prompts from server ${this.client.name}: ${e instanceof Error ? e.stack || e.message : String(e)}`,
      );
    }
  }

  /**
   * Get a specific prompt.
   * @param name The name of the prompt to get.
   * @param args Optional arguments for the prompt.
   * @param version Optional version of the prompt to get.
   * @returns The prompt content.
   */
  public async get({
    name,
    args,
    version,
  }: {
    name: string;
    args?: Record<string, any>;
    version?: string;
  }): Promise<GetPromptResult> {
    return this.client.getPrompt({ name, args, version });
  }

  /**
   * Set a notification handler for when the list of available prompts changes.
   * @param handler The callback function to handle the notification.
   */
  public async onListChanged(handler: () => void): Promise<void> {
    this.client.setPromptListChangedNotificationHandler(handler);
  }
}
