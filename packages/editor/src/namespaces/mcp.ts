import type {
  StorageCreateMCPClientInput,
  StorageUpdateMCPClientInput,
  StorageListMCPClientsInput,
  StorageListMCPClientsOutput,
  StorageResolvedMCPClientType,
  StorageListMCPClientsResolvedOutput,
  StorageMCPServerConfig,
} from '@mastra/core/storage';

import { CrudEditorNamespace } from './base';
import type { StorageAdapter } from './base';

export class EditorMCPNamespace extends CrudEditorNamespace<
  StorageCreateMCPClientInput,
  StorageUpdateMCPClientInput,
  StorageListMCPClientsInput,
  StorageListMCPClientsOutput,
  StorageListMCPClientsResolvedOutput,
  StorageResolvedMCPClientType
> {
  protected override onCacheEvict(_id: string): void {
    // MCP clients don't register in Mastra's runtime — no cleanup needed.
  }

  protected async getStorageAdapter(): Promise<
    StorageAdapter<
      StorageCreateMCPClientInput,
      StorageUpdateMCPClientInput,
      StorageListMCPClientsInput,
      StorageListMCPClientsOutput,
      StorageListMCPClientsResolvedOutput,
      StorageResolvedMCPClientType
    >
  > {
    const storage = this.mastra?.getStorage();
    if (!storage) throw new Error('Storage is not configured');
    const store = await storage.getStore('mcpClients');
    if (!store) throw new Error('MCP clients storage domain is not available');

    return {
      create: input => store.create({ mcpClient: input }),
      getByIdResolved: id => store.getByIdResolved(id),
      update: input => store.update(input),
      delete: id => store.delete(id),
      list: args => store.list(args),
      listResolved: args => store.listResolved(args),
    };
  }

  /**
   * Convert a stored MCP server config into the shape expected by MCPClient.
   * Converts `url` from string to URL for HTTP servers.
   * Returns a plain object — callers must pass it to `new MCPClient()`.
   */
  static toMCPServerDefinition(
    serverConfig: StorageMCPServerConfig,
    requestInit?: { headers: Record<string, string> },
  ): Record<string, unknown> {
    if (serverConfig.type === 'stdio') {
      return {
        command: serverConfig.command!,
        args: serverConfig.args,
        env: serverConfig.env,
        timeout: serverConfig.timeout,
      };
    }

    // HTTP transport — include requestInit (e.g., auth headers) when provided
    return {
      url: new URL(serverConfig.url!),
      timeout: serverConfig.timeout,
      ...(requestInit ? { requestInit } : {}),
    };
  }

  /**
   * Convert all servers in a stored MCP client to MCPClientOptions shape.
   */
  static toMCPClientOptions(
    config: StorageResolvedMCPClientType,
    requestInit?: { headers: Record<string, string> },
  ): {
    id: string;
    servers: Record<string, Record<string, unknown>>;
  } {
    const servers: Record<string, Record<string, unknown>> = {};
    for (const [name, serverConfig] of Object.entries(config.servers)) {
      servers[name] = EditorMCPNamespace.toMCPServerDefinition(serverConfig, requestInit);
    }
    return { id: config.id, servers };
  }
}
