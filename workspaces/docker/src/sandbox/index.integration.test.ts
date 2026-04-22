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
  },
});
