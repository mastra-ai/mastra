import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { IMastraLogger } from '@mastra/core/logger';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

interface ServerPromptActionsDependencies {
  getLogger: () => IMastraLogger;
  getSdkServer: () => Server;
  clearDefinedPrompts: () => void;
}

/**
 * Server-side prompt actions for notifying clients about prompt changes.
 *
 * This class provides methods for MCP servers to notify connected clients when
 * the list of available prompts changes.
 */
export class ServerPromptActions {
  private readonly getLogger: () => IMastraLogger;
  private readonly getSdkServer: () => Server;
  private readonly clearDefinedPrompts: () => void;

  /**
   * @internal
   */
  constructor(dependencies: ServerPromptActionsDependencies) {
    this.getLogger = dependencies.getLogger;
    this.getSdkServer = dependencies.getSdkServer;
    this.clearDefinedPrompts = dependencies.clearDefinedPrompts;
  }

  /**
   * Notifies clients that the overall list of available prompts has changed.
   *
   * This clears the internal prompt cache and sends a `notifications/prompts/list_changed`
   * message to all clients, prompting them to re-fetch the prompt list.
   *
   * @throws {MastraError} If sending the notification fails
   *
   * @example
   * ```typescript
   * // After adding or modifying prompts
   * await server.prompts.notifyListChanged();
   * ```
   */
  public async notifyListChanged(): Promise<void> {
    this.getLogger().info('Prompt list change externally notified. Clearing definedPrompts and sending notification.');
    this.clearDefinedPrompts();
    try {
      await this.getSdkServer().sendPromptListChanged();
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MCP_SERVER_PROMPT_LIST_CHANGED_NOTIFICATION_FAILED',
          domain: ErrorDomain.MCP,
          category: ErrorCategory.THIRD_PARTY,
          text: 'Failed to send prompt list changed notification',
        },
        error,
      );
      this.getLogger().error('Failed to send prompt list changed notification:', {
        error: mastraError.toString(),
      });
      this.getLogger().trackException(mastraError);
      throw mastraError;
    }
  }
}
