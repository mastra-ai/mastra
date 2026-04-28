/**
 * Test utilities for InngestAgent tests
 *
 * All tests share the same Inngest infrastructure. The workflow reconstructs
 * tools/model from Mastra at runtime by looking up the agent via agentId,
 * so test isolation is achieved through unique agent IDs and run IDs
 * rather than separate Inngest apps.
 */
import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import { realtimeMiddleware } from '@inngest/realtime/middleware';
import { Mastra } from '@mastra/core/mastra';
import { createHonoServer } from '@mastra/deployer/server';
import { DefaultStorage } from '@mastra/libsql';
import { Inngest } from 'inngest';

import { serve as inngestServe } from '../index';

export const INNGEST_PORT = 4100;
export const HANDLER_PORT = 4101;

// =============================================================================
// Shared Test Infrastructure
// =============================================================================

/** Shared state for all tests - initialized once in beforeAll */
let sharedInngest: Inngest | null = null;
let sharedMastra: Mastra | null = null;
let sharedServer: ServerType | null = null;
let inngestDevServer: ChildProcess | null = null;

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
 * Start the Inngest dev server using npx inngest-cli.
 * Returns a promise that resolves when the server is ready.
 */
async function startInngestDevServer(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const args = [
      'inngest-cli',
      'dev',
      '-p',
      String(INNGEST_PORT),
      '-u',
      `http://localhost:${HANDLER_PORT}/inngest/api`,
      '--poll-interval=1',
      '--no-discovery',
    ];

    const proc = spawn('npx', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    let started = false;
    const timeout = setTimeout(() => {
      if (!started) {
        proc.kill();
        reject(new Error('Inngest dev server failed to start within 30s'));
      }
    }, 30000);

    const checkOutput = (output: string) => {
      // Inngest dev server outputs JSON logs - look for the API server starting
      // Example: {"time":"...","level":"INFO","msg":"starting server","caller":"api","addr":"0.0.0.0:4100"}
      if (output.includes('"starting server"') && output.includes(`"addr":"0.0.0.0:${INNGEST_PORT}"`)) {
        if (!started) {
          started = true;
          clearTimeout(timeout);
          resolve(proc);
        }
      }
    };

    proc.stdout?.on('data', (data: Buffer) => {
      checkOutput(data.toString());
    });

    proc.stderr?.on('data', (data: Buffer) => {
      // JSON output often goes to stderr
      checkOutput(data.toString());
    });

    proc.on('error', err => {
      clearTimeout(timeout);
      reject(err);
    });

    proc.on('exit', code => {
      if (!started) {
        clearTimeout(timeout);
        reject(new Error(`Inngest dev server exited with code ${code}`));
      }
    });
  });
}

/**
 * Wait for Inngest dev server to be reachable.
 */
async function waitForInngestReady(maxAttempts = 30, intervalMs = 1000): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`http://localhost:${INNGEST_PORT}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Inngest dev server not ready after ${maxAttempts} attempts`);
}

/**
 * Initialize shared test infrastructure.
 * Call this once in beforeAll for the test suite.
 *
 * This starts the Inngest dev server using npx (no Docker required).
 */
export async function setupSharedTestInfrastructure(): Promise<void> {
  // Start Inngest dev server first (needs to be running before we create the app server)
  // Skip if INNGEST_DEV_EXTERNAL=true (for running against Docker or existing server)
  if (process.env.INNGEST_DEV_EXTERNAL !== 'true') {
    try {
      inngestDevServer = await startInngestDevServer();
      // Give it a moment to fully initialize
      await waitForInngestReady();
    } catch (error) {
      console.error('Failed to start Inngest dev server:', error);
      throw error;
    }
  }

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

  // Wait for Inngest to sync with our app
  await waitForInngestSync(2000);
}

/**
 * Teardown shared test infrastructure.
 * Call this once in afterAll for the test suite.
 */
export async function teardownSharedTestInfrastructure(): Promise<void> {
  // Stop the app server first
  if (sharedServer) {
    await new Promise<void>(resolve => {
      sharedServer!.close(() => resolve());
    });
    sharedServer = null;
  }

  // Stop the Inngest dev server
  if (inngestDevServer) {
    inngestDevServer.kill('SIGTERM');
    // Wait a bit for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 500));
    // Force kill if still running
    if (!inngestDevServer.killed) {
      inngestDevServer.kill('SIGKILL');
    }
    inngestDevServer = null;
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
