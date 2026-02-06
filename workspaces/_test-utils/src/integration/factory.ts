/**
 * Integration test suite factory.
 *
 * Creates tests that verify filesystem and sandbox work together.
 */

import { describe, beforeAll, afterAll, it, expect } from 'vitest';

import { generateTestPath } from '../test-helpers';

import { createConcurrentOperationsTests } from './scenarios/concurrent-operations';
import { createCrossMountCopyTests } from './scenarios/cross-mount-copy';
import { createFileSyncTests } from './scenarios/file-sync';
import { createLargeFileHandlingTests } from './scenarios/large-file-handling';
import { createMultiMountTests } from './scenarios/multi-mount';
import { createReadOnlyMountTests } from './scenarios/read-only-mount';
import { createWriteReadConsistencyTests } from './scenarios/write-read-consistency';
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
    sandboxPathsAligned = true,
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

    // Helper to get test context.
    // The test path is generated once per getContext() call so that all
    // references within a single test point to the same directory.
    const getContext = () => {
      const testPath = generateTestPath('int-test');
      return {
        setup,
        getTestPath: () => testPath,
        mountPath,
        testTimeout,
        fastOnly,
        sandboxPathsAligned,
      };
    };

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

    if (testScenarios.concurrentOperations === true) {
      createConcurrentOperationsTests(getContext);
    }

    if (testScenarios.largeFileHandling === true) {
      createLargeFileHandlingTests(getContext);
    }

    if (testScenarios.writeReadConsistency === true) {
      createWriteReadConsistencyTests(getContext);
    }
  });
}
