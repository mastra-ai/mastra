import type { TestProject } from 'vitest/node';
import { Mastra } from '@mastra/core/mastra';
import { Agent } from '@mastra/core/agent';
import { LibSQLStore } from '@mastra/libsql';
import { MastraServer } from '@mastra/hono';
import { registerApiRoute } from '@mastra/core/server';
import { Observability, DefaultExporter } from '@mastra/observability';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import getPort from 'get-port';

let server: ReturnType<typeof serve> | undefined;

export default async function setup(project: TestProject) {
  const port = await getPort();
  const baseUrl = `http://localhost:${port}`;

  // Create storage
  const storage = new LibSQLStore({
    id: 'client-sdk-e2e-storage',
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
          serviceName: 'client-sdk-e2e',
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

  await mastraServer.init();

  // Start HTTP server
  server = serve({
    fetch: app.fetch,
    port,
  });

  // Wait for server to be ready
  await waitForServer(baseUrl);

  console.log(`[Setup] Test server started on ${baseUrl}`);

  // Provide context to tests
  project.provide('baseUrl', baseUrl);
  project.provide('port', port);

  return async () => {
    console.log('[Teardown] Stopping test server');
    if (server) {
      server.close();
    }
  };
}

async function waitForServer(baseUrl: string, maxAttempts = 30): Promise<void> {
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

declare module 'vitest' {
  export interface ProvidedContext {
    baseUrl: string;
    port: number;
  }
}
