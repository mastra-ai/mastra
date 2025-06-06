import type { IMastraLogger } from '@mastra/core/logger';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

interface ServerPromptActionsDependencies {
  getLogger: () => IMastraLogger;
  getSdkServer: () => Server;
  clearDefinedPrompts: () => void;
}

export class ServerPromptActions {
  private readonly getLogger: () => IMastraLogger;
  private readonly getSdkServer: () => Server;
  private readonly clearDefinedPrompts: () => void;

  constructor(dependencies: ServerPromptActionsDependencies) {
    this.getLogger = dependencies.getLogger;
    this.getSdkServer = dependencies.getSdkServer;
    this.clearDefinedPrompts = dependencies.clearDefinedPrompts;
  }

  /**
   * Notifies the server that the overall list of available prompts has changed.
   * This will clear the internal cache of defined prompts and send a list_changed notification to clients.
   */
  public async notifyListChanged(): Promise<void> {
    this.getLogger().info('Prompt list change externally notified. Clearing definedPrompts and sending notification.');
    this.clearDefinedPrompts();
    try {
      await this.getSdkServer().sendPromptListChanged();
    } catch (error) {
      this.getLogger().error('Failed to send prompt list changed notification:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
