import { it, describe, expect, beforeAll, inject } from 'vitest';
import { join } from 'path';
import { setupMonorepo } from './prepare';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import getPort from 'get-port';
import { execa } from 'execa';
import { timeout, activeProcesses, removeOutputDir } from './helpers';

describe.sequential.for([['pnpm'] as const])(`%s monorepo`, ([pkgManager]) => {
  beforeAll(() => {
    process.env.pnpm_config_registry = inject('registry');
  });

  describe.sequential('Studio control route authentication', () => {
    it(
      'keeps Studio control routes public during development when server auth is configured',
      async () => {
        const isolatedFixturePath = await mkdtemp(join(tmpdir(), `mastra-monorepo-studio-auth-test-${pkgManager}-`));
        const port = await getPort();
        const controller = new AbortController();
        let proc: ReturnType<typeof execa> | undefined;

        try {
          await setupMonorepo(isolatedFixturePath, pkgManager);

          const corePath = join(isolatedFixturePath, 'apps', 'custom', 'node_modules', '@mastra', 'core', 'dist');
          await mkdir(join(corePath, 'runtime-context'), { recursive: true });
          await writeFile(
            join(corePath, 'runtime-context', 'index.js'),
            `export { RequestContext as RuntimeContext } from '../request-context/index.js';`,
          );

          const mastraConfigPath = join(isolatedFixturePath, 'apps', 'custom', 'src', 'mastra', 'index.ts');
          const originalMastraConfig = await readFile(mastraConfigPath, 'utf-8');
          const authenticatedMastraConfig = originalMastraConfig
            .replace(
              "import { ConsoleLogger } from '@mastra/core/logger';",
              "import { ConsoleLogger } from '@mastra/core/logger';\nimport { SimpleAuth } from '@mastra/core/server';",
            )
            .replace(
              'server: {',
              "server: {\n    auth: new SimpleAuth({ tokens: { 'test-token': { sub: 'test-user' } } }),",
            );
          await writeFile(mastraConfigPath, authenticatedMastraConfig);

          proc = execa('npm', ['run', 'dev'], {
            cwd: join(isolatedFixturePath, 'apps', 'custom'),
            cancelSignal: controller.signal,
            gracefulCancel: true,
            env: {
              OPENAI_API_KEY: process.env.OPENAI_API_KEY,
              MASTRA_PORT: port.toString(),
            },
          });
          activeProcesses.push({ controller, proc });

          await new Promise<void>((resolve, reject) => {
            proc!.stderr?.on('data', data => {
              const errMsg = data?.toString();
              if (errMsg?.includes('punycode') || errMsg?.includes('falling back to an in-memory store')) {
                return;
              }
              reject(new Error('failed to start authenticated Studio dev server: ' + errMsg));
            });
            proc!.stdout?.on('data', data => {
              console.log(data?.toString());
              if (data?.toString()?.includes(`http://localhost:${port}`)) {
                resolve();
              }
            });
          });

          for (const [path, method] of [
            ['/refresh-events', 'GET'],
            ['/__refresh', 'POST'],
            ['/__hot-reload-status', 'GET'],
          ] as const) {
            const response = await fetch(`http://localhost:${port}${path}`, { method });
            expect(response.status).toBe(200);
            await response.body?.cancel();
          }
        } finally {
          if (proc) {
            try {
              proc.kill('SIGKILL');
              await Promise.race([proc.catch(() => {}), new Promise(resolve => setTimeout(resolve, 5_000))]);
            } catch (err) {
              // @ts-expect-error - killed is not typed
              if (!err.killed) {
                console.log('failed to kill authenticated Studio dev proc', err);
              }
            }
          }
          await new Promise(resolve => setTimeout(resolve, 1_000));
          await removeOutputDir(isolatedFixturePath);
          await rm(isolatedFixturePath, { recursive: true, force: true });
        }
      },
      timeout,
    );
  });

  describe.sequential('Browser stream route authentication', () => {
    /**
     * Browser stream routes are registered outside the route-registration pipeline,
     * and a browser cannot set an Authorization header on a WebSocket handshake, so
     * this drives the real upgrade path rather than a plain fetch.
     * Resolves to whether the handshake reached an open connection.
     */
    function canOpenWebSocket(url: string): Promise<boolean> {
      const WebSocketCtor = (
        globalThis as {
          WebSocket?: new (url: string) => {
            close: () => void;
            addEventListener: (type: 'open' | 'error' | 'close', listener: () => void) => void;
          };
        }
      ).WebSocket;

      if (!WebSocketCtor) {
        throw new Error('This test requires a global WebSocket implementation');
      }

      return new Promise((resolve, reject) => {
        const socket = new WebSocketCtor(url);
        const timer = setTimeout(() => {
          socket.close();
          reject(new Error(`Timed out waiting for WebSocket handshake result from ${url}`));
        }, 10_000);

        const settle = (opened: boolean) => {
          clearTimeout(timer);
          socket.close();
          resolve(opened);
        };

        socket.addEventListener('open', () => settle(true));
        socket.addEventListener('error', () => settle(false));
        socket.addEventListener('close', () => settle(false));
      });
    }

    it(
      'requires authentication for browser stream routes when server auth is configured',
      async () => {
        const isolatedFixturePath = await mkdtemp(join(tmpdir(), `mastra-monorepo-browser-auth-test-${pkgManager}-`));
        const port = await getPort();
        const controller = new AbortController();
        let proc: ReturnType<typeof execa> | undefined;

        try {
          await setupMonorepo(isolatedFixturePath, pkgManager);

          const corePath = join(isolatedFixturePath, 'apps', 'custom', 'node_modules', '@mastra', 'core', 'dist');
          await mkdir(join(corePath, 'runtime-context'), { recursive: true });
          await writeFile(
            join(corePath, 'runtime-context', 'index.js'),
            `export { RequestContext as RuntimeContext } from '../request-context/index.js';`,
          );

          const mastraConfigPath = join(isolatedFixturePath, 'apps', 'custom', 'src', 'mastra', 'index.ts');
          const originalMastraConfig = await readFile(mastraConfigPath, 'utf-8');
          const authenticatedMastraConfig = originalMastraConfig
            .replace(
              "import { ConsoleLogger } from '@mastra/core/logger';",
              "import { ConsoleLogger } from '@mastra/core/logger';\nimport { SimpleAuth } from '@mastra/core/server';",
            )
            .replace(
              'server: {',
              "server: {\n    auth: new SimpleAuth({ tokens: { 'test-token': { sub: 'test-user' } } }),\n    cors: { origin: 'https://studio.example.com' },",
            );
          await writeFile(mastraConfigPath, authenticatedMastraConfig);

          proc = execa('npm', ['run', 'dev'], {
            cwd: join(isolatedFixturePath, 'apps', 'custom'),
            cancelSignal: controller.signal,
            gracefulCancel: true,
            env: {
              OPENAI_API_KEY: process.env.OPENAI_API_KEY,
              MASTRA_PORT: port.toString(),
            },
          });
          activeProcesses.push({ controller, proc });

          await new Promise<void>((resolve, reject) => {
            proc!.stderr?.on('data', data => {
              const errMsg = data?.toString();
              if (errMsg?.includes('punycode') || errMsg?.includes('falling back to an in-memory store')) {
                return;
              }
              reject(new Error('failed to start authenticated browser stream dev server: ' + errMsg));
            });
            proc!.stdout?.on('data', data => {
              console.log(data?.toString());
              if (data?.toString()?.includes(`http://localhost:${port}`)) {
                resolve();
              }
            });
          });

          const agentId = 'browser-agent';
          const baseUrl = `http://localhost:${port}`;

          for (const [path, method] of [
            [`/api/agents/${agentId}/browser/session?threadId=thread-1`, 'GET'],
            [`/api/agents/${agentId}/browser/close`, 'POST'],
          ] as const) {
            const response = await fetch(`${baseUrl}${path}`, { method });
            expect(response.status, `${method} ${path}`).toBe(401);
            await response.body?.cancel();
          }

          // The upgrade path is not under the API prefix, so it needs its own gate.
          const unauthenticatedUpgrade = await fetch(`${baseUrl}/browser/${agentId}/stream?threadId=thread-1`);
          expect(unauthenticatedUpgrade.status, 'GET /browser/:agentId/stream').toBe(401);
          await unauthenticatedUpgrade.body?.cancel();

          // A configured CORS origin also gates the upgrade: browsers attach the
          // session cookie to a handshake from any origin, so a disallowed origin is
          // refused before auth runs.
          const disallowedOriginUpgrade = await fetch(`${baseUrl}/browser/${agentId}/stream?threadId=thread-1`, {
            headers: { Origin: 'https://evil.example.com' },
          });
          expect(disallowedOriginUpgrade.status, 'GET /browser/:agentId/stream (disallowed origin)').toBe(403);
          await disallowedOriginUpgrade.body?.cancel();

          const allowedOriginUpgrade = await fetch(`${baseUrl}/browser/${agentId}/stream?threadId=thread-1`, {
            headers: { Origin: 'https://studio.example.com' },
          });
          expect(allowedOriginUpgrade.status, 'GET /browser/:agentId/stream (allowed origin)').toBe(401);
          await allowedOriginUpgrade.body?.cancel();

          // A Studio served by this server connects back to its own host, and that
          // origin is never part of a CORS allowlist, so it must reach auth rather
          // than be refused by the origin gate.
          const sameOriginUpgrade = await fetch(`${baseUrl}/browser/${agentId}/stream?threadId=thread-1`, {
            headers: { Origin: baseUrl },
          });
          expect(sameOriginUpgrade.status, 'GET /browser/:agentId/stream (same origin)').toBe(401);
          await sameOriginUpgrade.body?.cancel();

          for (const [label, headers] of [
            ['Authorization header', { Authorization: 'Bearer test-token' }],
            ['session cookie', { Cookie: 'mastra-token=test-token' }],
          ] as const) {
            const response = await fetch(`${baseUrl}/api/agents/${agentId}/browser/session?threadId=thread-1`, {
              headers,
            });
            expect(response.status, label).toBe(200);
            await response.body?.cancel();
          }

          // A WebSocket handshake cannot carry an Authorization header, so the token
          // has to travel as a query param for non-cookie providers. Node's WebSocket
          // sends no Origin header, so the configured allowlist does not apply here.
          await expect(canOpenWebSocket(`${baseUrl}/browser/${agentId}/stream?threadId=thread-1`)).resolves.toBe(false);
          await expect(
            canOpenWebSocket(`${baseUrl}/browser/${agentId}/stream?threadId=thread-1&apiKey=test-token`),
          ).resolves.toBe(true);
        } finally {
          if (proc) {
            try {
              proc.kill('SIGKILL');
              await Promise.race([proc.catch(() => {}), new Promise(resolve => setTimeout(resolve, 5_000))]);
            } catch (err) {
              // @ts-expect-error - killed is not typed
              if (!err.killed) {
                console.log('failed to kill authenticated browser stream dev proc', err);
              }
            }
          }
          await new Promise(resolve => setTimeout(resolve, 1_000));
          await removeOutputDir(isolatedFixturePath);
          await rm(isolatedFixturePath, { recursive: true, force: true });
        }
      },
      timeout,
    );
  });
});
