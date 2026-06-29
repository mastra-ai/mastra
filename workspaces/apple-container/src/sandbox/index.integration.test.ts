import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

import { AppleContainerSandbox } from './index';

const shouldRunIntegration = process.env.MASTRA_APPLE_CONTAINER_INTEGRATION === '1';
const cliProbe = shouldRunIntegration ? spawnSync('container', ['--version'], { stdio: 'ignore' }) : undefined;
const hasAppleContainerCli = cliProbe?.status === 0;

if (shouldRunIntegration && !hasAppleContainerCli) {
  throw cliProbe?.error ?? new Error('MASTRA_APPLE_CONTAINER_INTEGRATION=1 but `container --version` failed');
}

describe.skipIf(!hasAppleContainerCli)('AppleContainerSandbox integration', () => {
  let sandbox: AppleContainerSandbox | undefined;

  afterEach(async () => {
    await sandbox?._destroy();
    sandbox = undefined;
  });

  it('starts an Apple container and executes a command', async () => {
    sandbox = new AppleContainerSandbox({
      id: `mastra-apple-container-test-${Date.now()}`,
      image: process.env.MASTRA_APPLE_CONTAINER_IMAGE ?? 'alpine:3.20',
      command: ['sleep', '3600'],
      workingDir: '/',
      timeout: 60_000,
    });

    await sandbox._start();
    const result = await sandbox.executeCommand('printf apple-container');

    expect(result.success).toBe(true);
    expect(result.stdout).toBe('apple-container');
  }, 120_000);
});
