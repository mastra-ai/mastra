/**
 * Modal Sandbox Integration Tests
 *
 * These tests require valid Modal credentials and connect to real Modal infrastructure.
 * Run with: pnpm test (from workspaces/modal)
 *
 * Required environment variables:
 *   MODAL_TOKEN_ID
 *   MODAL_TOKEN_SECRET
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ModalSandbox } from './index';

const hasCredentials = !!(process.env.MODAL_TOKEN_ID && process.env.MODAL_TOKEN_SECRET);

describe.skipIf(!hasCredentials)('ModalSandbox integration', () => {
  const sandbox = new ModalSandbox({
    id: `mastra-test-${Date.now().toString(36)}`,
    baseImage: 'ubuntu:22.04',
    timeoutMs: 300_000,
    env: { TEST_VAR: 'hello_from_mastra' },
  });

  beforeAll(async () => {
    await sandbox._start();
  }, 60_000);

  afterAll(async () => {
    await sandbox._destroy();
  }, 30_000);

  it('reaches running status after start()', () => {
    expect(sandbox.status).toBe('running');
  });

  it('executes a command and returns stdout', async () => {
    const result = await sandbox.executeCommand!('echo', ['hello world']);
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello world');
  });

  it('captures stderr separately from stdout', async () => {
    const result = await sandbox.executeCommand!('bash', ['-c', 'echo out && echo err >&2']);
    expect(result.stdout.trim()).toBe('out');
    expect(result.stderr.trim()).toBe('err');
  });

  it('returns non-zero exit code for failing commands', async () => {
    const result = await sandbox.executeCommand!('false');
    expect(result.success).toBe(false);
    expect(result.exitCode).not.toBe(0);
  });

  it('exposes sandbox-level env var', async () => {
    const result = await sandbox.executeCommand!('printenv', ['TEST_VAR']);
    expect(result.stdout.trim()).toBe('hello_from_mastra');
  });

  it('spawn() streams stdout in real time via onStdout callback', async () => {
    const chunks: string[] = [];
    const handle = await sandbox.processes.spawn('echo streaming', {
      onStdout: chunk => chunks.push(chunk),
    });
    await handle.wait();
    expect(chunks.join('')).toContain('streaming');
  });

  it('spawn() with cwd changes working directory', async () => {
    const handle = await sandbox.processes.spawn('pwd', { cwd: '/tmp' });
    const result = await handle.wait();
    expect(result.stdout.trim()).toBe('/tmp');
  });

  it('spawn() with per-spawn env overrides base env', async () => {
    const handle = await sandbox.processes.spawn('printenv CUSTOM_VAR', {
      env: { CUSTOM_VAR: 'per_spawn_value' },
    });
    const result = await handle.wait();
    expect(result.stdout.trim()).toBe('per_spawn_value');
  });

  it('getInfo() returns metadata for running sandbox', async () => {
    const info = await sandbox.getInfo();
    expect(info.provider).toBe('modal');
    expect(info.status).toBe('running');
    expect(info.id).toBe(sandbox.id);
  });

  it('modal accessor exposes the underlying Sandbox object', () => {
    expect(sandbox.modal).toBeDefined();
    expect(sandbox.modal.sandboxId).toBeTruthy();
  });
});

describe.skipIf(!hasCredentials)('ModalSandbox stop-and-resume', () => {
  const sandboxId = `mastra-resume-${Date.now().toString(36)}`;

  const first = new ModalSandbox({
    id: sandboxId,
    baseImage: 'ubuntu:22.04',
    timeoutMs: 300_000,
  });

  afterAll(async () => {
    // Best-effort cleanup — terminate via whichever handle is live
    try {
      await first._destroy();
    } catch {
      // Already destroyed or reconnected instance handles cleanup
    }
  }, 30_000);

  it('reconnects to the same image after stop()', async () => {
    // Start and write a sentinel file
    await first._start();
    expect(first.status).toBe('running');
    const firstId = first.modal.sandboxId;
    const firstName = first.id;

    const sentinelContent = `I'm still here! ${Date.now()}`;
    const write = await first.processes.spawn(`echo "${sentinelContent}" > /tmp/marker.txt`);
    await write.wait();

    // Stop and snapshot the filesystem
    await first._stop();
    expect(first.status).toBe('stopped');

    // Reconnect to the same ModalSandbox instance
    // A new underlying sandbox is created, but image and Id should be preserved
    await first._start();
    expect(first.status).toBe('running');

    // Name should not have changed
    expect(first.id).toBe(firstName);

    // Underlying sandbox ID should have changed
    expect(first.modal.sandboxId).not.toBe(firstId);

    // Sentinel file should still be present despite being new sandbox instance
    const read = await first.processes.spawn('cat /tmp/marker.txt');
    const result = await read.wait();
    expect(result.stdout.trim()).toBe(sentinelContent);

    await first._destroy();
  }, 120_000);
});
