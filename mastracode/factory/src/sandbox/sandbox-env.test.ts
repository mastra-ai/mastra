import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { setupMarkerContent } from '@internal/workspace';
import { LocalSandbox } from '@mastra/core/workspace';
import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import { runSetupCommand } from '../integrations/github/sandbox.js';
import { createFactorySecretEncryption } from '../secret-encryption.js';
import { SandboxEnvsStorage } from '../storage/domains/sandbox-envs/base.js';
import {
  attachSandboxEnvRefresh,
  cachedSandboxEnvRevision,
  resolveSandboxEnv,
  sandboxBuildContext,
} from './sandbox-env.js';
import { createSessionSetupHook } from './session-sandbox.js';

const ORG = 'org-1';
const PROJECT = 'proj-1';
const SCOPE = { orgId: ORG, projectId: PROJECT };

async function makeStore() {
  const backend = new LibSQLFactoryStorage({ id: 'sandbox-env-wiring-test', url: ':memory:' });
  const store = backend.registerDomain(
    new SandboxEnvsStorage(createFactorySecretEncryption({ primary: { id: 'v1', key: new Uint8Array(32).fill(3) } })),
  );
  await backend.init();
  onTestFinished(() => backend.close());
  return store;
}

describe('sandbox env on a real LocalSandbox', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'factory-sandbox-env-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  /** Construct and attach the way `workspace.ts` does: resolve first, then attach before anything else writes env. */
  async function attached(store: SandboxEnvsStorage, options: { env?: Record<string, string> } = {}) {
    const initial = await resolveSandboxEnv(store, SCOPE);
    const sandbox = new LocalSandbox({ workingDirectory: dir, isolation: 'none', ...options });
    onTestFinished(() => sandbox._destroy());
    attachSandboxEnvRefresh(sandbox, {
      initial,
      revision: async () => (await store.revisions(ORG, PROJECT))?.revision ?? '',
      load: () => resolveSandboxEnv(store, SCOPE),
    });
    return sandbox;
  }

  const print = async (sandbox: LocalSandbox, name: string) =>
    (await sandbox.executeCommand('sh', ['-c', `printf %s "$${name}"`])).stdout;

  it('applies, edits and deletes runtime variables on the next command', async () => {
    const store = await makeStore();
    await store.set(ORG, PROJECT, { name: 'FOO', value: 'one', appliesTo: 'runtime' }, 'u');
    const sandbox = await attached(store);

    expect(await print(sandbox, 'FOO')).toBe('one');
    await store.set(ORG, PROJECT, { name: 'FOO', value: 'two', appliesTo: 'runtime' }, 'u');
    expect(await print(sandbox, 'FOO')).toBe('two');
    await store.set(ORG, PROJECT, { name: 'BAR', value: 'added', appliesTo: 'both' }, 'u');
    expect(await print(sandbox, 'BAR')).toBe('added');
    await store.delete(ORG, PROJECT, 'FOO');
    expect(await print(sandbox, 'FOO')).toBe('');
    expect(sandbox.getEnv()).not.toHaveProperty('FOO');
  });

  it('keeps Build-only variables out of runtime commands', async () => {
    const store = await makeStore();
    await store.set(ORG, PROJECT, { name: 'BUILD_ONLY', value: 'secret-build', appliesTo: 'build' }, 'u');
    const sandbox = await attached(store);

    expect(await print(sandbox, 'BUILD_ONLY')).toBe('');
    await store.set(ORG, PROJECT, { name: 'BUILD_ONLY', value: 'secret-build-2', appliesTo: 'build' }, 'u');
    expect(await print(sandbox, 'BUILD_ONLY')).toBe('');
    expect(JSON.stringify(sandbox.getEnv())).not.toContain('secret-build');
  });

  it('gives a background process the edited value', async () => {
    const store = await makeStore();
    await store.set(ORG, PROJECT, { name: 'FOO', value: 'one', appliesTo: 'runtime' }, 'u');
    const sandbox = await attached(store);
    await print(sandbox, 'FOO');

    await store.set(ORG, PROJECT, { name: 'FOO', value: 'background', appliesTo: 'runtime' }, 'u');
    const handle = await sandbox.processes!.spawn('printf %s "$FOO"');
    await handle.wait();
    expect(handle.stdout).toBe('background');
  });

  it('runs the command with the last applied env when a refresh fails', async () => {
    const store = await makeStore();
    await store.set(ORG, PROJECT, { name: 'FOO', value: 'one', appliesTo: 'runtime' }, 'u');
    const initial = await resolveSandboxEnv(store, SCOPE);
    const sandbox = new LocalSandbox({ workingDirectory: dir, isolation: 'none' });
    onTestFinished(() => sandbox._destroy());
    const onError = vi.fn();
    attachSandboxEnvRefresh(sandbox, {
      initial: { ...initial, revision: 'stale' },
      revision: () => Promise.reject(new Error('storage unavailable')),
      load: () => resolveSandboxEnv(store, SCOPE),
      onError,
    });

    expect(await print(sandbox, 'FOO')).toBe('one');
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'storage unavailable' }));
  });

  it("keeps Factory's own GH_TOKEN across refreshes", async () => {
    const store = await makeStore();
    await store.set(ORG, PROJECT, { name: 'FOO', value: 'one', appliesTo: 'runtime' }, 'u');
    const sandbox = await attached(store);
    sandbox.setEnv(env => ({ ...env, GH_TOKEN: 'factory-token' }));

    await store.set(ORG, PROJECT, { name: 'FOO', value: 'two', appliesTo: 'runtime' }, 'u');
    expect(await print(sandbox, 'FOO')).toBe('two');
    await store.delete(ORG, PROJECT, 'FOO');
    expect(await print(sandbox, 'GH_TOKEN')).toBe('factory-token');
  });

  it('restores a host env value when the Factory variable shadowing it is deleted', async () => {
    const store = await makeStore();
    await store.set(ORG, PROJECT, { name: 'HOST_ONLY', value: 'factory', appliesTo: 'runtime' }, 'u');
    const sandbox = await attached(store, { env: { HOST_ONLY: 'host' } });

    expect(await print(sandbox, 'HOST_ONLY')).toBe('factory');
    await store.delete(ORG, PROJECT, 'HOST_ONLY');
    expect(await print(sandbox, 'HOST_ONLY')).toBe('host');
    // Shadowed again by a later add, restored again by its delete.
    await store.set(ORG, PROJECT, { name: 'HOST_ONLY', value: 'factory-2', appliesTo: 'both' }, 'u');
    expect(await print(sandbox, 'HOST_ONLY')).toBe('factory-2');
    await store.delete(ORG, PROJECT, 'HOST_ONLY');
    expect(await print(sandbox, 'HOST_ONLY')).toBe('host');
  });

  it('picks up an edit made between resolving and constructing on the first command', async () => {
    const store = await makeStore();
    await store.set(ORG, PROJECT, { name: 'FOO', value: 'resolved', appliesTo: 'runtime' }, 'u');
    const initial = await resolveSandboxEnv(store, SCOPE);
    await store.set(ORG, PROJECT, { name: 'FOO', value: 'edited', appliesTo: 'runtime' }, 'u');

    const sandbox = new LocalSandbox({ workingDirectory: dir, isolation: 'none' });
    onTestFinished(() => sandbox._destroy());
    attachSandboxEnvRefresh(sandbox, {
      initial,
      revision: async () => (await store.revisions(ORG, PROJECT))?.revision ?? '',
      load: () => resolveSandboxEnv(store, SCOPE),
    });
    expect(await print(sandbox, 'FOO')).toBe('edited');
  });

  it('runs commands from the onStart hook with the current runtime env', async () => {
    const store = await makeStore();
    await store.set(ORG, PROJECT, { name: 'FOO', value: 'resolved', appliesTo: 'runtime' }, 'u');
    const initial = await resolveSandboxEnv(store, SCOPE);
    await store.set(ORG, PROJECT, { name: 'FOO', value: 'at-start', appliesTo: 'runtime' }, 'u');
    let seen: string | undefined;
    const sandbox = new LocalSandbox({
      workingDirectory: dir,
      isolation: 'none',
      onStart: async ({ sandbox: started }) => {
        seen = (await started.executeCommand!('sh', ['-c', 'printf %s "$FOO"'])).stdout;
      },
    });
    onTestFinished(() => sandbox._destroy());
    attachSandboxEnvRefresh(sandbox, {
      initial,
      revision: async () => (await store.revisions(ORG, PROJECT))?.revision ?? '',
      load: () => resolveSandboxEnv(store, SCOPE),
    });

    await sandbox._start();
    expect(seen).toBe('at-start');
  });

  it('shares one refresh between concurrent commands', async () => {
    const store = await makeStore();
    await store.set(ORG, PROJECT, { name: 'FOO', value: 'one', appliesTo: 'runtime' }, 'u');
    const initial = await resolveSandboxEnv(store, SCOPE);
    await store.set(ORG, PROJECT, { name: 'FOO', value: 'two', appliesTo: 'runtime' }, 'u');
    const sandbox = new LocalSandbox({ workingDirectory: dir, isolation: 'none' });
    onTestFinished(() => sandbox._destroy());
    const load = vi.fn(() => resolveSandboxEnv(store, SCOPE));
    attachSandboxEnvRefresh(sandbox, {
      initial,
      revision: async () => (await store.revisions(ORG, PROJECT))?.revision ?? '',
      load,
    });

    const outputs = await Promise.all([print(sandbox, 'FOO'), print(sandbox, 'FOO'), print(sandbox, 'FOO')]);
    expect(outputs).toEqual(['two', 'two', 'two']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  describe('Factory-run setup and setup markers', () => {
    const SETUP = 'printenv PROOF_BUILD > setup-saw.txt';

    const hookFor = (store: SandboxEnvsStorage) =>
      createSessionSetupHook(
        async (sb: WorkspaceSandbox, workdir, gate) => {
          await sb.executeCommand!('sh', ['-c', 'mkdir -p repo/.git']);
          if (gate.setupDone) return;
          const { build } = await resolveSandboxEnv(store, SCOPE);
          await runSetupCommand(sb as Parameters<typeof runSetupCommand>[0], workdir, SETUP, build);
          await gate.markSetupDone();
        },
        'sess-env',
        'acme/repo',
        SETUP,
      );

    it('gives setup the Build variables through the command only, never the runtime env', async () => {
      const store = await makeStore();
      await store.set(ORG, PROJECT, { name: 'PROOF_BUILD', value: 'build-value', appliesTo: 'build' }, 'u');
      const initial = await resolveSandboxEnv(store, SCOPE);
      const sandbox = new LocalSandbox({ workingDirectory: dir, isolation: 'none', onStart: hookFor(store) });
      onTestFinished(() => sandbox._destroy());
      attachSandboxEnvRefresh(sandbox, {
        initial,
        revision: async () => (await store.revisions(ORG, PROJECT))?.revision ?? '',
        load: () => resolveSandboxEnv(store, SCOPE),
      });

      await sandbox._start();
      const saw = await fs.readFile(path.join(dir, 'repo', 'setup-saw.txt'), 'utf8');
      expect(saw.trim()).toBe('build-value');
      expect(sandbox.getEnv()).not.toHaveProperty('PROOF_BUILD');
      expect(await print(sandbox, 'PROOF_BUILD')).toBe('');
    });

    it('skips setup, and so the Build variables, when the setup marker matches', async () => {
      const store = await makeStore();
      await store.set(ORG, PROJECT, { name: 'PROOF_BUILD', value: 'build-value', appliesTo: 'build' }, 'u');
      // What a warm template leaves behind.
      await fs.mkdir(path.join(dir, 'repo/.git'), { recursive: true });
      await fs.mkdir(path.join(dir, '.mastra-factory'), { recursive: true });
      await fs.mkdir(path.join(dir, '.mastra-sandbox'));
      await fs.writeFile(path.join(dir, '.mastra-sandbox/setup'), setupMarkerContent(SETUP));
      const sandbox = new LocalSandbox({ workingDirectory: dir, isolation: 'none', onStart: hookFor(store) });
      onTestFinished(() => sandbox._destroy());

      await sandbox._start();
      await expect(fs.stat(path.join(dir, 'repo/.git'))).resolves.toBeDefined();
      await expect(fs.stat(path.join(dir, 'repo', 'setup-saw.txt'))).rejects.toThrow();
    });
  });
});

describe('cachedSandboxEnvRevision', () => {
  it('reads storage at most once a second per Factory', async () => {
    const revisions = vi.fn(async () => ({ revision: 'r1', buildRevision: 'b1' }));
    const store = { revisions };
    let now = 0;
    const read = () => cachedSandboxEnvRevision(store, SCOPE, () => now);

    expect(await read()).toBe('r1');
    now = 999;
    await read();
    expect(revisions).toHaveBeenCalledTimes(1);
    now = 1000;
    await read();
    expect(revisions).toHaveBeenCalledTimes(2);
    await cachedSandboxEnvRevision(store, { orgId: ORG, projectId: 'other' }, () => now);
    expect(revisions).toHaveBeenCalledTimes(3);
  });

  it('never caches a failed read', async () => {
    const revisions = vi
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue({ revision: 'r2', buildRevision: '' });
    const store = { revisions };
    await expect(cachedSandboxEnvRevision(store, SCOPE, () => 0)).rejects.toThrow('down');
    await Promise.resolve();
    expect(await cachedSandboxEnvRevision(store, SCOPE, () => 0)).toBe('r2');
  });
});

describe('sandboxBuildContext', () => {
  it('carries Build variables and their revision, and nothing without them', () => {
    expect(sandboxBuildContext(undefined)).toEqual({});
    expect(sandboxBuildContext({ runtime: { A: 'a' }, build: {}, revision: 'r', buildRevision: 'b' })).toEqual({});
    expect(sandboxBuildContext({ runtime: {}, build: { B: 'b' }, revision: 'r', buildRevision: 'rev-b' })).toEqual({
      buildEnv: { B: 'b' },
      buildEnvRevision: 'rev-b',
    });
  });
});
