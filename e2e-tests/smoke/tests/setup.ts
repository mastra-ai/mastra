import type { TestProject } from 'vitest/node';
import { execa } from 'execa';
import getPort from 'get-port';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rm } from 'node:fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectDir = join(__dirname, '..');

async function waitForServer(baseUrl: string, maxAttempts = 60): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${baseUrl}/api/workflows`);
      if (res.ok) {
        return;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Server at ${baseUrl} did not respond within ${maxAttempts * 500}ms`);
}

export default async function setup(project: TestProject) {
  const port = await getPort();
  const baseUrl = `http://localhost:${port}`;

  // Step 1: Build
  console.log('[smoke] Running mastra build...');
  await execa('npx', ['mastra', 'build'], {
    cwd: projectDir,
    stdio: 'inherit',
  });
  console.log('[smoke] Build complete.');

  // Step 2: Start server
  console.log(`[smoke] Starting mastra server on port ${port}...`);
  const serverProc = execa('npx', ['mastra', 'start'], {
    cwd: projectDir,
    env: {
      ...process.env,
      PORT: port.toString(),
    },
    stdio: 'pipe',
  });

  // Log server output for debugging
  serverProc.stdout?.on('data', (data: Buffer) => {
    console.log(`[mastra] ${data.toString().trim()}`);
  });
  serverProc.stderr?.on('data', (data: Buffer) => {
    console.error(`[mastra:err] ${data.toString().trim()}`);
  });

  // Step 3: Wait for server readiness
  try {
    await waitForServer(baseUrl);
  } catch (err) {
    serverProc.kill('SIGTERM');
    throw err;
  }

  console.log(`[smoke] Server ready at ${baseUrl}`);

  // Step 4: Provide baseUrl to tests
  project.provide('baseUrl', baseUrl);

  // Step 5: Return teardown
  return async () => {
    console.log('[smoke] Tearing down...');
    serverProc.kill('SIGTERM');

    // Wait briefly for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Clean up build output and database
    await rm(join(projectDir, '.mastra'), { recursive: true, force: true }).catch(() => {});
    await rm(join(projectDir, 'test.db'), { force: true }).catch(() => {});
    await rm(join(projectDir, 'test.db-journal'), { force: true }).catch(() => {});
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    baseUrl: string;
  }
}
