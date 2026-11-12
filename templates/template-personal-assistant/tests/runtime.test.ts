import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { isolatedEnv, json } from './helpers';

const root = fileURLToPath(new URL('..', import.meta.url));

/** Reserve and release a loopback port for an isolated CLI runtime instance. */
async function availablePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  await new Promise<void>(resolve => server.close(() => resolve()));
  return address.port;
}

async function run(directory: string, command: string, env: NodeJS.ProcessEnv) {
  const child = spawn(process.execPath, ['scripts/run.mjs', command], {
    cwd: directory,
    env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => {
    output += chunk;
  });
  child.stderr.on('data', chunk => {
    output += chunk;
  });
  const exited = once(child, 'exit');
  return {
    child,
    exited,
    output: () => output,
    /** Stop the isolated CLI process group and escalate only if its graceful shutdown stalls. */
    async stop() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      process.kill(-child.pid!, 'SIGTERM');
      const timeout = setTimeout(() => {
        try {
          process.kill(-child.pid!, 'SIGKILL');
        } catch {}
      }, 10000);
      try {
        await exited;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

/** Wait for an authenticated CLI server using the token persisted by that runtime. */
async function waitForServer(url: string, process: Awaited<ReturnType<typeof run>>, directory: string) {
  for (let attempt = 0; attempt < 240; attempt++) {
    if (process.child.exitCode !== null) throw new Error(`Runtime exited before startup: ${process.output()}`);
    try {
      const response = await fetch(`${url}/api/agents`, {
        headers: { authorization: `Bearer ${await readFile(join(directory, 'state/owner-token'), 'utf8')}` },
      });
      if (response.ok) return await response.json();
    } catch {}
    await delay(250);
  }
  throw new Error(`Runtime startup timed out: ${process.output()}`);
}

test(
  'dev and built start preserve the same physical database and .env configuration',
  { timeout: 240000 },
  async () => {
    // Use a clean checkout copy so this check never edits a developer's .env or personal database.
    const directory = await mkdtemp(join(tmpdir(), 'personal-assistant-runtime-'));
    let runtime: Awaited<ReturnType<typeof run>> | undefined;
    const env: NodeJS.ProcessEnv = {
      ...isolatedEnv(),
      MASTRA_TELEMETRY_DISABLED: '1',
      MASTRA_BUILD_SKIP_INSTALL: '1',
      npm_config_offline: 'true',
    };
    delete env.ASSISTANT_DATA_DIR;
    delete env.OPENAI_API_KEY;
    for (const name of [
      'MASTRA_PROJECT_ID',
      'MASTRA_PLATFORM_ACCESS_TOKEN',
      'MASTRA_PLATFORM_SECRET_KEY',
      'ASSISTANT_CONNECT_PROVIDERS',
      'ASSISTANT_CONNECT_TOOLS',
    ])
      delete env[name];
    try {
      for (const name of ['src', 'scripts', 'package.json', 'tsconfig.json', '.env.example']) {
        await cp(join(root, name), join(directory, name), { recursive: true });
      }
      await symlink(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir');
      const setup = spawn(process.execPath, ['scripts/setup.mjs'], { cwd: directory, env });
      assert.equal((await once(setup, 'exit'))[0], 0);
      assert.match(await readFile(join(directory, '.env'), 'utf8'), /OPENAI_API_KEY=/);
      const configuration = 'OPENAI_API_KEY=example-key\nASSISTANT_OWNER_ID=smoke-owner\nASSISTANT_DATA_DIR=state\n';
      await writeFile(join(directory, '.env'), configuration);
      const setupAgain = spawn(process.execPath, ['scripts/setup.mjs'], { cwd: directory, env });
      assert.equal((await once(setupAgain, 'exit'))[0], 0);
      assert.equal(await readFile(join(directory, '.env'), 'utf8'), configuration);

      let url = `http://127.0.0.1:${await availablePort()}`;
      runtime = await run(directory, 'dev', { ...env, PORT: new URL(url).port });
      const agents = await waitForServer(url, runtime, directory);
      const token = await readFile(join(directory, 'state/owner-token'), 'utf8');
      const headers = { authorization: `Bearer ${token}` };
      assert.equal((await stat(join(directory, 'state/owner-token'))).mode & 0o777, 0o600);
      assert.equal((await fetch(`${url}/api/agents`)).status, 401);
      assert.equal(agents['personal-assistant'].id, 'personal-assistant');
      assert.equal(agents['personal-assistant'].supportsMemory, true);
      assert.equal(agents['personal-assistant'].modelId, 'gpt-6-luna');
      assert.deepEqual(Object.keys(agents['personal-assistant'].tools).sort(), [
        'connection_status',
        'objective',
        'schedule',
        'task_check',
        'task_complete',
        'task_update',
        'task_write',
      ]);
      const status = await json(
        await fetch(`${url}/api/agents/personal-assistant/tools/connection-status/execute`, {
          method: 'POST',
          headers: { ...headers, 'content-type': 'application/json' },
          body: JSON.stringify({ data: {} }),
        }),
      );
      assert.equal(status.state, 'unconfigured');
      const studio = await fetch(url);
      assert.equal(studio.status, 200);
      assert.match(await studio.text(), /<html/i);
      const query = '?agentId=personal-assistant';
      const created = await json(
        await fetch(`${url}/api/memory/threads${query}`, {
          method: 'POST',
          headers: { ...headers, 'content-type': 'application/json' },
          body: JSON.stringify({
            threadId: 'runtime-thread',
            resourceId: 'ignored-client-owner',
            title: 'Runtime persistence',
          }),
        }),
      );
      assert.equal(created.resourceId, 'smoke-owner');
      await json(
        await fetch(`${url}/api/memory/threads/runtime-thread/working-memory${query}`, {
          method: 'POST',
          headers: { ...headers, 'content-type': 'application/json' },
          body: JSON.stringify({ workingMemory: 'Prefer short morning plans.' }),
        }),
      );
      const database = await stat(join(directory, 'state/assistant.db'));
      await runtime.stop();
      runtime = undefined;

      const build = await run(directory, 'build', env);
      const buildTimeout = setTimeout(() => {
        void build.stop();
      }, 120000);
      try {
        assert.equal((await build.exited)[0], 0, build.output());
      } finally {
        clearTimeout(buildTimeout);
      }
      url = `http://127.0.0.1:${await availablePort()}`;
      runtime = await run(directory, 'start', { ...env, PORT: new URL(url).port });
      await waitForServer(url, runtime, directory);
      assert.equal(await readFile(join(directory, 'state/owner-token'), 'utf8'), token);
      const restored = await json(await fetch(`${url}/api/memory/threads/runtime-thread${query}`, { headers }));
      assert.equal(restored.title, 'Runtime persistence');
      assert.equal(restored.resourceId, 'smoke-owner');
      const working = await json(
        await fetch(`${url}/api/memory/threads/runtime-thread/working-memory${query}`, { headers }),
      );
      assert.match(working.workingMemory, /Prefer short morning plans/);
      assert.equal((await stat(join(directory, 'state/assistant.db'))).ino, database.ino);
      await assert.rejects(stat(join(directory, '.mastra/output/.data/assistant.db')), {
        code: 'ENOENT',
      });
      await assert.rejects(stat(join(directory, '.data/assistant.db')), { code: 'ENOENT' });
    } finally {
      await runtime?.stop();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
