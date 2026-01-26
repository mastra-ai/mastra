/**
 * Test utilities for InngestAgent tests
 *
 * All tests share the same Inngest infrastructure. The workflow reconstructs
 * tools/model from Mastra at runtime by looking up the agent via agentId,
 * so test isolation is achieved through unique agent IDs and run IDs
 * rather than separate Inngest apps.
 */
import crypto from 'node:crypto';
import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import { realtimeMiddleware } from '@inngest/realtime/middleware';
import { Mastra } from '@mastra/core/mastra';
import { createHonoServer } from '@mastra/deployer/server';
import { DefaultStorage } from '@mastra/libsql';
import { Inngest } from 'inngest';

import { serve as inngestServe } from '../index';

export const INNGEST_PORT = 4000;
export const HANDLER_PORT = 4001;

// =============================================================================
// Shared Test Infrastructure
// =============================================================================

/** Shared state for all tests - initialized once in beforeAll */
let sharedInngest: Inngest | null = null;
let sharedMastra: Mastra | null = null;
let sharedServer: ServerType | null = null;

/**
 * Generate unique test ID to isolate each test.
 * Uses a short UUID for readability in logs.
 */
export function generateTestId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * Get the shared Inngest client.
 * All tests use the same Inngest client since workflow state is isolated by runId/agentId.
 */
export function getSharedInngest(): Inngest {
  if (!sharedInngest) {
    sharedInngest = new Inngest({
      id: 'durable-agent-tests',
      baseUrl: `http://localhost:${INNGEST_PORT}`,
      middleware: [realtimeMiddleware()],
    });
  }
  return sharedInngest;
}

/**
 * Get the shared Mastra instance.
 * @throws Error if called before setupSharedTestInfrastructure()
 */
export function getSharedMastra(): Mastra {
  if (!sharedMastra) {
    throw new Error('Shared Mastra not initialized. Call setupSharedTestInfrastructure() first.');
  }
  return sharedMastra;
}

/**
 * Wait for Inngest to sync with the app.
 */
export async function waitForInngestSync(ms = 500): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Initialize shared test infrastructure.
 * Call this once in beforeAll for the test suite.
 */
export async function setupSharedTestInfrastructure(): Promise<void> {
  // Create shared Inngest client
  const inngest = getSharedInngest();

  // Create the shared workflow
  const { createInngestDurableAgenticWorkflow } = await import('../durable-agent/create-inngest-agentic-workflow');
  const workflow = createInngestDurableAgenticWorkflow({ inngest });

  // Create shared Mastra instance with the workflow pre-registered
  // This is required because Inngest reads workflows at serve() time
  sharedMastra = new Mastra({
    storage: new DefaultStorage({
      id: 'shared-test-storage',
      url: ':memory:',
    }),
    workflows: {
      [workflow.id]: workflow,
    },
    server: {
      apiRoutes: [
        {
          path: '/inngest/api',
          method: 'ALL',
          createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
        },
      ],
    },
  });

  // Create and start shared server
  const app = await createHonoServer(sharedMastra);
  sharedServer = serve({
    fetch: app.fetch,
    port: HANDLER_PORT,
  });

  // Wait for Inngest to sync
  await waitForInngestSync(1000);
}

/**
 * Teardown shared test infrastructure.
 * Call this once in afterAll for the test suite.
 */
export async function teardownSharedTestInfrastructure(): Promise<void> {
  if (sharedServer) {
    await new Promise<void>(resolve => {
      sharedServer!.close(() => resolve());
    });
    sharedServer = null;
  }
  sharedMastra = null;
  sharedInngest = null;
}

// =============================================================================
// Compatibility API
// =============================================================================

/**
 * Test setup result containing everything needed to run a test.
 */
export interface TestSetup {
  mastra: Mastra;
  cleanup: () => Promise<void>;
}
