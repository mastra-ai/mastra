import { LSPClient } from './client.js';
import { getServersForFile } from './server.js';

/**
 * Singleton LSP client manager that keeps clients alive and reuses them
 * across tool calls for better performance and accuracy
 */
class LSPManager {
  private clients: Map<string, LSPClient> = new Map();
  private initializationPromises: Map<string, Promise<void>> = new Map();

  /**
   * Get or create an LSP client for a file
   * Returns null if no LSP server is available for the file
   */
  async getClient(filePath: string, workspaceRoot: string): Promise<LSPClient | null> {
    const servers = getServersForFile(filePath, workspaceRoot);
    if (servers.length === 0) {
      return null;
    }

    // Use the first matching server (prioritize TypeScript/JavaScript)
    const serverInfo =
      servers.find(
        s =>
          s.languageIds.includes('typescript') ||
          s.languageIds.includes('javascript') ||
          s.languageIds.includes('python') ||
          s.languageIds.includes('go'),
      ) || servers[0];
    // Create a unique key for this server + workspace combination
    if (!serverInfo) {
      return null;
    }
    const key = `${serverInfo.name}:${workspaceRoot}`;

    // Return existing client if available
    if (this.clients.has(key)) {
      return this.clients.get(key)!;
    }

    // If initialization is in progress, wait for it
    if (this.initializationPromises.has(key)) {
      await this.initializationPromises.get(key);
      return this.clients.get(key) || null;
    }

    // Create and initialize new client with a timeout to prevent indefinite hangs
    // (e.g., npx resolution issues in pnpm-linked projects)
    const initPromise = (async () => {
      const client = new LSPClient(serverInfo, workspaceRoot);
      await client.initialize();
      this.clients.set(key, client);
    })();

    this.initializationPromises.set(key, initPromise);

    try {
      await Promise.race([
        initPromise,
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('LSP client initialization timed out')), 15000),
        ),
      ]);
      return this.clients.get(key) || null;
    } catch {
      // If initialization timed out or failed, clean up
      this.clients.delete(key);
      return null;
    } finally {
      this.initializationPromises.delete(key);
    }
  }

  /**
   * Shutdown a specific client
   */
  async shutdownClient(workspaceRoot: string, serverName?: string): Promise<void> {
    const keysToRemove: string[] = [];

    for (const [key, client] of this.clients.entries()) {
      if (key.includes(workspaceRoot) && (!serverName || key.startsWith(serverName))) {
        await client.shutdown();
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      this.clients.delete(key);
    }
  }

  /**
   * Shutdown all clients
   */
  async shutdownAll(): Promise<void> {
    const shutdownPromises = Array.from(this.clients.values()).map(client => client.shutdown());
    await Promise.all(shutdownPromises);
    this.clients.clear();
    this.initializationPromises.clear();
  }

  /**
   * Get the number of active clients
   */
  getActiveClientCount(): number {
    return this.clients.size;
  }

  /**
   * Close a document in all active clients
   * This is useful for tests that reuse the same file path
   */
  closeDocument(filePath: string): void {
    for (const client of this.clients.values()) {
      try {
        client.notifyClose(filePath);
      } catch {
        // Ignore errors if document wasn't open
      }
    }
  }
}

// Export singleton instance
export const lspManager = new LSPManager();
