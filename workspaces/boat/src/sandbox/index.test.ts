/**
 * Boat Sandbox Provider Tests
 *
 * Tests Boat-specific behaviour against a fake Boat API, so the real
 * `@boatdev/sdk` client does the serialising:
 * - Constructor options, credential resolution and ID generation
 * - Acquisition (create / reattach / resume) and teardown
 * - Named snapshots as checkpoints, and forking
 * - File upload, preview URLs and instructions
 */

import { SandboxNotReadyError } from '@mastra/core/workspace';
import { beforeEach, describe, expect, it } from 'vitest';

import { createFakeBoatApi } from '../testing/fake-boat-api';
import type { FakeBoatApi } from '../testing/fake-boat-api';
import { BoatSandbox, BOAT_WORK_DIRECTORY, DEFAULT_BOAT_BASE_URL } from './index';
import type { BoatSandboxOptions } from './index';

let boat: FakeBoatApi;

const makeSandbox = (options: BoatSandboxOptions = {}) =>
  new BoatSandbox({ apiKey: 'sandbox_test_key', fetch: boat.fetch, ...options });

beforeEach(() => {
  boat = createFakeBoatApi();
});

describe('BoatSandbox', () => {
  describe('construction', () => {
    it('identifies itself as the boat provider', () => {
      const sandbox = makeSandbox();

      expect(sandbox.provider).toBe('boat');
      expect(sandbox.name).toBe('BoatSandbox');
      expect(sandbox.status).toBe('pending');
    });

    it('generates a unique id when none is given', () => {
      expect(makeSandbox().id).not.toBe(makeSandbox().id);
    });

    it('uses an explicit id as-is', () => {
      expect(makeSandbox({ id: 'my-sandbox' }).id).toBe('my-sandbox');
    });

    it('defaults the working directory to Boat’s work directory', () => {
      expect(makeSandbox().workingDirectory).toBe(BOAT_WORK_DIRECTORY);
    });

    it('lets an explicit working directory win', () => {
      expect(makeSandbox({ workingDirectory: '/home/user/app' }).workingDirectory).toBe('/home/user/app');
    });

    it('reads credentials from the environment when they are not passed', async () => {
      process.env.BOAT_API_KEY = 'sandbox_env_key';
      try {
        const sandbox = new BoatSandbox({ fetch: boat.fetch });
        await sandbox._start();

        expect(boat.requestsTo('POST', '/sandboxes')[0]?.authorization).toBe('Bearer sandbox_env_key');
      } finally {
        delete process.env.BOAT_API_KEY;
      }
    });

    it('reports checkpoint support, because Boat can save named snapshots', () => {
      expect(makeSandbox().supportsCheckpoints).toBe(true);
    });

    it('exposes Boat’s public API as the default base URL', () => {
      expect(DEFAULT_BOAT_BASE_URL).toBe('https://boat.dev/api/v1');
    });

    it('throws rather than returning a placeholder id before start', () => {
      expect(() => makeSandbox().boatSandboxId).toThrow(SandboxNotReadyError);
    });
  });

  describe('create', () => {
    it('provisions a sandbox and waits for it to be ready', async () => {
      const sandbox = makeSandbox();
      const result = await sandbox._start();

      expect(result).toEqual({ outcome: 'created' });
      expect(sandbox.status).toBe('running');
      expect(sandbox.boatSandboxId).toBe('bx_fake001');
    });

    it('omits ttlSeconds so Boat’s own auto-stop applies', async () => {
      await makeSandbox()._start();

      expect(boat.requestsTo('POST', '/sandboxes')[0]?.body).not.toHaveProperty('ttlSeconds');
    });

    it('sends null ttlSeconds when auto-stop is explicitly disabled', async () => {
      await makeSandbox({ ttlSeconds: null })._start();

      expect(boat.requestsTo('POST', '/sandboxes')[0]?.body).toMatchObject({ ttlSeconds: null });
    });

    it('passes machine size, env, setup script and isolation through', async () => {
      await makeSandbox({
        machineType: 'large',
        env: { TOKEN: 'abc' },
        setupScript: 'npm ci',
        noEnv: true,
        environment: 'staging',
        org: 'org_1',
      })._start();

      expect(boat.requestsTo('POST', '/sandboxes')[0]?.body).toMatchObject({
        type: 'large',
        env: { TOKEN: 'abc' },
        setupScript: 'npm ci',
        noEnv: true,
        environment: 'staging',
        org: 'org_1',
      });
    });

    it('boots from a named snapshot once one exists', async () => {
      boat.namedSnapshots.add('warm-base');
      await makeSandbox({ checkpointName: 'warm-base' })._start();

      expect(boat.requestsTo('POST', '/sandboxes')[0]?.body).toMatchObject({ from: 'warm-base' });
    });

    it('falls back to the seed snapshot before the checkpoint has been saved', async () => {
      boat.namedSnapshots.add('repo-base');
      await makeSandbox({ checkpointName: 'session-42', seedCheckpointName: 'repo-base' })._start();

      expect(boat.requestsTo('POST', '/sandboxes')[0]?.body).toMatchObject({ from: 'repo-base' });
    });

    it('starts clean when neither snapshot exists yet', async () => {
      await makeSandbox({ checkpointName: 'session-42', seedCheckpointName: 'repo-base' })._start();

      expect(boat.requestsTo('POST', '/sandboxes')[0]?.body).not.toHaveProperty('from');
    });
  });

  describe('reattach', () => {
    it('connects to a live sandbox instead of provisioning one', async () => {
      boat.sandboxes.set('bx_live', {
        id: 'bx_live',
        name: 'live',
        state: 'ready',
        desktopAvailable: false,
        snapshotAvailable: false,
      });

      const result = await makeSandbox({ sandboxId: 'bx_live' })._start();

      expect(result).toEqual({ outcome: 'connected' });
      expect(boat.requestsTo('POST', '/sandboxes')).toHaveLength(0);
    });

    it('resumes an archived sandbox before using it', async () => {
      boat.sandboxes.set('bx_cold', {
        id: 'bx_cold',
        name: 'cold',
        state: 'archived',
        desktopAvailable: false,
        snapshotAvailable: false,
      });

      const result = await makeSandbox({ sandboxId: 'bx_cold', machineType: 'small' })._start();

      expect(result).toEqual({ outcome: 'connected' });
      expect(boat.requestsTo('POST', '/sandboxes/bx_cold/resume')[0]?.body).toMatchObject({ type: 'small' });
    });

    it('provisions a fresh sandbox when the configured one is gone', async () => {
      const result = await makeSandbox({ sandboxId: 'bx_missing' })._start();

      expect(result).toEqual({ outcome: 'created' });
      expect(boat.requestsTo('POST', '/sandboxes')).toHaveLength(1);
    });

    it('provisions a fresh sandbox when the configured one is in error', async () => {
      boat.sandboxes.set('bx_broken', {
        id: 'bx_broken',
        name: 'broken',
        state: 'error',
        desktopAvailable: false,
        snapshotAvailable: false,
      });

      const result = await makeSandbox({ sandboxId: 'bx_broken' })._start();

      expect(result).toEqual({ outcome: 'created' });
    });
  });

  describe('teardown', () => {
    it('archives on stop and keeps the id so the next start reconnects', async () => {
      const sandbox = makeSandbox();
      await sandbox._start();
      await sandbox._stop();

      expect(boat.requestsTo('POST', '/sandboxes/bx_fake001/stop')).toHaveLength(1);
      expect(sandbox.boatSandboxId).toBe('bx_fake001');
      expect(sandbox.status).toBe('stopped');
    });

    it('echoes the sandbox id as the delete confirmation Boat requires', async () => {
      const sandbox = makeSandbox();
      await sandbox._start();
      await sandbox._destroy();

      const del = boat.requests.find(request => request.method === 'DELETE');
      expect(del?.headers['x-ascii-confirm-delete']).toBe('bx_fake001');
      expect(boat.sandboxes.has('bx_fake001')).toBe(false);
    });

    it('does not fail teardown when Boat has already reaped the sandbox', async () => {
      const sandbox = makeSandbox();
      await sandbox._start();
      boat.sandboxes.delete('bx_fake001');

      await expect(sandbox._destroy()).resolves.toBeUndefined();
      expect(sandbox.status).toBe('destroyed');
    });
  });

  describe('checkpoints', () => {
    it('does nothing without a checkpoint name, because Boat’s auto-snapshots have none', async () => {
      const sandbox = makeSandbox();
      await sandbox._start();
      await sandbox.snapshot();

      expect(boat.requestsTo('POST', '/named-snapshots')).toHaveLength(0);
    });

    it('saves to the configured named snapshot', async () => {
      const sandbox = makeSandbox({ checkpointName: 'session-42' });
      await sandbox._start();
      await sandbox.snapshot();

      expect(boat.requestsTo('POST', '/named-snapshots')[0]?.body).toMatchObject({
        name: 'session-42',
        sandboxId: 'bx_fake001',
      });
    });
  });

  describe('fork', () => {
    it('returns a started sandbox bound to the copy, leaving the source alone', async () => {
      const sandbox = makeSandbox({ id: 'source' });
      await sandbox._start();
      boat.completeSnapshot('bx_fake001');

      const forked = await sandbox.fork();

      expect(forked.boatSandboxId).toBe('bx_fake001_fork');
      expect(forked.status).toBe('running');
      expect(sandbox.boatSandboxId).toBe('bx_fake001');
    });

    it('passes the configured ttl through, since a fork does not inherit auto-stop', async () => {
      const sandbox = makeSandbox({ ttlSeconds: 7200 });
      await sandbox._start();
      boat.completeSnapshot('bx_fake001');

      await sandbox.fork();

      expect(boat.requestsTo('POST', '/sandboxes/bx_fake001/fork')[0]?.body).toMatchObject({ ttlSeconds: 7200 });
    });

    it('waits for the snapshot Boat forks from instead of failing on fork_failed', async () => {
      // Boat snapshots periodically, not on request: a sandbox forked soon after
      // creation has none yet, and Boat refuses with fork_failed.
      const sandbox = makeSandbox();
      await sandbox._start();

      const forking = sandbox.fork();
      // Nothing to fork from yet, so no fork has been attempted.
      expect(boat.requestsTo('POST', '/sandboxes/bx_fake001/fork')).toHaveLength(0);

      boat.completeSnapshot('bx_fake001');
      const forked = await forking;

      expect(forked.boatSandboxId).toBe('bx_fake001_fork');
    });

    it('gives up with a clear reason when no snapshot ever completes', async () => {
      const sandbox = makeSandbox();
      await sandbox._start();

      await expect(sandbox.fork({ snapshotTimeoutMs: 0 })).rejects.toMatchObject({
        name: 'SandboxError',
        code: 'TIMEOUT',
        message: expect.stringContaining('no completed snapshot'),
      });
    });
  });

  describe('clone', () => {
    it('inherits configuration without performing any I/O', async () => {
      const sandbox = makeSandbox({ machineType: 'large', env: { A: '1' }, checkpointName: 'base' });
      const before = boat.requests.length;

      const clone = sandbox.clone({ id: 'clone-1' });

      expect(clone.id).toBe('clone-1');
      expect(clone).toBeInstanceOf(BoatSandbox);
      expect(boat.requests).toHaveLength(before);
    });

    it('lets per-clone overrides win over the template', async () => {
      const sandbox = makeSandbox({ env: { A: '1' } });
      const clone = sandbox.clone({ env: { A: '2' }, sandboxId: 'bx_existing' });
      boat.sandboxes.set('bx_existing', {
        id: 'bx_existing',
        name: 'e',
        state: 'ready',
        desktopAvailable: false,
        snapshotAvailable: false,
      });

      await clone._start();

      expect(clone.boatSandboxId).toBe('bx_existing');
    });
  });

  describe('writeFiles', () => {
    it('writes text content as utf8', async () => {
      const sandbox = makeSandbox();
      await sandbox._start();
      await sandbox.writeFiles([{ path: '/home/user/app.ts', content: 'export const x = 1' }]);

      expect(boat.files.get('/home/user/app.ts')).toBe('export const x = 1');
      expect(boat.requestsTo('PUT', '/sandboxes/bx_fake001/files')[0]?.body).toMatchObject({ encoding: 'utf8' });
    });

    it('base64-encodes buffers so binary survives the JSON body', async () => {
      const sandbox = makeSandbox();
      await sandbox._start();
      await sandbox.writeFiles([{ path: '/tmp/blob', content: Buffer.from('hello') }]);

      expect(boat.requestsTo('PUT', '/sandboxes/bx_fake001/files')[0]?.body).toMatchObject({
        encoding: 'base64',
        content: Buffer.from('hello').toString('base64'),
      });
      expect(boat.files.get('/tmp/blob')).toBe('hello');
    });

    it('applies requested modes in a single chmod, since Boat has no mode field', async () => {
      const sandbox = makeSandbox();
      await sandbox._start();
      await sandbox.writeFiles([
        { path: '/home/user/.npmrc', content: 'token', mode: 0o600 },
        { path: '/home/user/run.sh', content: 'echo hi', mode: 0o755 },
      ]);

      const chmod = boat
        .requestsTo('POST', '/sandboxes/bx_fake001/commands')
        .find(request => String(request.body?.command).startsWith('chmod'));
      expect(chmod?.body?.command).toBe('chmod 600 /home/user/.npmrc && chmod 755 /home/user/run.sh');
    });

    it('does not run chmod when no file asked for a mode', async () => {
      const sandbox = makeSandbox();
      await sandbox._start();
      await sandbox.writeFiles([{ path: '/tmp/a', content: 'a' }]);

      expect(boat.requestsTo('POST', '/sandboxes/bx_fake001/commands')).toHaveLength(0);
    });

    it('rejects a mode outside the permission bits instead of silently writing it', async () => {
      const sandbox = makeSandbox();
      await sandbox._start();

      await expect(sandbox.writeFiles([{ path: '/tmp/a', content: 'a', mode: 0o7777 }])).rejects.toThrow(
        /Invalid file mode/,
      );
    });

    it('is a no-op for an empty list', async () => {
      const sandbox = makeSandbox();
      await sandbox._start();
      await sandbox.writeFiles([]);

      expect(boat.requestsTo('PUT', '/sandboxes/bx_fake001/files')).toHaveLength(0);
    });
  });

  describe('networking', () => {
    it('returns null before the sandbox is running', async () => {
      expect(await makeSandbox().networking.getPortUrl(3000)).toBeNull();
    });

    it('returns a token-gated URL by default, matching Boat', async () => {
      const sandbox = makeSandbox();
      await sandbox._start();

      expect(await sandbox.networking.getPortUrl(3000)).toBe('https://bx_fake001-sub-3000.on.boat.dev?_token=tok_fake');
    });

    it('asks for an ungated URL when publicPorts is set', async () => {
      const sandbox = makeSandbox({ publicPorts: true });
      await sandbox._start();

      expect(await sandbox.networking.getPortUrl(3000)).toBe('https://bx_fake001-sub-3000.on.boat.dev');
      expect(boat.requestsTo('POST', '/sandboxes/bx_fake001/host')[0]?.body).toMatchObject({ public: true });
    });
  });

  describe('errors', () => {
    it('surfaces Boat’s structured error code rather than a bare HTTP status', async () => {
      const sandbox = makeSandbox({ id: 'err' });
      await sandbox._start();
      boat.sandboxes.delete('bx_fake001');

      await expect(sandbox.networking.getPortUrl(3000)).rejects.toMatchObject({
        name: 'SandboxError',
        code: 'SANDBOX_NOT_FOUND',
      });
    });
  });

  describe('getInstructions', () => {
    it('describes the environment, its limits and how to expose a port', () => {
      const instructions = makeSandbox().getInstructions();

      expect(instructions).toContain('Boat cloud sandbox');
      expect(instructions).toContain(BOAT_WORK_DIRECTORY);
      expect(instructions).toContain('0.0.0.0');
    });

    it('mentions the configured auto-stop window', () => {
      expect(makeSandbox({ ttlSeconds: 1800 }).getInstructions()).toContain('30 minute(s)');
    });

    it('says so when auto-stop is disabled', () => {
      expect(makeSandbox({ ttlSeconds: null }).getInstructions()).toContain('Auto-stop is disabled');
    });

    it('is replaced entirely by a string override', () => {
      expect(makeSandbox({ instructions: 'Custom.' }).getInstructions()).toBe('Custom.');
    });

    it('is suppressed by an empty string override', () => {
      expect(makeSandbox({ instructions: '' }).getInstructions()).toBe('');
    });

    it('hands the defaults to a function override', () => {
      const instructions = makeSandbox({
        instructions: ({ defaultInstructions }) => `${defaultInstructions} Extra.`,
      }).getInstructions();

      expect(instructions).toContain('Boat cloud sandbox');
      expect(instructions).toMatch(/ Extra\.$/);
    });
  });

  describe('getInfo', () => {
    it('reports Boat’s id, state and machine resources', async () => {
      const sandbox = makeSandbox({ id: 'info' });
      await sandbox._start();

      const info = await sandbox.getInfo();

      expect(info).toMatchObject({
        id: 'info',
        provider: 'boat',
        status: 'running',
        resources: { cpuCores: 4, memoryMB: 8192 },
        metadata: { boatSandboxId: 'bx_fake001', state: 'ready', machineType: 'default' },
      });
    });
  });
});
