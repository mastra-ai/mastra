import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

import { AppleContainerSandbox } from './index';
import type { AppleContainerSandboxOptions } from './index';

const shouldRunIntegration = process.env.MASTRA_APPLE_CONTAINER_INTEGRATION === '1';
const cliProbe = shouldRunIntegration ? spawnSync('container', ['--version'], { stdio: 'ignore' }) : undefined;
const hasAppleContainerCli = cliProbe?.status === 0;

if (shouldRunIntegration && !hasAppleContainerCli) {
  throw cliProbe?.error ?? new Error('MASTRA_APPLE_CONTAINER_INTEGRATION=1 but `container --version` failed');
}

describe.skipIf(!hasAppleContainerCli)('AppleContainerSandbox integration', () => {
  const sandboxes: AppleContainerSandbox[] = [];

  function createSandbox(options: Partial<AppleContainerSandboxOptions> = {}) {
    const sandbox = new AppleContainerSandbox({
      id: `mastra-apple-container-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      image: process.env.MASTRA_APPLE_CONTAINER_IMAGE ?? 'alpine:3.20',
      command: ['sleep', '3600'],
      workingDir: '/',
      timeout: 60_000,
      ...options,
    });
    sandboxes.push(sandbox);
    return sandbox;
  }

  afterEach(async () => {
    await Promise.allSettled(sandboxes.splice(0).map(sandbox => sandbox._destroy()));
  });

  it('starts an Apple container and executes a command', async () => {
    const sandbox = createSandbox();

    await sandbox._start();
    const result = await sandbox.executeCommand('printf apple-container');

    expect(result.success).toBe(true);
    expect(result.stdout).toBe('apple-container');
  }, 120_000);

  it('stops and restarts the same Apple container', async () => {
    const sandbox = createSandbox();

    await sandbox._start();
    await sandbox._stop();
    expect(sandbox.status).toBe('stopped');

    await sandbox._start();
    const result = await sandbox.executeCommand('pwd');

    expect(sandbox.status).toBe('running');
    expect(result.success).toBe(true);
    expect(result.stdout.trim()).toBe('/');
  }, 120_000);

  it('reconnects to an existing running Apple container', async () => {
    const id = `mastra-apple-container-reconnect-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const first = createSandbox({ id });
    const second = createSandbox({ id });

    await first._start();
    await second._start();

    const result = await second.executeCommand('printf reconnected');
    expect(second.status).toBe('running');
    expect(result.stdout).toBe('reconnected');
  }, 120_000);

  it('deletes the Apple container on destroy', async () => {
    const sandbox = createSandbox();

    await sandbox._start();
    const containerId = sandbox.containerId;
    await sandbox._destroy();

    const inspect = spawnSync('container', ['inspect', containerId], { encoding: 'utf8' });
    expect(sandbox.status).toBe('destroyed');
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toMatch(/not found|no such|does not exist|unknown container/i);
  }, 120_000);
});
