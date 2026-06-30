import type { IMastraLogger } from '@mastra/core/logger';
import type { Server } from '@modelcontextprotocol/server';
import { broadcastNotification } from './notificationBroadcast';

interface ServerPromptActionsDependencies {
  getLogger: () => IMastraLogger;
  getSdkServers: () => Server[];
  clearDefinedPrompts: () => void;
}

/**
 * Server-side prompt actions for notifying clients about prompt changes.
 *
 * This class provides methods for MCP servers to notify connected clients when
 * the list of available prompts changes.
 *
 * Notifications are broadcast to every active server instance (the main
 * stdio/SSE instance plus each streamable HTTP session). Clients connected in
 * stateless/serverless mode cannot receive notifications because each request
 * uses a transient server instance.
 */
export class ServerPromptActions {
  private readonly getLogger: () => IMastraLogger;
  private readonly getSdkServers: () => Server[];
  private readonly clearDefinedPrompts: () => void;

  /**
   * @internal
   */
  constructor(dependencies: ServerPromptActionsDependencies) {
    this.getLogger = dependencies.getLogger;
    this.getSdkServers = dependencies.getSdkServers;
    this.clearDefinedPrompts = dependencies.clearDefinedPrompts;
  }

  /**
   * Notifies clients that the overall list of available prompts has changed.
   *
   * This clears the internal prompt cache and sends a `notifications/prompts/list_changed`
   * message to all clients, prompting them to re-fetch the prompt list.
   *
   * @throws {MastraError} If sending the notification fails on all server instances
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
    await broadcastNotification({
      servers: this.getSdkServers(),
      send: server => server.sendPromptListChanged(),
      logger: this.getLogger(),
      errorId: 'MCP_SERVER_PROMPT_LIST_CHANGED_NOTIFICATION_FAILED',
      errorText: 'Failed to send prompt list changed notification',
    });
  }
}
