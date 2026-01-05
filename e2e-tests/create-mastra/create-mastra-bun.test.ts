import { it, describe, expect, beforeAll, afterAll, inject } from 'vitest';
import { join } from 'path';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import getPort from 'get-port';
import { existsSync } from 'fs';
import { execa, execaSync } from 'execa';

// Skip these tests if Bun is not available
const bunAvailable = (() => {
  try {
    execaSync('bun', ['--version']);
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!bunAvailable)('bun create mastra', () => {
  let fixturePath: string;
  let projectPath: string;

  beforeAll(
    async () => {
      const tag = inject('tag');
      const registry = inject('registry');

      console.log('registry', registry);
      console.log('tag', tag);

      fixturePath = await mkdtemp(join(tmpdir(), 'mastra-bun-create-test-'));
      projectPath = join(fixturePath, 'project');
      process.env.npm_config_registry = registry;

      // Use bun create instead of pnpm dlx
      await execa(
        'bun',
        ['create', `mastra@${tag}`, '-c', 'agents,tools,workflows,scorers', '-l', 'openai', '-e', 'project'],
        {
          cwd: fixturePath,
          env: {
            npm_config_registry: registry,
          },
          stdio: ['inherit', 'inherit', 'inherit'],
        },
      );
    },
    10 * 60 * 1000,
  );

  afterAll(async () => {
    try {
      await rm(fixturePath, {
        force: true,
        recursive: true,
      });
    } catch {}
  });

  it('folder should exist', async () => {
    expect(existsSync(join(projectPath, 'src', 'mastra', 'index.ts'))).toBe(true);
  });

  it('should have @mastra/server installed (Bun workaround)', async () => {
    // The Bun workaround should have installed @mastra/server explicitly
    const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf-8'));
    expect(packageJson.dependencies['@mastra/server']).toBeDefined();
  });

  describe('dev with bun', () => {
    let port: number;
    let proc: ReturnType<typeof execa> | undefined;

    beforeAll(
      async () => {
        port = await getPort();
        // Run dev using bun
        proc = execa('bun', ['run', 'dev'], {
          cwd: projectPath,
          env: {
            PORT: port.toString(),
          },
        });

        await new Promise<void>((resolve, reject) => {
          console.log('waiting for server to start with bun');
          proc!.stderr?.on('data', data => {
            const output = data?.toString() ?? '';
            console.error(output);
            const errorPatterns = ['Error', 'ERR', 'failed', 'ENOENT', 'MODULE_NOT_FOUND'];
            if (errorPatterns.some(pattern => output.toLowerCase().includes(pattern.toLowerCase()))) {
              reject(new Error('failed to start dev with bun: ' + data?.toString()));
            }
          });
          proc!.stdout?.on('data', data => {
            console.log(data?.toString());
            if (data?.toString()?.includes(`http://localhost:${port}`)) {
              resolve();
            }
          });
        });
      },
      60 * 10 * 1000,
    );

    afterAll(async () => {
      if (proc) {
        proc.kill();
      }
    });

    it(
      'should open playground',
      {
        timeout: 60 * 1000,
      },
      async () => {
        const response = await fetch(`http://localhost:${port}`);
        expect(response.status).toBe(200);
      },
    );

    it(
      'should fetch agents',
      {
        timeout: 60 * 1000,
      },
      async () => {
        const response = await fetch(`http://localhost:${port}/api/agents`);
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data['weather-agent']).toBeDefined();
      },
    );
  });
});
