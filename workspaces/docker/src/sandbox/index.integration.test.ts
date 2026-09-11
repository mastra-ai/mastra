/**
 * Docker Sandbox Integration Tests
 *
 * These tests require a running Docker daemon and run against real Docker containers.
 * They are separated from unit tests to avoid mock conflicts.
 *
 * Prerequisites:
 * - Docker daemon running locally
 */

import { createSandboxTestSuite } from '@internal/workspace-test-utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DockerSandbox } from './index';

/**
 * Conformance test suite — validates DockerSandbox against the shared sandbox contract.
 */
createSandboxTestSuite({
  suiteName: 'DockerSandbox Conformance',
  createSandbox: options => {
    return new DockerSandbox({
      id: `conformance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      image: 'node:22-slim',
      timeout: 60000,
      ...(options?.env && { env: options.env }),
    });
  },
  createInvalidSandbox: () => {
    return new DockerSandbox({
      id: `bad-config-${Date.now()}`,
      image: 'nonexistent/fake-image-that-does-not-exist:latest',
    });
  },
  cleanupSandbox: async sandbox => {
    try {
      await sandbox._destroy();
    } catch {
      // Ignore cleanup errors
    }
  },
  capabilities: {
    supportsMounting: false,
    supportsReconnection: true,
    supportsConcurrency: true,
    supportsEnvVars: true,
    supportsWorkingDirectory: true,
    supportsTimeout: true,
    supportsStreaming: true,
    supportsStdin: true,
    supportsCloseStdin: true,
  },
});

/**
 * writeFiles — validates bulk file upload against a real container.
 */
describe('DockerSandbox writeFiles (integration)', () => {
  let sandbox: DockerSandbox;

  beforeAll(async () => {
    sandbox = new DockerSandbox({
      id: `writefiles-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      image: 'node:22-slim',
      workingDirectory: '/workspace',
      timeout: 60000,
    });
    await sandbox._start();
  }, 120000);

  afterAll(async () => {
    try {
      await sandbox._destroy();
    } catch {
      // Ignore cleanup errors
    }
  });

  it('writes text and binary files, resolving relative paths and creating parent dirs', async () => {
    const binary = Buffer.from([0x00, 0x01, 0x02, 0xff]);
    await sandbox.writeFiles([
      { path: 'src/index.js', content: 'console.log("hello")\n' },
      { path: '/tmp/absolute.txt', content: 'absolute path\n' },
      { path: 'assets/data.bin', content: binary },
    ]);

    const text = await sandbox.executeCommand!('cat', ['/workspace/src/index.js']);
    expect(text.exitCode).toBe(0);
    expect(text.stdout).toContain('hello');

    const abs = await sandbox.executeCommand!('cat', ['/tmp/absolute.txt']);
    expect(abs.exitCode).toBe(0);
    expect(abs.stdout).toContain('absolute path');

    const size = await sandbox.executeCommand!('stat', ['-c', '%s', '/workspace/assets/data.bin']);
    expect(size.exitCode).toBe(0);
    expect(size.stdout.trim()).toBe(String(binary.length));
  }, 120000);

  it('overwrites existing files', async () => {
    await sandbox.writeFiles([{ path: 'overwrite.txt', content: 'first\n' }]);
    await sandbox.writeFiles([{ path: 'overwrite.txt', content: 'second\n' }]);

    const result = await sandbox.executeCommand!('cat', ['/workspace/overwrite.txt']);
    expect(result.stdout.trim()).toBe('second');
  }, 120000);
});
