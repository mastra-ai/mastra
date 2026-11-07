import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { request } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { diagnostic, loadSettings } from '../src/config/settings.js';
import { initializeStorage, startLocalServer } from '../src/http/server.js';
import {
  buildLocalImage,
  dockerClient,
  OWNER_LABEL,
  ownerIdentity,
  preflight,
  reconcileOwnedSandboxes,
  releaseImage,
  RUN_LABEL,
  type ImageReceipt,
} from '../src/runtime/docker.js';
import { probeSandbox } from '../src/runtime/sandbox.js';
import { setup } from '../src/runtime/setup.js';
import { prepareDataDirectory } from '../src/runtime/files.js';
import { SECCOMP_POLICY_SHA256 } from '../src/runtime/seccomp.js';

const templateRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const roots: string[] = [];
const executeFile = promisify(execFile);

async function requestWithHost(url: string, host: string) {
  return new Promise<number | undefined>((resolve, reject) => {
    const outgoing = request(url, { headers: { host }, timeout: 5000 }, response => {
      response.resume();
      response.once('end', () => resolve(response.statusCode));
    });
    outgoing.once('error', reject);
    outgoing.once('timeout', () => outgoing.destroy(new Error('HTTP host probe timed out')));
    outgoing.end();
  });
}

/** Run the real setup CLI with isolated settings and retain its bounded diagnostic outcome. */
async function runSetupCli(root: string) {
  try {
    const output = await executeFile(
      process.execPath,
      ['--env-file-if-exists=.env', '--import', import.meta.resolve('tsx'), join(templateRoot, 'scripts/setup.ts')],
      { cwd: root, env: { PATH: process.env.PATH }, timeout: 30000, maxBuffer: 8192 },
    );
    return { code: 0, ...output };
  } catch (error) {
    const result = error as { code: number; stdout: string; stderr: string };
    return { code: result.code, stdout: result.stdout, stderr: result.stderr };
  }
}

async function isolatedRoot() {
  const root = await mkdtemp(join(tmpdir(), 'security-scanner-runtime-'));
  roots.push(root);
  await cp(join(templateRoot, 'docker'), join(root, 'docker'), { recursive: true });
  await cp(join(templateRoot, 'src'), join(root, 'src'), { recursive: true });
  await cp(join(templateRoot, 'scripts/runtime'), join(root, 'scripts/runtime'), { recursive: true });
  return root;
}

async function parentFingerprints(parent = resolve(templateRoot, '../..')) {
  return Promise.all(
    ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].map(async name => {
      try {
        const content = await readFile(resolve(parent, name));
        return createHash('sha256').update(content).digest('hex');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
    }),
  );
}

