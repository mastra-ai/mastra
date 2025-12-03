import { describe, it, expect, beforeAll, afterAll, inject } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import getPort from 'get-port';
import { existsSync } from 'node:fs';
import { execa } from 'execa';
import { execSync } from 'node:child_process';
import { waitForServer } from '../../_shared/utils/server-ready.js';
import { processManager } from '../../_shared/utils/cleanup.js';

describe('create mastra', () => {
  let fixturePath: string;
  let projectPath: string;

  beforeAll(
    async () => {
      const tag = inject('e2eTag');
      const registryUrl = inject('registryUrl');

      console.log('[create-mastra] Registry:', registryUrl);
      console.log('[create-mastra] Tag:', tag);

      fixturePath = await mkdtemp(join(tmpdir(), 'mastra-create-test-'));
      projectPath = join(fixturePath, 'project');

      process.env.npm_config_registry = registryUrl;

      execSync(`pnpm dlx create-mastra@${tag} -c agents,tools,workflows,scorers -l openai -e project`, {
        cwd: fixturePath,
        stdio: 'inherit',
      });
    },
    10 * 60 * 1000,
  );

  afterAll(async () => {
    try {
      await rm(fixturePath, { force: true, recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('folder should exist', async () => {
    expect(existsSync(join(projectPath, 'src', 'mastra', 'index.ts'))).toBe(true);
  });

  describe('dev', () => {
    let port: number;
    let proc: ReturnType<typeof execa> | undefined;

    beforeAll(
      async () => {
        port = await getPort();

        proc = execa('pnpm', ['dev'], {
          cwd: projectPath,
          env: {
            PORT: port.toString(),
          },
        });

        // Handle expected termination - don't let it bubble up as unhandled rejection
        proc.catch(err => {
          // Ignore termination signals - these are expected when we kill the process
          if (err.signal === 'SIGTERM' || err.signal === 'SIGKILL') {
            return;
          }
          throw err;
        });

        processManager.register({
          process: proc,
          name: 'create-mastra-dev',
        });

        // Use robust server wait
        await waitForServer({
          url: `http://localhost:${port}`,
          timeout: 60_000,
          onAttempt: attempt => {
            if (attempt % 10 === 0) {
              console.log(`[create-mastra] Waiting for dev server... attempt ${attempt}`);
            }
          },
        });
      },
      60 * 10 * 1000,
    );

    afterAll(async () => {
      if (proc) {
        proc.kill('SIGTERM');
        processManager.unregister(proc);
      }
    });

    it('should open playground', { timeout: 60 * 1000 }, async () => {
      const response = await fetch(`http://localhost:${port}`);
      expect(response.status).toBe(200);
    });

    it('should fetch agents', { timeout: 60 * 1000 }, async () => {
      const response = await fetch(`http://localhost:${port}/api/agents`);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body['weather-agent']).toBeDefined();
      expect(body['weather-agent'].name).toBe('Weather Agent');
      expect(body['weather-agent'].modelId).toBe('gpt-4o');
    });
  });
});
