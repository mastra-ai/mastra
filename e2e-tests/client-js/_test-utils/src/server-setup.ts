import type { Mastra } from '@mastra/core/mastra';
import type { Server } from 'http';

/**
 * Configuration for the test server setup
 */
export interface ServerSetupConfig {
  /**
   * Create the Mastra instance for the test server.
   * This allows different test configurations to use different setups.
   */
  createMastra: () => Mastra | Promise<Mastra>;

  /**
   * Create the HTTP server with the Mastra instance.
   * Returns a tuple of [server, baseUrl].
   */
  createServer: (mastra: Mastra, port: number) => Promise<[Server, string]>;

  /**
   * Optional callback after server starts
   */
  onServerReady?: (baseUrl: string, mastra: Mastra) => Promise<void>;
}

/**
 * Wait for the server to be ready by polling the agents endpoint
 */
export async function waitForServer(baseUrl: string, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${baseUrl}/api/agents`);
      if (res.ok) {
        return;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Server did not start within ${maxAttempts * 500}ms`);
}
