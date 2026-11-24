import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { setTimeout } from 'node:timers/promises';
import { command, sanitizedEnvironment, templateCopy } from './template.js';

/** Build and serve fixtures without reading the developer's .env or sharing build output. */
export async function fixtureServer(
  fixture: string,
  environment: NodeJS.ProcessEnv,
  credential: string,
  mode: 'development' | 'built' = 'development',
) {
  const listener = createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const address = listener.address();
  if (!address || typeof address === 'string') throw new Error('No fixture port');
  await new Promise<void>(resolve => listener.close(() => resolve()));
  const copy = await templateCopy();
  const env = { ...sanitizedEnvironment(), ...environment, BILLING_PORT: String(address.port) };
  let cleanup = copy.cleanup;
  try {
    if (mode === 'built') await command(copy.root, ['run', 'build', '--', '--dir', `tests/fixtures/${fixture}`], env);
    const child = spawn(
      process.execPath,
      mode === 'built'
        ? ['.mastra/output/index.mjs']
        : ['scripts/mastra.mjs', 'dev', '--dir', `tests/fixtures/${fixture}`],
      { cwd: copy.root, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let output = '';
    const capture = (chunk: Buffer) => {
      output = (output + String(chunk)).slice(-64000);
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    let failure: Error | undefined;
    child.once('error', error => {
      failure = error;
    });
    const closed = new Promise<void>(resolve => child.once('close', () => resolve()));
    let closing: Promise<void> | undefined;
    const close = () =>
      (closing ??= (async () => {
        try {
          if (child.pid) {
            try {
              process.kill(-child.pid, 'SIGTERM');
            } catch {
              /* Already stopped. */
            }
            await Promise.race([closed, setTimeout(3000)]);
            try {
              process.kill(-child.pid!, 'SIGKILL');
            } catch {
              /* Already stopped. */
            }
          }
          await closed;
        } finally {
          await copy.cleanup();
        }
      })());
    cleanup = close;
    const url = `http://127.0.0.1:${address.port}`;
    const deadline = AbortSignal.timeout(60000);
    while (!deadline.aborted) {
      if (failure) throw failure;
      if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Fixture server exited: ${output}`);
      try {
        const response = await fetch(`${url}/billing/context`, {
          headers: { authorization: `Bearer ${credential}` },
          signal: AbortSignal.any([deadline, AbortSignal.timeout(1000)]),
        });
        await response.body?.cancel();
        if (response.status === 200) return { url, close };
      } catch {
        /* Wait for the real server. */
      }
      await setTimeout(100);
    }
    throw new Error(`Fixture did not serve configured billing routes: ${output}`);
  } catch (error) {
    await cleanup();
    throw error;
  }
}
