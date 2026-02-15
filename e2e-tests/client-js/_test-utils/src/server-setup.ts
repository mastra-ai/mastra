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
      { LibSQLStore, LibSQLVector },
      { MastraServer },
      { registerApiRoute },
      { Observability, DefaultExporter },
      { Memory },
      { createWorkflow, createStep },
      { createTool },
      { z },
    ] = await Promise.all([
      import('@mastra/core/mastra'),
      import('@mastra/core/agent'),
      import('@mastra/libsql'),
      import('@mastra/hono'),
      import('@mastra/core/server'),
      import('@mastra/observability'),
      import('@mastra/memory'),
      import('@mastra/core/workflows'),
      import('@mastra/core/tools'),
      import('zod'),
    ]);

    const port = await getPort();
    const baseUrl = `http://localhost:${port}`;

    // Create storage
    const storage = new LibSQLStore({
      id: storageId,
      url: ':memory:',
    });

    // Create vector store (use file-based temp db because libsql vector extensions
    // may not work reliably with :memory: for cross-operation queries)
    const { randomUUID } = await import('crypto');
    const { tmpdir } = await import('os');
    const { join } = await import('path');
    const vectorDbPath = `file:${join(tmpdir(), `mastra-vector-${randomUUID()}.db`)}`;
    const testVector = new LibSQLVector({
      id: `${storageId}-vector`,
      url: vectorDbPath,
    });

    // Create memory backed by the same storage
    const memory = new Memory({ storage });

    // Create test tools
    const calculatorTool = createTool({
      id: 'calculator',
      description: 'Adds two numbers together',
      inputSchema: z.object({ a: z.number(), b: z.number() }),
      outputSchema: z.object({ result: z.number() }),
      execute: async ({ a, b }) => {
        return { result: a + b };
      },
    });

    const greeterTool = createTool({
      id: 'greeter',
      description: 'Greets a person by name',
      inputSchema: z.object({ name: z.string() }),
      outputSchema: z.object({ greeting: z.string() }),
      execute: async ({ name }) => {
        return { greeting: `Hello, ${name}!` };
      },
    });

    // Create a simple workflow (add two numbers, no LLM needed)
    const addStep = createStep({
      id: 'add-numbers',
      inputSchema: z.object({ a: z.number(), b: z.number() }),
      outputSchema: z.object({ result: z.number() }),
      execute: async ({ inputData }) => {
        return { result: inputData.a + inputData.b };
      },
    });

    const addWorkflow = createWorkflow({
      id: 'add-workflow',
      inputSchema: z.object({ a: z.number(), b: z.number() }),
      outputSchema: z.object({ result: z.number() }),
      steps: [addStep],
    });

    addWorkflow.then(addStep).commit();

    // Create a simple test agent with memory and tools
    const testAgent = new Agent({
      id: 'testAgent',
      name: 'testAgent',
      instructions: 'You are a helpful test assistant.',
      model: 'openai/gpt-4.1-mini',
      memory,
      tools: { calculator: calculatorTool, greeter: greeterTool },
    });

    // Create Mastra instance with observability configured
    const mastra = new Mastra({
      agents: { testAgent },
      storage,
      vectors: { testVector },
      workflows: { 'add-workflow': addWorkflow },
      tools: { calculator: calculatorTool, greeter: greeterTool },
      observability: new Observability({
        configs: {
          default: {
            serviceName,
            exporters: [
              // Use realtime strategy for tests to ensure spans are persisted immediately
              // (default batch strategy has 5 second flush interval which is too slow for tests)
              new DefaultExporter({ strategy: 'realtime' }),
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
              const memoryStore = await storage.getStore('memory');
              if (memoryStore) {
                await memoryStore.dangerouslyClearAll();
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
      // Clean up temp vector database file
      try {
        const { unlink } = await import('fs/promises');
        const vectorFilePath = vectorDbPath.replace('file:', '');
        await unlink(vectorFilePath).catch(() => {});
        await unlink(`${vectorFilePath}-wal`).catch(() => {});
        await unlink(`${vectorFilePath}-shm`).catch(() => {});
      } catch {
        // ignore cleanup errors
      }
    };
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    baseUrl: string;
    port: number;
  }
}
