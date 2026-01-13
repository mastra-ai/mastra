import type { TestProject } from 'vitest/node';
import type { Mastra } from '@mastra/core/mastra';
import type { Server } from 'http';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import getPort from 'get-port';

/**
 * Configuration for the test server setup factory
 */
export interface TestServerSetupConfig {
  /**
   * Variant name for identification (e.g., 'zod-v3', 'zod-v4')
   * Used to generate unique storage IDs and service names
   */
  variant: string;
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
  throw new Error(`Server at ${baseUrl}/api/agents did not respond within ${maxAttempts * 500}ms`);
}

/**
 * Close server with proper async handling
 */
async function closeServer(server: ReturnType<typeof serve>): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    server.close(err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Factory function to create a test server setup for vitest globalSetup.
 *
 * This creates a setup function that:
 * - Creates a Mastra instance with observability
 * - Starts an HTTP server on a random available port
 * - Provides baseUrl and port to tests via vitest's provide mechanism
 * - Properly handles server cleanup even if setup fails
 *
 * @example
 * ```ts
 * // setup.ts
 * import { createTestServerSetup } from '@internal/client-js-test-utils';
 * export default createTestServerSetup({ variant: 'zod-v3' });
 * ```
 */
export function createTestServerSetup(config: TestServerSetupConfig) {
  const { variant } = config;

  // Generate unique identifiers based on variant
  const storageId = variant ? `client-js-e2e-storage-${variant}` : 'client-js-e2e-storage';
  const serviceName = variant ? `client-js-e2e-${variant}` : 'client-js-e2e';

  return async function setup(project: TestProject) {
    // Import dependencies dynamically to avoid issues with peer dependencies
    const [
      { Mastra },
      { Agent },
      { LibSQLStore },
      { MastraServer },
      { registerApiRoute },
      { Observability, DefaultExporter },
    ] = await Promise.all([
      import('@mastra/core/mastra'),
      import('@mastra/core/agent'),
      import('@mastra/libsql'),
      import('@mastra/hono'),
      import('@mastra/core/server'),
      import('@mastra/observability'),
    ]);

    const port = await getPort();
    const baseUrl = `http://localhost:${port}`;

    // Create storage
    const storage = new LibSQLStore({
      id: storageId,
      url: ':memory:',
    });

    // Create a simple test agent
    const testAgent = new Agent({
      id: 'test-agent',
      name: 'testAgent',
      instructions: 'You are a helpful test assistant.',
      model: 'openai/gpt-4.1-mini',
    });

    // Create Mastra instance with observability configured
    const mastra = new Mastra({
      agents: { testAgent },
      storage,
      observability: new Observability({
        configs: {
          default: {
            serviceName,
            exporters: [
              new DefaultExporter(), // Persists traces to storage
            ],
          },
        },
      }),
      server: {
        apiRoutes: [
          registerApiRoute('/e2e/reset-storage', {
            method: 'POST',
            handler: async c => {
              const observabilityStore = await storage.getStore('observability');
              if (observabilityStore) {
                await observabilityStore.dangerouslyClearAll();
              }
              return c.json({ message: 'Storage reset' }, 200);
            },
          }),
        ],
      },
    });

    // Create Hono app and MastraServer
    const app = new Hono();
    const mastraServer = new MastraServer({
      app,
      mastra,
    });

    let server: ReturnType<typeof serve> | undefined;

    try {
      // Register context middleware first (sets mastra, requestContext, etc. in context)
      mastraServer.registerContextMiddleware();

      // Register custom API routes from Mastra config
      // MastraServer.init() only registers SERVER_ROUTES, not custom routes
      const serverConfig = mastra.getServer();
      const routes = serverConfig?.apiRoutes;
      if (routes) {
        for (const route of routes) {
          const handler = 'handler' in route ? route.handler : await route.createHandler({ mastra });
          if (route.method === 'ALL') {
            app.all(route.path, handler);
          } else {
            app.on(route.method, route.path, handler);
          }
        }
      }

      // Register built-in API routes
      await mastraServer.registerRoutes();

      // Start HTTP server
      server = serve({
        fetch: app.fetch,
        port,
      });

      // Wait for server to be ready
      await waitForServer(baseUrl);
    } catch (err) {
      // Clean up server if it was started before the error
      if (server) {
        await closeServer(server);
      }
      throw err;
    }

    console.log(`[Setup] Test server (${variant}) started on ${baseUrl}`);

    // Provide context to tests
    project.provide('baseUrl', baseUrl);
    project.provide('port', port);

    // Return teardown function
    // Capture server reference in closure to ensure proper cleanup
    const serverToClose = server;
    return async () => {
      console.log(`[Teardown] Stopping test server (${variant})`);
      await closeServer(serverToClose);
    };
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    baseUrl: string;
    port: number;
  }
}
