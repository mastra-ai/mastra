/**
 * Integration test suite factory.
 *
 * Creates tests that verify filesystem and sandbox work together.
 */

import { describe, beforeAll, afterAll, it, expect } from 'vitest';

import { generateTestPath } from '../test-helpers';

import { createFileSyncTests } from './scenarios/file-sync';
import { createMultiMountTests } from './scenarios/multi-mount';
import { createCrossMountCopyTests } from './scenarios/cross-mount-copy';
import { createReadOnlyMountTests } from './scenarios/read-only-mount';
import type { WorkspaceIntegrationTestConfig, WorkspaceSetup } from './types';

/**
 * Create integration tests for workspace providers.
 *
 * @example
 * ```typescript
 * createWorkspaceIntegrationTests({
 *   suiteName: 'E2B + S3 Integration',
 *   createWorkspace: async () => {
 *     const filesystem = new S3Filesystem({ bucket: 'test' });
 *     const sandbox = new E2BSandbox();
 *     await sandbox.mount(filesystem, '/data');
 *     return { filesystem, sandbox };
 *   },
 * });
 * ```
 */
export function createWorkspaceIntegrationTests(config: WorkspaceIntegrationTestConfig): void {
  const {
    suiteName,
    createWorkspace,
    cleanupWorkspace,
    testScenarios = {},
    testTimeout = 60000,
    fastOnly = false,
    mountPath = '',
  } = config;

  describe(suiteName, () => {
    let setup: WorkspaceSetup;

    beforeAll(async () => {
      setup = await createWorkspace();

      // Initialize filesystem if needed
      if (setup.filesystem.init) {
        await setup.filesystem.init();
      }

      // Start sandbox if it has a start method
      if (setup.sandbox.start) {
        await setup.sandbox.start();
      }
    }, 180000); // Allow 3 minutes for setup

    afterAll(async () => {
      if (cleanupWorkspace) {
        await cleanupWorkspace(setup);
      } else {
        // Default cleanup
        if (setup.sandbox.destroy) {
          await setup.sandbox.destroy();
        }
        if (setup.filesystem.destroy) {
          await setup.filesystem.destroy();
        }
      }
    }, 60000);

    // Helper to get test context
    const getContext = () => ({
      setup,
      getTestPath: () => generateTestPath('int-test'),
      mountPath,
      testTimeout,
      fastOnly,
    });

    // Register scenario tests
    // Note: Individual tests guard against missing mounts/features
    if (testScenarios.fileSync !== false) {
      createFileSyncTests(getContext);
    }

    if (testScenarios.multiMount === true) {
      createMultiMountTests(getContext);
    }

    if (testScenarios.crossMountCopy === true) {
      createCrossMountCopyTests(getContext);
    }

    if (testScenarios.readOnlyMount === true) {
      createReadOnlyMountTests(getContext);
    }
  });
}
