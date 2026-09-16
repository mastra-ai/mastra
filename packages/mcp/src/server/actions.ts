import type { ToolsInput } from '@mastra/core/agent';
import type { IMastraLogger } from '@mastra/core/logger';
import type { ServerNotifier } from '@modelcontextprotocol/server';

interface ActionDependencies {
  getLogger: () => IMastraLogger;
  /** Modern clients receive change events through `subscriptions/listen`; undefined until a transport is serving. */
  getNotifier: () => ServerNotifier | undefined;
}

/** Runtime tool catalogue mutations. Every change is published to listening clients. */
export class ServerToolActions {
  constructor(
    private readonly deps: ActionDependencies & {
      addTools: (tools: ToolsInput) => void;
      removeTools: (toolIds: string[]) => string[];
    },
  ) {}

  async add(tools: ToolsInput): Promise<void> {
    this.deps.addTools(tools);
    await this.notifyListChanged();
  }

  async remove(toolIds: string[]): Promise<void> {
    if (this.deps.removeTools(toolIds).length === 0) return;
    await this.notifyListChanged();
  }

  async notifyListChanged(): Promise<void> {
    this.deps.getLogger().info('Tool list changed. Publishing notification.');
    this.deps.getNotifier()?.toolsChanged();
  }
}

export class ServerResourceActions {
  constructor(private readonly deps: ActionDependencies) {}

  async notifyUpdated({ uri }: { uri: string }): Promise<void> {
    this.deps.getLogger().info('Resource updated. Publishing notification.', { uri });
    this.deps.getNotifier()?.resourceUpdated(uri);
  }

  async notifyListChanged(): Promise<void> {
    this.deps.getLogger().info('Resource list changed. Publishing notification.');
    this.deps.getNotifier()?.resourcesChanged();
  }
}

export class ServerPromptActions {
  constructor(private readonly deps: ActionDependencies) {}

  async notifyListChanged(): Promise<void> {
    this.deps.getLogger().info('Prompt list changed. Publishing notification.');
    this.deps.getNotifier()?.promptsChanged();
  }
}
