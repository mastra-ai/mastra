import type { ToolsInput } from '@mastra/core/agent';
import type { IMastraLogger } from '@mastra/core/logger';
import type { Server, ServerNotifier } from '@modelcontextprotocol/server';
import { broadcastNotification } from './notificationBroadcast';

interface ServerToolActionsDependencies {
  getLogger: () => IMastraLogger;
  getSdkServers: () => Server[];
  addTools: (tools: ToolsInput) => void;
  removeTools: (toolIds: string[]) => string[];
  /**
   * Publish-side facade of the 2026-07-28 handler's subscription bus, when the
   * server is pinned to that revision and the handler exists. Modern clients
   * receive change events via `subscriptions/listen` instead of server push.
   */
  getModernEraNotifier?: () => ServerNotifier | undefined;
}

/**
 * Server-side tool actions for dynamic tool management and notifying clients
 * about tool list changes.
 *
 * Notifications are broadcast to every active server instance (the main
 * stdio/SSE instance plus each streamable HTTP session). Clients connected in
 * stateless/serverless mode cannot receive notifications because each request
 * uses a transient server instance.
 */
export class ServerToolActions {
  private readonly getLogger: () => IMastraLogger;
  private readonly getSdkServers: () => Server[];
  private readonly addTools: (tools: ToolsInput) => void;
  private readonly removeTools: (toolIds: string[]) => string[];
  private readonly getModernEraNotifier?: () => ServerNotifier | undefined;

  /**
   * @internal
   */
  constructor(dependencies: ServerToolActionsDependencies) {
    this.getLogger = dependencies.getLogger;
    this.getSdkServers = dependencies.getSdkServers;
    this.addTools = dependencies.addTools;
    this.removeTools = dependencies.removeTools;
    this.getModernEraNotifier = dependencies.getModernEraNotifier;
  }

  /**
   * Registers new tools on the running server and notifies connected clients
   * that the tool list has changed.
   *
   * Tools are keyed by their record key, the same as tools passed to the
   * `MCPServer` constructor. Adding a tool under an existing key replaces it.
   *
   * @param tools - Tools to register
   * @throws {MastraError} If sending the notification fails on all server instances
   *
   * @example
   * ```typescript
   * await server.toolActions.add({ myNewTool });
   * ```
   */
  public async add(tools: ToolsInput): Promise<void> {
    this.addTools(tools);
    await this.notifyListChanged();
  }

  /**
   * Removes tools from the running server and notifies connected clients that
   * the tool list has changed.
   *
   * Unknown tool IDs are ignored (logged as a warning). If no tools were
   * actually removed, no notification is sent.
   *
   * @param toolIds - IDs of the tools to remove
   * @throws {MastraError} If sending the notification fails on all server instances
   *
   * @example
   * ```typescript
   * await server.toolActions.remove(['myNewTool']);
   * ```
   */
  public async remove(toolIds: string[]): Promise<void> {
    const removed = this.removeTools(toolIds);
    if (removed.length === 0) {
      this.getLogger().debug('No tools were removed; skipping tool list changed notification.');
      return;
    }
    await this.notifyListChanged();
  }

  /**
   * Notifies clients that the overall list of available tools has changed.
   *
   * This sends a `notifications/tools/list_changed` message to all clients,
   * prompting them to re-fetch the tool list.
   *
   * @throws {MastraError} If sending the notification fails on all server instances
   *
   * @example
   * ```typescript
   * // After changing which tools are available
   * await server.toolActions.notifyListChanged();
   * ```
   */
  public async notifyListChanged(): Promise<void> {
    this.getLogger().info('Tool list changed. Sending notification.');
    // Modern (2026-07-28) clients subscribe via subscriptions/listen; no-op when unset.
    this.getModernEraNotifier?.()?.toolsChanged();
    await broadcastNotification({
      servers: this.getSdkServers(),
      send: server => server.sendToolListChanged(),
      logger: this.getLogger(),
      errorId: 'MCP_SERVER_TOOL_LIST_CHANGED_NOTIFICATION_FAILED',
      errorText: 'Failed to send tool list changed notification',
    });
  }
}
