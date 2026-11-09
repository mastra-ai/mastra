import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  readlink,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { isolatedEnv, json } from './helpers';

const root = fileURLToPath(new URL('..', import.meta.url));

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

async function waitForServer(url: string, process: Awaited<ReturnType<typeof run>>) {
  for (let attempt = 0; attempt < 240; attempt++) {
    if (process.child.exitCode !== null) throw new Error(`Runtime exited before startup: ${process.output()}`);
    try {
      const response = await fetch(`${url}/api/agents`);
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
      for (const name of ['src', 'scripts', 'patches', 'package.json', 'tsconfig.json', '.env.example']) {
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
      const agents = await waitForServer(url, runtime);
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
          headers: { 'content-type': 'application/json' },
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
          headers: { 'content-type': 'application/json' },
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
          headers: { 'content-type': 'application/json' },
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
      await waitForServer(url, runtime);
      const restored = await json(await fetch(`${url}/api/memory/threads/runtime-thread${query}`));
      assert.equal(restored.title, 'Runtime persistence');
      assert.equal(restored.resourceId, 'smoke-owner');
      const working = await json(await fetch(`${url}/api/memory/threads/runtime-thread/working-memory${query}`));
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

const dependency = join(root, 'node_modules/@mastra/libsql');
const tool = join(root, 'node_modules/patch-package');
const patch = '@mastra+libsql+1.29.0.patch';

async function snapshot(directory: string) {
  const entries: Record<string, string> = {};
  async function walk(path: string, prefix = '') {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(join(path, entry.name), name);
      else if (entry.isSymbolicLink()) entries[name] = `symlink:${await readlink(join(path, entry.name))}`;
      else {
        assert.ok(entry.isFile(), `Expected regular dependency file ${name}.`);
        entries[name] = createHash('sha256')
          .update(await readFile(join(path, entry.name)))
          .digest('hex');
      }
    }
  }
  await walk(directory);
  return entries;
}

async function command(directory: string, args: string[], npm = false) {
  const child = spawn(npm ? 'npm' : process.execPath, args, {
    cwd: directory,
    env: isolatedEnv({ npm_config_offline: 'true', NO_COLOR: '1' }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => {
    output += chunk;
  });
  child.stderr.on('data', chunk => {
    output += chunk;
  });
  const timer = setTimeout(() => child.kill('SIGKILL'), 30000);
  try {
    const [code] = await once(child, 'exit');
    return { code, output };
  } finally {
    clearTimeout(timer);
  }
}

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'personal-assistant-installation-'));
  await mkdir(join(directory, 'scripts'));
  await mkdir(join(directory, 'patches'));
  await mkdir(join(directory, 'node_modules/@mastra'), { recursive: true });
  await cp(join(root, 'scripts/apply-libsql-patch.mjs'), join(directory, 'scripts/apply-libsql-patch.mjs'));
  await cp(join(root, 'patches', patch), join(directory, 'patches', patch));
  await cp(dependency, join(directory, 'node_modules/@mastra/libsql'), { recursive: true });
  await symlink(tool, join(directory, 'node_modules/patch-package'), 'dir');
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({
      private: true,
      scripts: { postinstall: 'node scripts/apply-libsql-patch.mjs' },
      dependencies: { '@mastra/libsql': 'latest', 'patch-package': '8.0.1' },
    }),
  );
  const reversed = await command(directory, [
    join(tool, 'index.js'),
    '--reverse',
    '--error-on-fail',
    '--patch-dir',
    'patches',
  ]);
  assert.equal(reversed.code, 0, reversed.output);
  return directory;
}

// Actual package bytes and actual patch-package execute in disposable copies; no filesystem/tool mock is used.
test(
  'installation reapplies the reviewed LibSQL patch and rejects unsupported state',
  { timeout: 120000 },
  async () => {
    const directory = await fixture();
    const packageRoot = join(directory, 'node_modules/@mastra/libsql');
    try {
      const original = await snapshot(packageRoot);
      const corrected = await snapshot(dependency);
      assert.equal(Object.keys(original).length, 126);
      const applied = await command(directory, ['run', 'postinstall', '--offline'], true);
      assert.equal(applied.code, 0, applied.output);
      assert.deepEqual(
        await snapshot(packageRoot),
        corrected,
        'The full package must match, including 122 untouched files.',
      );
      const timestamps = await Promise.all(
        Object.keys(corrected).map(async file => (await stat(join(packageRoot, file), { bigint: true })).mtimeNs),
      );
      const repeated = await command(directory, ['run', 'postinstall', '--offline'], true);
      assert.equal(repeated.code, 0, repeated.output);
      assert.match(repeated.output, /already verified/);
      assert.deepEqual(await snapshot(packageRoot), corrected);
      assert.deepEqual(
        await Promise.all(
          Object.keys(corrected).map(async file => (await stat(join(packageRoot, file), { bigint: true })).mtimeNs),
        ),
        timestamps,
      );
      const rollback = await command(directory, [
        join(tool, 'index.js'),
        '--reverse',
        '--error-on-fail',
        '--patch-dir',
        'patches',
      ]);
      assert.equal(rollback.code, 0, rollback.output);
      assert.deepEqual(await snapshot(packageRoot), original, 'Reverse restores exact original package bytes.');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }

    const cases: [string, (directory: string, packageRoot: string) => Promise<void>, RegExp][] = [
      [
        'version',
        async (_directory, packageRoot) => {
          const path = join(packageRoot, 'package.json');
          const metadata = JSON.parse(await readFile(path, 'utf8'));
          metadata.version = '1.29.1';
          await writeFile(path, JSON.stringify(metadata));
        },
        /Unsupported @mastra\/libsql version/,
      ],
      [
        'compiled drift',
        async (_directory, packageRoot) => {
          await writeFile(join(packageRoot, 'dist/index.js'), 'incompatible installed bytes');
        },
        /Unsupported LibSQL compiled bytes/,
      ],
      [
        'partial state',
        async (_directory, packageRoot) => {
          await cp(join(dependency, 'dist/index.js'), join(packageRoot, 'dist/index.js'));
        },
        /partial patch state/,
      ],
      [
        'payload drift',
        async directory => {
          await writeFile(join(directory, 'patches', patch), 'modified reviewed payload');
        },
        /patch payload changed/,
      ],
      [
        'extra patch',
        async directory => {
          await writeFile(join(directory, 'patches/unreviewed.patch'), 'unreviewed patch');
        },
        /only the reviewed LibSQL patch/,
      ],
      [
        'symlinked dist',
        async (_directory, packageRoot) => {
          await rename(join(packageRoot, 'dist'), join(packageRoot, 'original-dist'));
          await symlink(join(packageRoot, 'original-dist'), join(packageRoot, 'dist'), 'dir');
        },
        /regular package and dist directories/,
      ],
      [
        'non-directory dist',
        async (_directory, packageRoot) => {
          await rename(join(packageRoot, 'dist'), join(packageRoot, 'original-dist'));
          await writeFile(join(packageRoot, 'dist'), 'not a directory');
        },
        /regular package and dist directories/,
      ],
      [
        'symlinked payload',
        async directory => {
          await rename(join(directory, 'patches', patch), join(directory, 'original.patch'));
          await symlink(join(directory, 'original.patch'), join(directory, 'patches', patch));
        },
        /patch must be a regular file/,
      ],
      [
        'symlinked patch directory',
        async directory => {
          await rename(join(directory, 'patches'), join(directory, 'original-patches'));
          await symlink(join(directory, 'original-patches'), join(directory, 'patches'), 'dir');
        },
        /patch directory must be a regular directory/,
      ],
      [
        'tool version',
        async directory => {
          await rm(join(directory, 'node_modules/patch-package'));
          await mkdir(join(directory, 'node_modules/patch-package'));
          const metadata = JSON.parse(await readFile(join(tool, 'package.json'), 'utf8'));
          metadata.version = '8.0.2';
          await writeFile(join(directory, 'node_modules/patch-package/package.json'), JSON.stringify(metadata));
        },
        /requires patch-package 8.0.1/,
      ],
    ];
    for (const [name, corrupt, expected] of cases) {
      const directory = await fixture();
      const packageRoot = join(directory, 'node_modules/@mastra/libsql');
      try {
        await corrupt(directory, packageRoot);
        const before = await snapshot(packageRoot);
        const rejected = await command(directory, ['scripts/apply-libsql-patch.mjs']);
        assert.notEqual(rejected.code, 0, `${name}: ${rejected.output}`);
        assert.match(rejected.output, expected, name);
        const after = await snapshot(packageRoot);
        assert.deepEqual(after, before, `${name} must fail without package mutation.`);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }
  },
);

test('a real patch application failure leaves every dependency file unchanged', { timeout: 30000 }, async () => {
  const directory = await fixture();
  const packageRoot = join(directory, 'node_modules/@mastra/libsql');
  try {
    await writeFile(join(packageRoot, 'dist/index.js'), 'incompatible installed bundle');
    const before = await snapshot(packageRoot);
    const failed = await command(directory, [join(tool, 'index.js'), '--error-on-fail', '--patch-dir', 'patches']);
    assert.notEqual(failed.code, 0, failed.output);
    assert.match(failed.output, /Failed to apply patch|ERROR|could not be applied/i);
    assert.deepEqual(
      await snapshot(packageRoot),
      before,
      'Default atomic patch failure must not write even earlier applicable hunks.',
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