/** Remove the exact test-owned image only after its consumers have stopped. */
async function cleanOwnedTestImage(settings: ReturnType<typeof loadSettings>) {
  const client = dockerClient(settings);
  try {
    const image = await client.getImage(settings.DOCKER_DISCOVERY_IMAGE).inspect();
    if (image.Config.Labels?.[OWNER_LABEL] === ownerIdentity(settings)) {
      await client.getImage(image.Id).remove({ force: false, noprune: true });
    }
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode !== 404) throw error;
  }
}

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe('real local runtime', () => {
  it('rejects unsupported discovery platforms before contacting Docker or writing runtime data', async () => {
    const root = await mkdtemp(join(tmpdir(), 'scanner-unsupported-platform-'));
    roots.push(root);
    const settings = loadSettings(
      {
        DOCKER_PLATFORM: 'linux/amd64',
        DOCKER_SOCKET: join(root, 'absent-docker.sock'),
        SCANNER_DISCOVERY_ENABLED: 'false',
      },
      root,
    );
    await expect(setup(settings)).rejects.toMatchObject({
      code: 'DISCOVERY_PLATFORM_UNSUPPORTED',
      message: expect.stringContaining('linux/arm64'),
    });
    expect(await readdir(root)).toEqual([]);
  });

  it('checks parent isolation in standalone folders and preserves filesystem errors', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'scanner-standalone-parent-'));
    roots.push(parent);
    expect(await parentFingerprints(parent)).toEqual([null, null, null]);
    await writeFile(join(parent, 'package.json'), '{"private":true}');
    expect(await parentFingerprints(parent)).toEqual([
      createHash('sha256').update('{"private":true}').digest('hex'),
      null,
      null,
    ]);
    await mkdir(join(parent, 'pnpm-lock.yaml'));
    await expect(parentFingerprints(parent)).rejects.toMatchObject({ code: 'EISDIR' });
  });

  it('setup_builds_local_runtime_and_cleans_owned_sandbox', async () => {
    const root = await isolatedRoot();
    const settings = loadSettings({ DOCKER_RETAIN_SHARED_BASE_IMAGE: 'true' }, root);
    const client = dockerClient(settings);
    const parentBefore = await parentFingerprints();
    let receipt: ImageReceipt | undefined;
    let unrelated: Awaited<ReturnType<typeof client.createContainer>> | undefined;
    let stale: Awaited<ReturnType<typeof client.createContainer>> | undefined;
    try {
      const first = await setup(settings);
      receipt = first;
      expect(first.source).toContain('@sha256:');
      expect(first.imageId).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(first.sizeBytes).toBeGreaterThan(0);
      expect(first.environment.platform).toBe(settings.DOCKER_PLATFORM);
      expect(first.sandbox).toMatchObject({
        imageId: first.imageId,
        user: '10001:10001',
        network: 'none',
        privileged: false,
        memoryLimitBytes: 1024 * 1024 * 1024,
        memorySwapBytes: 1024 * 1024 * 1024,
        cpuQuota: 100000,
        cpuPeriod: 100000,
        pidsLimit: 256,
        privateFileMode: 0o600,
        privateFileReadable: true,
        browserSandboxEnabled: true,
        browserSandboxStatus: { layer1: 'namespace', pidNamespaces: true, networkNamespaces: true, seccompBpf: true },
        appliedPolicySha256: SECCOMP_POLICY_SHA256,
        streamedBytes: 131072,
        outputTruncated: true,
        katanaVersion: '1.8.0',
      });
      expect(first.sandbox.capDrop).toContain('ALL');
      expect(first.sandbox.noNewPrivileges).toBe(true);
      expect(first.sandbox.retainedOutputBytes).toBeLessThanOrEqual(settings.OUTPUT_LIMIT_BYTES);
      expect(first.sandbox.memoryUsageBytes).toBeGreaterThan(0);
      expect(first.sandbox.mounts?.['/tmp']).toContain('size=134217728');
      await expect(client.getContainer(first.sandbox.containerId).inspect()).rejects.toMatchObject({ statusCode: 404 });
      expect((await lstat(settings.imageReceiptPath)).mode & 0o777).toBe(0o600);
      expect((await lstat(settings.databasePath)).mode & 0o777).toBe(0o600);
      expect((await lstat(settings.mastraDatabasePath)).mode & 0o777).toBe(0o600);

      unrelated = await client.createContainer({
        Image: first.imageId,
        Cmd: ['sleep', 'infinity'],
        NetworkDisabled: true,
        Labels: { 'test.unrelated': randomUUID() },
      });
      stale = await client.createContainer({
        Image: first.imageId,
        Cmd: ['sleep', 'infinity'],
        NetworkDisabled: true,
        Labels: { [OWNER_LABEL]: ownerIdentity(settings), [RUN_LABEL]: `security-scanner-probe-${randomUUID()}` },
      });
      const second = await setup({ ...settings, DOCKER_RETAIN_SHARED_BASE_IMAGE: false });
      expect(second.imageId).toBe(first.imageId);
      expect(second.imageDisposition).toBe('in-use');
      await expect(client.getContainer(second.sandbox.containerId).inspect()).rejects.toMatchObject({
        statusCode: 404,
      });
      expect((await unrelated.inspect()).Id).toBe(unrelated.id);
      await expect(stale.inspect()).rejects.toMatchObject({ statusCode: 404 });
      stale = undefined;

      expect(await parentFingerprints()).toEqual(parentBefore);
      // Image labels are inherited by unrelated consumers; only the preserved sentinel may remain.
      const remaining = await client.listContainers({
        all: true,
        filters: { label: [`${OWNER_LABEL}=${ownerIdentity(settings)}`] },
      });
      expect(remaining.map(container => container.Id)).toEqual([unrelated.id]);
    } finally {
      await stale?.remove({ force: true, v: false });
      await unrelated?.remove({ force: true, v: false });
      await reconcileOwnedSandboxes(settings);
      if (receipt) await releaseImage({ ...settings, DOCKER_RETAIN_SHARED_BASE_IMAGE: false }, receipt);
      else await cleanOwnedTestImage(settings);
    }
  }, 1_200_000);

  it('local_http_workers_and_file_storage_restart_without_execution', async () => {
    const root = await isolatedRoot();
    const settings = loadSettings({}, root);
    const initialized = await initializeStorage(settings);
    try {
      await initialized.mastra.shutdown();
    } finally {
      await initialized.storage.close();
    }
    // A public SDK store write must survive worker/listener shutdown and a new runtime instance.
    const built = await import(pathToFileURL(join(templateRoot, 'dist/src/mastra/index.js')).href);
    const persisted = built.createMastra(settings) as ReturnType<typeof import('../src/mastra/index.js').createMastra>;
    try {
      await persisted.storage.init();
      const memory = await persisted.storage.getStore('memory');
      if (!memory) throw new Error('Native memory store unavailable');
      const now = new Date();
      await memory.saveThread({
        thread: {
          id: 'runtime-persistence',
          resourceId: 'local-operator',
          title: 'Runtime persistence',
          createdAt: now,
          updatedAt: now,
        },
      });
    } finally {
      await persisted.mastra.shutdown();
      await persisted.storage.close();
    }

    const server = await startLocalServer(settings, 0);
    const url = server.url;
    try {
      const memory = await server.storage.getStore('memory');
      expect(
        await memory?.getThreadById({ threadId: 'runtime-persistence', resourceId: 'local-operator' }),
      ).toMatchObject({ title: 'Runtime persistence' });
      const response = await fetch(`${url}/api/runtime`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        status: 'diagnostics-only',
        scanningEnabled: false,
        discoveryRequested: false,
        nativeExecutionEnabled: false,
      });
      for (const path of ['/native/agents', '/native/workflows', '/native/openapi.json', '/api/targets']) {
        expect((await fetch(`${url}${path}`)).status).toBe(403);
        expect(
          (
            await fetch(`${url}${path}`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: '{}',
            })
          ).status,
        ).toBe(403);
      }
      expect((await fetch(`${url}/api/runtime`, { headers: { origin: 'https://external.example' } })).status).toBe(403);
      expect(await requestWithHost(`${url}/api/runtime`, 'external.example')).toBe(403);
    } finally {
      await server.close();
    }
    await expect(fetch(`${url}/api/runtime`)).rejects.toThrow();
  }, 60000);

  it('preflight_rejects_unsupported_runtime_without_side_effects', async () => {
    const root = await isolatedRoot();
    const before = await readdir(root);
    const secret = 'invalid-configuration-secret-marker';
    try {
      loadSettings({ SANDBOX_DRIVER: `unsupported-${secret}` }, root);
      throw new Error('Expected rejection');
    } catch (error) {
      expect(diagnostic(error)).toEqual({
        code: 'INVALID_CONFIGURATION',
        message: 'Check supported values for: SANDBOX_DRIVER.',
      });
      expect(JSON.stringify(diagnostic(error))).not.toContain(secret);
    }
    const settings = loadSettings({ DOCKER_SOCKET: join(root, 'missing-docker.sock') }, root);
    await expect(setup(settings)).rejects.toMatchObject({ code: 'DOCKER_UNAVAILABLE' });
    await expect(startLocalServer(settings, 0)).rejects.toMatchObject({ code: 'DOCKER_UNAVAILABLE' });
    expect(await readdir(root)).toEqual(before);
    await expect(preflight(settings)).rejects.toMatchObject({ code: 'DOCKER_UNAVAILABLE' });

    // Exercise the actual CLI and built-in .env loading only in an isolated operator directory.
    await writeFile(join(root, '.env'), `SANDBOX_DRIVER=unsupported-${secret}\nMORPH_API_KEY=${secret}\n`, {
      mode: 0o600,
    });
    const invalidCli = await runSetupCli(root);
    expect(invalidCli.code).toBe(1);
    expect(invalidCli.stdout).toBe('');
    expect(JSON.parse(invalidCli.stderr)).toEqual({
      code: 'INVALID_CONFIGURATION',
      message: 'Check supported values for: SANDBOX_DRIVER.',
    });
    expect(invalidCli.stderr).not.toContain(secret);
    await writeFile(join(root, '.env'), `DOCKER_SOCKET=${settings.DOCKER_SOCKET}\nMORPH_API_KEY=${secret}\n`, {
      mode: 0o600,
    });
    const unavailableCli = await runSetupCli(root);
    expect(unavailableCli.code).toBe(1);
    expect(unavailableCli.stdout).toBe('');
    expect(JSON.parse(unavailableCli.stderr)).toMatchObject({ code: 'DOCKER_UNAVAILABLE' });
    expect(unavailableCli.stderr).not.toContain(secret);
    expect((await readdir(root)).sort()).toEqual([...before, '.env'].sort());
  });

  it('cancelling_a_native_probe_awaits_owned_cleanup', async () => {
    const root = await isolatedRoot();
    const settings = loadSettings({ DOCKER_RETAIN_SHARED_BASE_IMAGE: 'true' }, root);
    let receipt: ImageReceipt | undefined;
    const client = dockerClient(settings);
    const controller = new AbortController();
    try {
      await prepareDataDirectory(settings);
      receipt = await buildLocalImage(settings);
      const pending = probeSandbox(settings, receipt, controller.signal);
      // Observe the real container boundary before cancellation, without mocking the provider.
      const observed = (async () => {
        const deadline = Date.now() + 30000;
        while (Date.now() < deadline) {
          const running = await client.listContainers({
            filters: { label: [`${OWNER_LABEL}=${ownerIdentity(settings)}`] },
          });
          if (running.length > 0) {
            controller.abort();
            return;
          }
          await new Promise(resolve => setTimeout(resolve, 25));
        }
        throw new Error('No owned running container observed before cancellation');
      })();
      const [probeResult, observation] = await Promise.allSettled([pending, observed]);
      expect(observation.status).toBe('fulfilled');
      expect(probeResult.status).toBe('rejected');
      expect(
        await client.listContainers({ all: true, filters: { label: [`${OWNER_LABEL}=${ownerIdentity(settings)}`] } }),
      ).toHaveLength(0);
    } finally {
      controller.abort();
      await reconcileOwnedSandboxes(settings);
      if (receipt) await releaseImage({ ...settings, DOCKER_RETAIN_SHARED_BASE_IMAGE: false }, receipt);
      else await cleanOwnedTestImage(settings);
    }
  }, 900_000);
});
