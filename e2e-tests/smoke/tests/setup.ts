import type { TestProject } from 'vitest/node';
import { execa } from 'execa';
import getPort from 'get-port';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, rm, writeFile } from 'node:fs/promises';

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
  const port = await getPort({ host: '0.0.0.0' });
  const baseUrl = `http://127.0.0.1:${port}`;

  // Step 1: Build
  const mastraBin = join(projectDir, 'node_modules', '.bin', 'mastra');
  console.log('[smoke] Running mastra build...');
  await execa(mastraBin, ['build'], {
    cwd: projectDir,
    stdio: 'pipe',
  });
  console.log('[smoke] Build complete.');

  // Step 2: Create workspace fixture files (mastra start cwd = .mastra/output/)
  const outputDir = join(projectDir, '.mastra', 'output');
  const wsDir = join(outputDir, 'test-workspace');
  const skillDir = join(wsDir, 'skills', 'test-skill');
  const refDir = join(skillDir, 'references');
  await mkdir(refDir, { recursive: true });
  await writeFile(join(wsDir, 'hello.txt'), 'Hello from workspace!');
  await writeFile(
    join(skillDir, 'SKILL.md'),
    [
      '---',
      'name: test-skill',
      'description: A test skill for smoke tests',
      '---',
      '',
      '# Test Skill',
      '',
      'This skill is used for smoke testing the workspace skills API.',
    ].join('\n'),
  );
  await writeFile(join(refDir, 'example.md'), '# Example Reference\n\nSome reference content.');

  console.log(`[smoke] Starting mastra server on port ${port}...`);
  const serverProc = execa(mastraBin, ['start'], {
    cwd: projectDir,
    env: {
      ...process.env,
      PORT: port.toString(),
      MASTRA_HOST: '0.0.0.0',
      NODE_ENV: 'production',
    },
    stdio: 'pipe',
  });

  // Suppress unhandled rejection from execa when we kill the process
  serverProc.catch(() => {});

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

    // Wait for the process to actually exit before cleaning up files
    await new Promise<void>(resolve => {
      const timeout = setTimeout(resolve, 5000);
      serverProc.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    // Clean up database (may be in project root or .mastra/output depending on cwd)
    await rm(join(projectDir, 'test.db'), { force: true }).catch(() => {});
    await rm(join(projectDir, 'test.db-journal'), { force: true }).catch(() => {});
    await rm(join(projectDir, '.mastra', 'output', 'test.db'), { force: true }).catch(() => {});
    await rm(join(projectDir, '.mastra', 'output', 'test.db-journal'), { force: true }).catch(() => {});
    // Clean up workspace test directory
    await rm(wsDir, { recursive: true, force: true }).catch(() => {});
    // Note: we keep .mastra/output/ to avoid rebuilding on next run
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    baseUrl: string;
  }
}
