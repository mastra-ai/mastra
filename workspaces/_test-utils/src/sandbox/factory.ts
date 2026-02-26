/**
 * Sandbox test suite factory.
 *
 * Creates a comprehensive test suite for sandbox providers.
 */

import type { MastraSandbox } from '@mastra/core/workspace';
import { describe, beforeAll, afterAll } from 'vitest';

import { createCommandExecutionTests } from './domains/command-execution';
import { createSandboxLifecycleTests } from './domains/lifecycle';
import { createMountOperationsTests } from './domains/mount-operations';
import { createProcessManagementTests } from './domains/process-management';
import { createReconnectionTests } from './domains/reconnection';
import type { SandboxTestConfig, SandboxCapabilities } from './types';

/**
 * Default capabilities - assume basic features are supported.
 */
const DEFAULT_CAPABILITIES: Required<SandboxCapabilities> = {
  supportsMounting: false,
  supportsReconnection: true,
  supportsConcurrency: true,
  supportsEnvVars: true,
  supportsWorkingDirectory: true,
  supportsTimeout: true,
  defaultCommandTimeout: 30000,
  supportsStreaming: true,
};

/**
 * Create a comprehensive test suite for a sandbox provider.
 *
 * @example
 * ```typescript
 * import { createSandboxTestSuite } from '@internal/workspace-test-utils';
 * import { E2BSandbox } from '../sandbox';
 *
 * createSandboxTestSuite({
 *   suiteName: 'E2BSandbox',
 *   createSandbox: async () => new E2BSandbox({
 *     id: `test-${Date.now()}`,
 *     timeout: 60000,
 *   }),
 *   capabilities: {
 *     supportsMounting: true,
 *     supportsReconnection: true,
 *   },
 * });
 * ```
 */
export function createSandboxTestSuite(config: SandboxTestConfig): void {
  const {
    suiteName,
    createSandbox,
    createInvalidSandbox,
    cleanupSandbox,
    capabilities: userCapabilities = {},
    testDomains = {},
    testTimeout = 30000,
    fastOnly = false,
    createMountableFilesystem,
  } = config;

  // Merge capabilities with defaults
  const capabilities: Required<SandboxCapabilities> = {
    ...DEFAULT_CAPABILITIES,
    ...userCapabilities,
  };

  describe(suiteName, () => {
    let sandbox: MastraSandbox;

    beforeAll(async () => {
      sandbox = await createSandbox();
      await sandbox._start();
    }, 120000); // Allow 2 minutes for sandbox startup

    afterAll(async () => {
      if (!sandbox) return;
      if (cleanupSandbox) {
        await cleanupSandbox(sandbox);
      } else {
        await sandbox._destroy();
      }
    }, 60000);

    // Helper to get test context
    const getContext = () => ({
      sandbox,
      capabilities,
      testTimeout,
      fastOnly,
      createSandbox,
      createInvalidSandbox,
      createMountableFilesystem,
    });

    // Register domain tests
    if (testDomains.commandExecution !== false) {
      createCommandExecutionTests(getContext);
    }

    if (testDomains.lifecycle !== false) {
      createSandboxLifecycleTests(getContext);
    }

    if (testDomains.mountOperations !== false && capabilities.supportsMounting) {
      createMountOperationsTests(getContext);
    }

    if (testDomains.reconnection !== false && capabilities.supportsReconnection) {
      createReconnectionTests(getContext);
    }

    if (testDomains.processManagement !== false) {
      createProcessManagementTests(getContext);
    }
  });
}
