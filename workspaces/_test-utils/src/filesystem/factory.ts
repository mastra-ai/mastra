/**
 * Filesystem test suite factory.
 *
 * Creates a comprehensive test suite for filesystem providers.
 */

import type { WorkspaceFilesystem } from '@mastra/core/workspace';
import { callLifecycle } from '@mastra/core/workspace';
import { describe, beforeAll, afterAll, beforeEach } from 'vitest';

import { generateTestPath, cleanupTestPath } from '../test-helpers';

import { createFileOperationsTests } from './domains/file-operations';
import { createDirectoryOpsTests } from './domains/directory-ops';
import { createPathOperationsTests } from './domains/path-operations';
import { createErrorHandlingTests } from './domains/error-handling';
import { createLifecycleTests } from './domains/lifecycle';
import { createMountConfigTests } from './domains/mount-config';
import type { FilesystemTestConfig, FilesystemCapabilities } from './types';

/**
 * Default capabilities - assume most features are supported.
 */
const DEFAULT_CAPABILITIES: Required<FilesystemCapabilities> = {
  supportsAppend: true,
  supportsSymlinks: false,
  supportsBinaryFiles: true,
  supportsPermissions: false,
  supportsCaseSensitive: true,
  supportsConcurrency: true,
  supportsMounting: false,
  maxTestFileSize: 10 * 1024 * 1024, // 10MB
  supportsForceDelete: true,
  supportsOverwrite: true,
  supportsEmptyDirectories: true,
  deleteThrowsOnMissing: true,
};

/**
 * Create a comprehensive test suite for a filesystem provider.
 *
 * @example
 * ```typescript
 * import { createFilesystemTestSuite } from '@internal/workspace-test-utils';
 * import { S3Filesystem } from '../filesystem';
 *
 * createFilesystemTestSuite({
 *   suiteName: 'S3Filesystem',
 *   createFilesystem: async () => new S3Filesystem({
 *     bucket: process.env.S3_TEST_BUCKET!,
 *     prefix: `test-${Date.now()}/`,
 *   }),
 *   capabilities: {
 *     supportsAppend: false,
 *     supportsMounting: true,
 *   },
 * });
 * ```
 */
export function createFilesystemTestSuite(config: FilesystemTestConfig): void {
  const {
    suiteName,
    createFilesystem,
    cleanupFilesystem,
    capabilities: userCapabilities = {},
    testDomains = {},
    testTimeout = 5000,
    fastOnly = false,
  } = config;

  // Merge capabilities with defaults
  const capabilities: Required<FilesystemCapabilities> = {
    ...DEFAULT_CAPABILITIES,
    ...userCapabilities,
  };

  describe(suiteName, () => {
    let fs: WorkspaceFilesystem;
    let testBasePath: string;

    beforeAll(async () => {
      fs = await createFilesystem();
      await callLifecycle(fs, 'init');
    });

    afterAll(async () => {
      if (cleanupFilesystem) {
        await cleanupFilesystem(fs);
      }
      await callLifecycle(fs, 'destroy');
    });

    beforeEach(() => {
      // Generate unique path for each test
      testBasePath = generateTestPath('fs-test');
    });

    // Helper to get test context
    const getContext = () => ({
      fs,
      getTestPath: () => testBasePath,
      capabilities,
      testTimeout,
      fastOnly,
      cleanup: () => cleanupTestPath(fs, testBasePath),
      createFilesystem,
    });

    // Register domain tests
    if (testDomains.fileOperations !== false) {
      createFileOperationsTests(getContext);
    }

    if (testDomains.directoryOps !== false) {
      createDirectoryOpsTests(getContext);
    }

    if (testDomains.pathOperations !== false) {
      createPathOperationsTests(getContext);
    }

    if (testDomains.errorHandling !== false) {
      createErrorHandlingTests(getContext);
    }

    if (testDomains.lifecycle !== false) {
      createLifecycleTests(getContext);
    }

    if (testDomains.mountConfig !== false && capabilities.supportsMounting) {
      createMountConfigTests(getContext);
    }
  });
}
