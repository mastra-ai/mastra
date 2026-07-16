import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getLocalSandboxRoot, LocalSandbox, sandboxEnv } from './local-sandbox';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mc-local-sandbox-'));
  process.env.MASTRACODE_LOCAL_SANDBOX_ROOT = root;
});

afterEach(() => {
  delete process.env.MASTRACODE_LOCAL_SANDBOX_ROOT;
  rmSync(root, { recursive: true, force: true });
});

describe('getLocalSandboxRoot', () => {
  it('uses the configured root', () => {
    expect(getLocalSandboxRoot()).toBe(root);
  });

  it('defaults under the home dir when unset', () => {
    delete process.env.MASTRACODE_LOCAL_SANDBOX_ROOT;
    expect(getLocalSandboxRoot()).toMatch(/\.mastracode\/web\/sandboxes$/);
  });
});

describe('LocalSandbox', () => {
  it('surfaces a stable id keyed to the root and reattaches by id', async () => {
    const a = new LocalSandbox();
    expect(a.id).toBe(`local:${root}`);
    const info = await a.getInfo();
    expect(info.metadata?.sandboxId).toBe(`local:${root}`);
    expect(info.metadata?.provider).toBe('local');

    const reattached = new LocalSandbox({ sandboxId: a.id });
    expect(reattached.id).toBe(a.id);
  });

  it('runs a successful shell command', async () => {
    const sandbox = new LocalSandbox();
    await sandbox.start();
    const res = await sandbox.executeCommand('sh', ['-c', 'echo hello']);
    expect(res.exitCode).toBe(0);
    expect(res.stdout.trim()).toBe('hello');
  });

  it('captures non-zero exit codes and stderr', async () => {
    const sandbox = new LocalSandbox();
    await sandbox.start();
    const res = await sandbox.executeCommand('sh', ['-c', 'echo oops 1>&2; exit 3']);
    expect(res.exitCode).toBe(3);
    expect(res.stderr.trim()).toBe('oops');
  });

  it('returns 127 when the binary does not exist', async () => {
    const sandbox = new LocalSandbox();
    await sandbox.start();
    const res = await sandbox.executeCommand('this-binary-does-not-exist-xyz');
    expect(res.exitCode).toBe(127);
  });

  it('runs commands in the sandbox root', async () => {
    const sandbox = new LocalSandbox();
    await sandbox.start();
    const res = await sandbox.executeCommand('sh', ['-c', 'pwd']);
    // macOS /tmp symlinks to /private/tmp, so compare the basename.
    expect(res.stdout.trim().endsWith(root.split('/').pop()!)).toBe(true);
  });

  it('stop() is a no-op that does not throw', async () => {
    const sandbox = new LocalSandbox();
    await expect(sandbox.stop()).resolves.toBeUndefined();
  });

  it('does not expose server secrets to spawned commands', async () => {
    process.env.GITHUB_APP_PRIVATE_KEY = 'super-secret-key';
    process.env.WORKOS_API_KEY = 'sk_live_secret';
    try {
      const sandbox = new LocalSandbox();
      await sandbox.start();
      const res = await sandbox.executeCommand('sh', [
        '-c',
        'echo "${GITHUB_APP_PRIVATE_KEY:-MISSING}:${WORKOS_API_KEY:-MISSING}"',
      ]);
      expect(res.stdout.trim()).toBe('MISSING:MISSING');
    } finally {
      delete process.env.GITHUB_APP_PRIVATE_KEY;
      delete process.env.WORKOS_API_KEY;
    }
  });

  it('still passes PATH so binaries resolve', async () => {
    const sandbox = new LocalSandbox();
    await sandbox.start();
    const res = await sandbox.executeCommand('sh', ['-c', 'echo "${PATH:-MISSING}"']);
    expect(res.stdout.trim()).not.toBe('MISSING');
    expect(res.stdout.trim().length).toBeGreaterThan(0);
  });
});

describe('sandboxEnv', () => {
  it('keeps allow-listed keys and drops secrets', () => {
    const filtered = sandboxEnv({
      PATH: '/usr/bin',
      HOME: '/home/me',
      LANG: 'en_US.UTF-8',
      GITHUB_APP_PRIVATE_KEY: 'secret',
      WORKOS_API_KEY: 'secret',
      APP_DATABASE_URL: 'postgres://secret',
      RAILWAY_API_TOKEN: 'secret',
    });
    expect(filtered.PATH).toBe('/usr/bin');
    expect(filtered.HOME).toBe('/home/me');
    expect(filtered.LANG).toBe('en_US.UTF-8');
    expect(filtered.GITHUB_APP_PRIVATE_KEY).toBeUndefined();
    expect(filtered.WORKOS_API_KEY).toBeUndefined();
    expect(filtered.APP_DATABASE_URL).toBeUndefined();
    expect(filtered.RAILWAY_API_TOKEN).toBeUndefined();
  });

  it('drops undefined values', () => {
    const filtered = sandboxEnv({ PATH: '/usr/bin', HOME: undefined });
    expect(filtered.PATH).toBe('/usr/bin');
    expect('HOME' in filtered).toBe(false);
  });
});
