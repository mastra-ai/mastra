import type { MCPServerBase } from '@mastra/core/mcp';
import type { ToolAction } from '@mastra/core/tools';
import type { Agent } from '@mastra/core/agent';
import type { Workflow } from '@mastra/core/workflows';
import type {
  StorageCreateMCPServerInput,
  StorageUpdateMCPServerInput,
  StorageListMCPServersInput,
  StorageListMCPServersOutput,
  StorageResolvedMCPServerType,
  StorageListMCPServersResolvedOutput,
  StorageToolConfig,
} from '@mastra/core/storage';

import { CrudEditorNamespace } from './base';
import type { StorageAdapter } from './base';

export class EditorMCPServerNamespace extends CrudEditorNamespace<
  StorageCreateMCPServerInput,
  StorageUpdateMCPServerInput,
  StorageListMCPServersInput,
  StorageListMCPServersOutput,
  StorageListMCPServersResolvedOutput,
  StorageResolvedMCPServerType,
  MCPServerBase
> {
  private mcpServerCtor: any;

  protected override onCacheEvict(_id: string): void {
    // No removeMCPServer API exists on Mastra yet.
    // The server will be re-created on next hydration.
  }

  protected override async hydrate(resolved: StorageResolvedMCPServerType): Promise<MCPServerBase> {
    if (!this.mastra) {
      throw new Error('MastraEditor is not registered with a Mastra instance');
    }

    const tools = this.resolveStoredTools(resolved.tools);
    const agents = this.resolveStoredAgents(resolved.agents);
    const workflows = this.resolveStoredWorkflows(resolved.workflows);

    if (!this.mcpServerCtor) {
      try {
        const mod = await import('@mastra/mcp');
        this.mcpServerCtor = mod.MCPServer;
      } catch {
        throw new Error(
          '@mastra/mcp is required to hydrate MCP server configurations. Install it with: npm install @mastra/mcp',
        );
      }
    }

    const server: MCPServerBase = new this.mcpServerCtor({
      id: resolved.id,
      name: resolved.name,
      version: resolved.version,
      description: resolved.description,
      instructions: resolved.instructions,
      repository: resolved.repository,
      releaseDate: resolved.releaseDate,
      isLatest: resolved.isLatest,
      packageCanonical: resolved.packageCanonical,
      tools,
      agents,
      workflows,
    });

    this.mastra.addMCPServer(server, resolved.id);

    return server;
  }

  private resolveStoredTools(
    storedTools?: Record<string, StorageToolConfig>,
  ): Record<string, ToolAction<any, any, any, any, any, any>> {
    if (!storedTools || Object.keys(storedTools).length === 0) return {};
    if (!this.mastra) return {};

    const resolved: Record<string, ToolAction<any, any, any, any, any, any>> = {};
    for (const [toolKey, toolConfig] of Object.entries(storedTools)) {
      try {
        const tool = this.mastra.getToolById(toolKey);
        if (toolConfig.description) {
          resolved[toolKey] = { ...tool, description: toolConfig.description };
        } else {
          resolved[toolKey] = tool;
        }
      } catch {
        this.logger?.warn(`Tool "${toolKey}" referenced in stored MCP server but not registered in Mastra`);
      }
    }
    return resolved;
  }

  private resolveStoredAgents(storedAgents?: Record<string, StorageToolConfig>): Record<string, Agent<any>> {
    if (!storedAgents || Object.keys(storedAgents).length === 0) return {};
    if (!this.mastra) return {};

    const resolved: Record<string, Agent<any>> = {};
    for (const agentKey of Object.keys(storedAgents)) {
      try {
        resolved[agentKey] = this.mastra.getAgent(agentKey);
      } catch {
        try {
          resolved[agentKey] = this.mastra.getAgentById(agentKey);
        } catch {
          this.logger?.warn(`Agent "${agentKey}" referenced in stored MCP server but not registered in Mastra`);
        }
      }
    }
    return resolved;
  }

  private resolveStoredWorkflows(
    storedWorkflows?: Record<string, StorageToolConfig>,
  ): Record<string, Workflow<any, any, any, any, any, any, any>> {
    if (!storedWorkflows || Object.keys(storedWorkflows).length === 0) return {};
    if (!this.mastra) return {};

    const resolved: Record<string, Workflow<any, any, any, any, any, any, any>> = {};
    for (const workflowKey of Object.keys(storedWorkflows)) {
      try {
        resolved[workflowKey] = this.mastra.getWorkflow(workflowKey);
      } catch {
        try {
          resolved[workflowKey] = this.mastra.getWorkflowById(workflowKey);
        } catch {
          this.logger?.warn(`Workflow "${workflowKey}" referenced in stored MCP server but not registered in Mastra`);
        }
      }
    }
    return resolved;
  }

  protected async getStorageAdapter(): Promise<
    StorageAdapter<
      StorageCreateMCPServerInput,
      StorageUpdateMCPServerInput,
      StorageListMCPServersInput,
      StorageListMCPServersOutput,
      StorageListMCPServersResolvedOutput,
      StorageResolvedMCPServerType
    >
  > {
    const storage = this.mastra?.getStorage();
    if (!storage) throw new Error('Storage is not configured');
    const store = await storage.getStore('mcpServers');
    if (!store) throw new Error('MCP servers storage domain is not available');

    return {
      create: input => store.create({ mcpServer: input }),
      getByIdResolved: id => store.getByIdResolved(id),
      update: input => store.update(input),
      delete: id => store.delete(id),
      list: args => store.list(args),
      listResolved: args => store.listResolved(args),
    };
  }
}
