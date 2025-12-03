import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

/**
 * Durable Tests for VercelWorkflow
 *
 * These tests run with actual Vercel workflow durability by:
 * 1. Starting a Nitro dev server that compiles the "use workflow" and "use step" directives
 * 2. Making HTTP requests to trigger workflows
 * 3. Verifying the results
 *
 * This is similar to how Inngest tests work with Docker.
 */
describe.skip('VercelWorkflow (durable)', () => {
  let server: ChildProcess;
  const TEST_APP_DIR = path.join(__dirname, '..', 'test-app');
  const SERVER_URL = 'http://localhost:3000';

  async function waitForServer(url: string, maxAttempts = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(url);
        if (response.ok || response.status === 404) {
          // Server is up (404 is fine, just means no route at /)
          return;
        }
      } catch {
        // Server not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error(`Server at ${url} did not start within ${maxAttempts} seconds`);
  }

  beforeAll(async () => {
    // Install dependencies in test-app
    console.log('[setup] Installing test-app dependencies...');
    const install = spawn('pnpm', ['install'], {
      cwd: TEST_APP_DIR,
      stdio: 'inherit',
    });
    await new Promise<void>((resolve, reject) => {
      install.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`pnpm install failed with code ${code}`));
      });
    });

    // Start Nitro dev server
    console.log('[setup] Starting Nitro dev server...');
    server = spawn('npx', ['nitro', 'dev'], {
      cwd: TEST_APP_DIR,
      stdio: 'pipe',
    });

    server.stdout?.on('data', data => {
      console.log(`[nitro] ${data}`);
    });

    server.stderr?.on('data', data => {
      console.error(`[nitro:err] ${data}`);
    });

    // Wait for server to be ready
    await waitForServer(SERVER_URL);
    console.log('[setup] Server is ready');
  }, 60000); // 60 second timeout for setup

  afterAll(() => {
    if (server) {
      console.log('[teardown] Stopping Nitro server...');
      server.kill();
    }
  });

  it('should execute workflow with durability', async () => {
    const response = await fetch(`${SERVER_URL}/api/workflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflowId: 'test-workflow',
        runId: `test-run-${Date.now()}`,
        input: {},
      }),
    });

    expect(response.ok).toBe(true);
    const result = await response.json();

    console.log('[test] Result:', JSON.stringify(result, null, 2));

    expect(result.status).toBe('success');
    expect(result.steps.step1.status).toBe('success');
    expect(result.steps.step2.status).toBe('success');
  });

  it('should chain step outputs correctly', async () => {
    const response = await fetch(`${SERVER_URL}/api/workflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflowId: 'test-workflow',
        runId: `test-run-chain-${Date.now()}`,
        input: {},
      }),
    });

    expect(response.ok).toBe(true);
    const result = await response.json();

    // step2 should receive step1's output
    expect(result.steps.step1.output.value).toBe('step1-output');
    expect(result.steps.step2.output.value).toBe('step2-received-step1-output');
  });
});
