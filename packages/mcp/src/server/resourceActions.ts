import type { IMastraLogger } from '@mastra/core/logger';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

interface ServerResourceActionsDependencies {
  getSubscriptions: () => Set<string>;
  getLogger: () => IMastraLogger;
  getSdkServer: () => Server;
  clearDefinedResources: () => void;
  clearDefinedResourceTemplates: () => void;
}

export class ServerResourceActions {
  private readonly getSubscriptions: () => Set<string>;
  private readonly getLogger: () => IMastraLogger;
  private readonly getSdkServer: () => Server;
  private readonly clearDefinedResources: () => void;
  private readonly clearDefinedResourceTemplates: () => void;

  constructor(dependencies: ServerResourceActionsDependencies) {
    this.getSubscriptions = dependencies.getSubscriptions;
    this.getLogger = dependencies.getLogger;
    this.getSdkServer = dependencies.getSdkServer;
    this.clearDefinedResources = dependencies.clearDefinedResources;
    this.clearDefinedResourceTemplates = dependencies.clearDefinedResourceTemplates;
  }

  /**
   * Checks if any resources have been updated.
   * If the resource is subscribed to by clients, an update notification will be sent.
   */
  public async notifyUpdated({ uri }: { uri: string }): Promise<void> {
    if (this.getSubscriptions().has(uri)) {
      this.getLogger().info(`Sending notifications/resources/updated for externally notified resource: ${uri}`);
      try {
        await this.getSdkServer().sendResourceUpdated({ uri });
      } catch (error) {
        this.getLogger().error('Failed to send resource updated notification:', { error });
        throw error;
      }
    } else {
      this.getLogger().debug(`Resource ${uri} was updated, but no active subscriptions for it.`);
    }
  }

  /**
   * Notifies the server that the overall list of available resources has changed.
   * This will clear the internal cache of defined resources and send a list_changed notification to clients.
   */
  public async notifyListChanged(): Promise<void> {
    this.getLogger().info(
      'Resource list change externally notified. Clearing definedResources and sending notification.',
    );
    this.clearDefinedResources(); // Clear cached resources
    this.clearDefinedResourceTemplates(); // Clear cached resource templates
    try {
      await this.getSdkServer().sendResourceListChanged();
    } catch (error) {
      this.getLogger().error('Failed to send resource list changed notification:', { error });
      throw error;
    }
  }
}
