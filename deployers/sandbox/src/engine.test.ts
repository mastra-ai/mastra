import { tmpdir } from 'node:os';
import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildLaunchScript, deployToSandbox } from './engine';
import { FakeSandbox, makeBuildDir } from './fake-sandbox.mock';
import { SERVER_SCRIPT } from './shared';

const FAST_HEALTH = { healthCheckTimeoutMs: 200, healthCheckIntervalMs: 10 };

describe('deployToSandbox', () => {
  let buildDir: string;

  beforeEach(async () => {
    buildDir = await makeBuildDir(tmpdir());
    // Healthy by default.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('ok', { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('deploys end to end and returns a live deployment', async () => {
    const sandbox = new FakeSandbox({ info: { id: 'sbx-123', timeoutAt: new Date('2026-07-16T12:00:00Z') } });

    const deployment = await deployToSandbox({ sandbox, dir: buildDir, ...FAST_HEALTH });

    expect(sandbox.started).toBe(1);
    expect(deployment.url).toBe('https://fake-sandbox.example');
    expect(deployment.sandboxId).toBe('sbx-123');
    expect(deployment.expiresAt).toEqual(new Date('2026-07-16T12:00:00Z'));

    // Tarball extracted and cleaned up inside the sandbox.
    expect(sandbox.commands.some(c => c.includes('tar -xzf .deploy.tgz'))).toBe(true);

    await deployment.stop();
    expect(sandbox.stopped).toBe(1);
    await deployment.destroy();
    expect(sandbox.destroyed).toBe(1);
  });

  it('uses the writeFiles fast path when available', async () => {
    const sandbox = new FakeSandbox();

    await deployToSandbox({ sandbox, dir: buildDir, ...FAST_HEALTH });

    // Tarball + launch script uploaded natively.
    const uploadedPaths = sandbox.writtenFiles.flat().map(f => f.path);
    expect(uploadedPaths).toContain('/home/fake/mastra-app/.deploy.tgz');
    expect(uploadedPaths).toContain(`/home/fake/mastra-app/${SERVER_SCRIPT}`);
    // No base64 fallback commands issued.
    expect(sandbox.commands.some(c => c.includes('base64 -d'))).toBe(false);
  });

  it('falls back to base64-over-executeCommand when writeFiles is unavailable', async () => {
    const sandbox = new FakeSandbox({ withWriteFiles: false });

    await deployToSandbox({ sandbox, dir: buildDir, ...FAST_HEALTH });

    expect(sandbox.writtenFiles).toHaveLength(0);
    expect(sandbox.commands.some(c => c.startsWith('printf') && c.includes('.deploy.tgz.b64'))).toBe(true);
    expect(sandbox.commands.some(c => c.includes('base64 -d'))).toBe(true);
  });

  it('installs dependencies and records the package.json hash marker', async () => {
    const sandbox = new FakeSandbox();

    await deployToSandbox({ sandbox, dir: buildDir, ...FAST_HEALTH });

    expect(sandbox.commands.some(c => c.includes('npm install --omit=dev'))).toBe(true);
    expect(sandbox.commands.some(c => c.includes('.mastra-install-hash') && c.startsWith('printf'))).toBe(true);
  });

  it('skips the install when the recorded hash matches', async () => {
    const { createHash } = await import('node:crypto');
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    // Mirror hashInstallInputs: package.json + bundled lockfiles (none in the
    // fixture) + the install command itself.
    const hash = createHash('sha256')
      .update(await readFile(join(buildDir, 'package.json')))
      .update('npm install --omit=dev')
      .digest('hex');

    const sandbox = new FakeSandbox({ installMarker: hash });

    await deployToSandbox({ sandbox, dir: buildDir, ...FAST_HEALTH });

    expect(sandbox.commands.some(c => c.includes('npm install'))).toBe(false);
  });

  it('kills the previous server before extracting files and launching the new one', async () => {
    const sandbox = new FakeSandbox();

    await deployToSandbox({ sandbox, dir: buildDir, ...FAST_HEALTH });

    const killIndex = sandbox.commands.findIndex(c => c.includes('.mastra-server.pid') && c.includes('kill'));
    expect(killIndex).toBeGreaterThanOrEqual(0);
    // The old server must be stopped before the new build is extracted over
    // the live directory, so it never serves mixed old/new files.
    const extractIndex = sandbox.commands.findIndex(c => c.includes('tar -xzf'));
    expect(extractIndex).toBeGreaterThan(killIndex);
    // Launched detached via nohup (not processes.spawn — a provider process
    // handle would keep the caller's event loop alive following server logs).
    const launch = sandbox.commands.filter(c => c.includes(`nohup sh`) && c.includes(SERVER_SCRIPT));
    expect(launch).toHaveLength(1);
    expect(sandbox.commands.indexOf(launch[0]!)).toBeGreaterThan(killIndex);
    expect(sandbox.spawned).toHaveLength(0);
  });

  it('surfaces the server log when the health check fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('bad gateway', { status: 502 })),
    );
    const sandbox = new FakeSandbox({ serverLog: 'Error: missing OPENAI_API_KEY' });

    await expect(deployToSandbox({ sandbox, dir: buildDir, ...FAST_HEALTH })).rejects.toThrow(/missing OPENAI_API_KEY/);
  });

  it('throws a clear error when the sandbox does not support networking', async () => {
    const sandbox = new FakeSandbox({ withNetworking: false });

    await expect(deployToSandbox({ sandbox, dir: buildDir, ...FAST_HEALTH })).rejects.toThrow(
      /does not support networking/,
    );
  });

  it('throws a clear error when the port has no public URL', async () => {
    const sandbox = new FakeSandbox({ url: null });

    await expect(deployToSandbox({ sandbox, dir: buildDir, port: 5000, ...FAST_HEALTH })).rejects.toThrow(
      /ports: \[5000\]/,
    );
  });

  it('throws a clear error when executeCommand is unavailable', async () => {
    const sandbox = new FakeSandbox();
    (sandbox as { executeCommand?: unknown }).executeCommand = undefined;

    await expect(
      deployToSandbox({ sandbox: sandbox as WorkspaceSandbox, dir: buildDir, ...FAST_HEALTH }),
    ).rejects.toThrow(/does not support executeCommand/);
  });

  it('throws when the build output has no index.mjs', async () => {
    const sandbox = new FakeSandbox();

    await expect(deployToSandbox({ sandbox, dir: tmpdir(), ...FAST_HEALTH })).rejects.toThrow(/No index\.mjs/);
  });
});

