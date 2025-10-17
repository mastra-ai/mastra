import type { IMastraLogger } from '@mastra/core/logger';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { GetPromptResult, Prompt } from '@modelcontextprotocol/sdk/types.js';
import type { InternalMastraMCPClient } from './client';

interface PromptClientActionsConfig {
  client: InternalMastraMCPClient;
  logger: IMastraLogger;
}

/**
 * Client-side prompt actions for interacting with MCP server prompts.
 *
 * Provides methods to list, retrieve, and subscribe to prompt templates exposed by an MCP server.
 * Prompts are reusable message templates that can be parameterized and used for AI interactions.
 */
export class PromptClientActions {
  private readonly client: InternalMastraMCPClient;
  private readonly logger: IMastraLogger;

  /**
   * @internal
   */
  constructor({ client, logger }: PromptClientActionsConfig) {
    this.client = client;
    this.logger = logger;
  }

  /**
   * Retrieves all available prompts from the connected MCP server.
   *
   * Returns an empty array if the server doesn't support prompts (MethodNotFound error).
   *
   * @returns Promise resolving to array of prompts with their metadata
   * @throws {Error} If fetching prompts fails (excluding MethodNotFound)
   *
   * @example
   * ```typescript
   * const prompts = await client.prompts.list();
   * prompts.forEach(prompt => {
   *   console.log(`${prompt.name} (v${prompt.version}): ${prompt.description}`);
   * });
   * ```
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
   * Retrieves a specific prompt with its messages from the MCP server.
   *
   * Prompts can accept arguments to parameterize the template. The returned messages
   * can be used directly in AI chat completions.
   *
   * @param params - Parameters for the prompt request
   * @param params.name - Name of the prompt to retrieve
   * @param params.args - Optional arguments to populate the prompt template
   * @param params.version - Optional specific version of the prompt to retrieve
   * @returns Promise resolving to the prompt result with messages
   * @throws {Error} If fetching the prompt fails or prompt not found
   *
   * @example
   * ```typescript
   * const prompt = await client.prompts.get({
   *   name: 'code-review',
   *   args: {
   *     language: 'typescript',
   *     code: 'const x = 1;'
   *   },
   *   version: '1.0'
   * });
   *
   * // Use prompt messages in AI completion
   * console.log(prompt.messages);
   * ```
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
   * Sets a notification handler for when the list of available prompts changes.
   *
   * The handler is called when prompts are added, removed, or modified on the server.
   *
   * @param handler - Callback function invoked when the prompt list changes
   *
   * @example
   * ```typescript
   * await client.prompts.onListChanged(async () => {
   *   console.log('Prompt list changed, re-fetching...');
   *   const prompts = await client.prompts.list();
   *   console.log('Available prompts:', prompts.map(p => p.name));
   * });
   * ```
   */
  public async onListChanged(handler: () => void): Promise<void> {
    this.client.setPromptListChangedNotificationHandler(handler);
  }
}
