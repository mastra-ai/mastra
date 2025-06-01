import type { IMastraLogger } from "@mastra/core/logger";
import { ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { GetPromptResult, Prompt } from "@modelcontextprotocol/sdk/types.js";
import type { InternalMastraMCPClient } from "./client";

interface PromptClientActionsConfig {
  client: InternalMastraMCPClient;
  logger: IMastraLogger;
}

export class PromptClientActions {
  private readonly client: InternalMastraMCPClient;
  private readonly logger: IMastraLogger;

  constructor({ client, logger }: PromptClientActionsConfig) {
    this.client = client;
    this.logger = logger;
  }

  /**
   * Get all prompts from the connected MCP server.
   * @returns A list of prompts.
   */
  public async list(): Promise<Prompt[]> {
    try {
      const response = await this.client.listPrompts();
      if (response && response.prompts && Array.isArray(response.prompts)) {
        return response.prompts;
      } else {
        this.logger.warn(`Prompts response from server ${this.client.name} did not have expected structure.`, {
          response,
        });
        return [];
      }
    } catch (e: any) {
      // MCP Server might not support resources, so we return an empty array
      if (e.code === ErrorCode.MethodNotFound) {      
        return []
      }
      this.logger.error(`Error getting prompts from server ${this.client.name}`, {
        error: e instanceof Error ? e.message : String(e),
      });
      console.log('errorheere', e)
      throw new Error(
        `Failed to fetch prompts from server ${this.client.name}: ${e instanceof Error ? e.stack || e.message : String(e)}`,
      );
    }
  }

  /**
   * Get a specific prompt.
   * @param name The name of the prompt to get.
   * @param args Optional arguments for the prompt.
   * @returns The prompt content.
   */
  public async get(name: string, args?: Record<string, any>): Promise<GetPromptResult> {
    return this.client.getPrompt(name, args);
  }

  /**
   * Set a notification handler for when the list of available prompts changes.
   * @param handler The callback function to handle the notification.
   */
  public async onListChanged(handler: () => void): Promise<void> {
    this.client.setPromptListChangedNotificationHandler(handler);
  }
}