/**
 * Daytona Sandbox Integration Tests
 *
 * These tests require real Daytona API access and run against actual Daytona sandboxes.
 * They are separated from unit tests to avoid mock conflicts.
 *
 * Required environment variables:
 * - DAYTONA_API_KEY: Daytona API key
 */

import { createSandboxTestSuite } from '@internal/workspace-test-utils';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { DaytonaSandbox } from './index';

/**
 * Basic Daytona integration tests.
 */
describe.skipIf(!process.env.DAYTONA_API_KEY)('DaytonaSandbox Integration', () => {
  let sandbox: DaytonaSandbox;

  beforeEach(() => {
    sandbox = new DaytonaSandbox({
      id: `test-${Date.now()}`,
      timeout: 60000,
      language: 'typescript',
    });
  });

  afterEach(async () => {
    if (sandbox) {
      try {
        await sandbox._destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('can start and execute commands', async () => {
    await sandbox._start();

    const result = await sandbox.executeCommand('echo', ['Hello Daytona']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('Hello Daytona');
  }, 120000);

  it('passes environment variables', async () => {
    const envSandbox = new DaytonaSandbox({
      id: `test-env-${Date.now()}`,
      env: { TEST_VAR: 'hello-from-env' },
    });

    try {
      await envSandbox._start();
      const result = await envSandbox.executeCommand('printenv', ['TEST_VAR']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toContain('hello-from-env');
    } finally {
      await envSandbox._destroy();
    }
  }, 120000);

  it('supports working directory option', async () => {
    await sandbox._start();

    const result = await sandbox.executeCommand('pwd', [], { cwd: '/tmp' });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('/tmp');
  }, 120000);

  it('handles command timeout', async () => {
    await sandbox._start();

    const result = await sandbox.executeCommand('sleep', ['30'], { timeout: 2000 });

    // Should fail due to timeout
    expect(result.success).toBe(false);
  }, 120000);

  it('reports correct sandbox info', async () => {
    await sandbox._start();

    const info = await sandbox.getInfo();

    expect(info.provider).toBe('daytona');
    expect(info.name).toBe('DaytonaSandbox');
    expect(info.status).toBe('running');
    expect(info.createdAt).toBeInstanceOf(Date);
  }, 120000);

  it('provides access to underlying sandbox instance', async () => {
    await sandbox._start();

    const instance = sandbox.instance;
    expect(instance).toBeDefined();
    expect(instance.id).toBeDefined();
  }, 120000);
});

/**
 * Shared sandbox conformance tests.
 * Uses the shared test suite from @internal/workspace-test-utils.
 */
describe.skipIf(!process.env.DAYTONA_API_KEY)('DaytonaSandbox Conformance', () => {
  createSandboxTestSuite({
    suiteName: 'DaytonaSandbox',
    createSandbox: async options =>
      new DaytonaSandbox({
        id: `conformance-${Date.now()}`,
        timeout: 60000,
        language: 'typescript',
        ...(options?.env && { env: options.env }),
      }),
    createInvalidSandbox: () =>
      new DaytonaSandbox({
        id: `bad-config-${Date.now()}`,
        image: 'nonexistent/fake-image:latest',
      }),
    capabilities: {
      supportsMounting: false,
      supportsReconnection: true,
      supportsEnvVars: true,
      supportsWorkingDirectory: true,
      supportsTimeout: true,
      supportsStreaming: true,
      supportsConcurrency: true,
    },
    testTimeout: 120000,
  });
});