describe('buildLaunchScript', () => {
  it('exports PORT, MASTRA_HOST, and custom env with shell quoting', () => {
    const script = buildLaunchScript({
      remoteDir: '/tmp/mastra-app',
      port: 4111,
      env: { OPENAI_API_KEY: "sk-with'quote", CUSTOM: 'plain' },
    });

    expect(script).toContain(`export PORT='4111'`);
    expect(script).toContain(`export MASTRA_HOST='0.0.0.0'`);
    expect(script).toContain(`export OPENAI_API_KEY='sk-with'\\''quote'`);
    expect(script).toContain(`export CUSTOM='plain'`);
    expect(script).toContain('echo $$ >');
    expect(script).toContain('exec node index.mjs');
  });

  it('does not let custom env override PORT or MASTRA_HOST', () => {
    const script = buildLaunchScript({
      remoteDir: '/app',
      port: 4111,
      env: { PORT: '9999', MASTRA_HOST: '127.0.0.1' },
    });
    expect(script).toContain(`export PORT='4111'`);
    expect(script).toContain(`export MASTRA_HOST='0.0.0.0'`);
    expect(script).not.toContain('9999');
    expect(script).not.toContain('127.0.0.1');
  });

  it('rejects invalid environment variable names', () => {
    expect(() => buildLaunchScript({ remoteDir: '/app', port: 4111, env: { 'BAD-NAME; rm -rf /': 'x' } })).toThrow(
      /Invalid environment variable name/,
    );
  });
});
