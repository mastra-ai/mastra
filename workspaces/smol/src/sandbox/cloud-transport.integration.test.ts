import { once } from 'node:events';
import { createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { Machine } from 'smolmachines';
import { describe, expect, it } from 'vitest';
import { SmolSandbox } from './index';

const bridge = process.env.MASTRA_SMOL_CLOUD_BRIDGE === '1' ? describe : describe.skip;
async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

bridge('Smol Cloud transport through a real VM', () => {
  it('creates, streams, writes, reconnects, checkpoints and destroys', async () => {
    const guest = await Machine.create(
      { image: 'node:24-alpine', network: false },
      { target: 'local', handleSignals: false },
    );
    let vm: { id: string; name: string; state: string; ready: boolean } | undefined;
    let createBody: Record<string, unknown> | undefined;
    let deleted = false;
    const server = createServer(async (req, res) => {
      const url = req.url ?? '';
      const reply = (data: unknown, status = 200) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(status === 204 ? undefined : JSON.stringify(data));
      };
      try {
        if (req.headers.authorization !== 'Bearer test-token') return reply({ error: 'unauthorized' }, 401);
        if (req.method === 'GET' && url === '/v1/machines') return reply(vm && !deleted ? [vm] : []);
        if (req.method === 'POST' && url === '/v1/machines') {
          createBody = JSON.parse((await readBody(req)).toString());
          vm = { id: 'bridge-1', name: String(createBody?.name), state: 'started', ready: true };
          return reply(vm, 201);
        }
        if (req.method === 'GET' && url === '/v1/machines/bridge-1') return reply(vm);
        if (req.method === 'DELETE' && url === '/v1/machines/bridge-1') {
          deleted = true;
          await guest.delete();
          return reply(null, 204);
        }
        if (req.method === 'POST' && url === '/v1/machines/bridge-1/pause') {
          await guest.pause();
          vm!.state = 'paused';
          return reply(vm);
        }
        if (req.method === 'POST' && url === '/v1/machines/bridge-1/resume') {
          await guest.resume();
          vm!.state = 'started';
          return reply(vm);
        }
        if (req.method === 'POST' && url === '/v1/machines/bridge-1/checkpoints') {
          return reply({ id: 'ckpt-bridge-1', machineId: 'bridge-1', status: 'available', sizeBytes: 1 });
        }
        if (url.startsWith('/v1/machines/bridge-1/files/')) {
          const path = decodeURIComponent(url.slice('/v1/machines/bridge-1/files/'.length));
          if (req.method === 'PUT') {
            await guest.writeFile(path, await readBody(req));
            return reply(null, 204);
          }
        }
        if (req.method === 'POST' && url === '/v1/machines/bridge-1/exec') {
          const body = JSON.parse((await readBody(req)).toString()) as {
            command: string[];
            env?: Record<string, string>;
            cwd?: string;
          };
          const result = await guest.exec(body.command, { env: body.env, workdir: body.cwd ?? undefined });
          return reply({ exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr });
        }
        if (req.method === 'POST' && url === '/v1/machines/bridge-1/exec/stream') {
          const body = JSON.parse((await readBody(req)).toString()) as {
            command: string[];
            env?: Record<string, string>;
            cwd?: string;
          };
          res.writeHead(200, { 'content-type': 'text/event-stream' });
          for await (const event of guest.execStream(body.command, { env: body.env, workdir: body.cwd })) {
            const data =
              event.kind === 'exit'
                ? JSON.stringify({ exitCode: event.exitCode })
                : event.kind === 'error'
                  ? event.message
                  : event.data;
            res.write(
              `event: ${event.kind}\n${data
                .split('\n')
                .map(line => `data: ${line}`)
                .join('\n')}\n\n`,
            );
          }
          return res.end();
        }
        reply({ error: `${req.method} ${url}` }, 404);
      } catch (error) {
        res.destroy(error as Error);
      }
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No bridge address');
    const options = {
      id: `mastra-smol-bridge-${Date.now()}`,
      target: 'cloud' as const,
      image: 'node:24-alpine',
      cloud: { apiKey: 'test-token', baseUrl: `http://127.0.0.1:${address.port}` },
      allowHosts: ['registry.npmjs.org'],
    };
    const sandbox = new SmolSandbox(options);
    try {
      expect(await sandbox._start()).toMatchObject({ outcome: 'created' });
      expect(createBody?.source).toEqual({ type: 'image', reference: 'node:24-alpine' });
      expect(createBody?.network).toMatchObject({ hosts: ['registry.npmjs.org'] });
      const seen: string[] = [];
      const output = await sandbox.executeCommand('printf cloud; printf stderr >&2', [], {
        onStdout: chunk => seen.push(chunk),
      });
      expect(output).toMatchObject({ exitCode: 0, stdout: 'cloud', stderr: 'stderr' });
      expect(seen).toEqual(['cloud']);
      await sandbox.writeFiles([{ path: '/workspace/from-host.txt', content: 'uploaded', mode: 0o600 }]);
      expect((await sandbox.executeCommand('cat', ['/workspace/from-host.txt'])).stdout).toBe('uploaded');
      await sandbox.snapshot();
      expect(sandbox.checkpointInfo?.id).toBe('ckpt-bridge-1');
      await sandbox._stop();
      const attached = new SmolSandbox(options);
      expect(await attached._start()).toMatchObject({ outcome: 'connected' });
      expect((await attached.executeCommand('cat', ['/workspace/from-host.txt'])).stdout).toBe('uploaded');
      await attached._destroy();
      expect(deleted).toBe(true);
    } finally {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
      if (!deleted) await guest.delete();
    }
  }, 180_000);
});
