/**
 * Integration test suite factory.
 *
 * Creates tests that verify filesystem and sandbox work together.
 */

import { join } from 'node:path';

import { CompositeFilesystem } from '@mastra/core/workspace';
import type { Workspace } from '@mastra/core/workspace';
import { describe, beforeAll, beforeEach, afterAll } from 'vitest';

import { generateTestPath } from '../test-helpers';

import { createConcurrentOperationsTests } from './scenarios/concurrent-operations';
import { createCrossMountApiTests } from './scenarios/cross-mount-api';
import { createCrossMountCopyTests } from './scenarios/cross-mount-copy';
import { createFileSyncTests } from './scenarios/file-sync';
import { createLargeFileHandlingTests } from './scenarios/large-file-handling';
import { createLspCrossFileTests } from './scenarios/lsp-cross-file';
import { createLspDiagnosticsTests } from './scenarios/lsp-diagnostics';
import { createLspEslintTests } from './scenarios/lsp-eslint';
import { createLspExternalProjectTests } from './scenarios/lsp-external-project';
import { createLspGoTests } from './scenarios/lsp-go';
import { createLspLargeFileTests } from './scenarios/lsp-large-file';
import { createLspPerFileRootTests } from './scenarios/lsp-per-file-root';
import { createLspPythonTests } from './scenarios/lsp-python';
import { createLspRustTests } from './scenarios/lsp-rust';
import { createMountIsolationTests } from './scenarios/mount-isolation';
import { createMountRoutingTests } from './scenarios/mount-routing';
import { createMultiMountTests } from './scenarios/multi-mount';
import { createReadOnlyMountTests } from './scenarios/read-only-mount';
import { createVirtualDirectoryTests } from './scenarios/virtual-directory';
import { createWriteReadConsistencyTests } from './scenarios/write-read-consistency';
import type { WorkspaceIntegrationTestConfig } from './types';

/**
 * Create integration tests for workspace providers.
 *
 * @example
 * ```typescript
 * createWorkspaceIntegrationTests({
 *   suiteName: 'S3 CompositeFilesystem Integration',
 *   createWorkspace: () => {
 *     return new Workspace({
 *       mounts: {
 *         '/mount-a': new S3Filesystem({ bucket: 'test', prefix: 'a' }),
 *         '/mount-b': new S3Filesystem({ bucket: 'test', prefix: 'b' }),
 *       },
 *     });
 *   },
 *   testScenarios: {
 *     mountRouting: true,
 *     crossMountApi: true,
 *     virtualDirectory: true,
 *     mountIsolation: true,
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
    sandboxPathsAligned = true,
  } = config;

  describe(suiteName, () => {
    let workspace: Workspace;

    beforeAll(async () => {
      workspace = await createWorkspace();
      await workspace.init();
    }, 180000); // Allow 3 minutes for setup

    afterAll(async () => {
      if (!workspace) return;
      try {
        if (cleanupWorkspace) {
          await cleanupWorkspace(workspace);
        }
      } finally {
        await workspace.destroy();
      }
    }, 60000);

    // Generate a unique path per test so that afterEach cleanup and the
    // test body always reference the same directory.
    let currentTestPath: string;

    beforeEach(() => {
      const basePath = generateTestPath('int-test');

      // For CompositeFilesystem, put test files under the first mount
      // so paths work for both filesystem API and sandbox commands.
      if (workspace.filesystem instanceof CompositeFilesystem) {
        const firstMount = workspace.filesystem.mountPaths[0]!;
        currentTestPath = `${firstMount}${basePath}`;
      } else if (workspace.filesystem && 'basePath' in workspace.filesystem) {
        // Filesystem has a basePath (e.g. LocalFilesystem) — use it so that
        // both the filesystem API and sandbox commands reference the same
        // absolute path on disk.  Without this, the generated path (e.g.
        // /int-test-xxx) would be treated as a host-root path by the sandbox
        // while the filesystem resolves it relative to basePath.
        const fsBasePath = (workspace.filesystem as { basePath?: unknown }).basePath;
        if (typeof fsBasePath === 'string' && fsBasePath.length > 0) {
          const relativeBasePath = basePath.replace(/^[/\\]+/, '');
          currentTestPath = join(fsBasePath, relativeBasePath);
        } else {
          currentTestPath = basePath;
        }
      } else {
        currentTestPath = basePath;
      }
    });

    const getContext = () => ({
      workspace,
      getTestPath: () => currentTestPath,
      testTimeout,
      fastOnly,
      sandboxPathsAligned,
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

    if (testScenarios.concurrentOperations === true) {
      createConcurrentOperationsTests(getContext);
    }

    if (testScenarios.largeFileHandling === true) {
      createLargeFileHandlingTests(getContext);
    }

    if (testScenarios.writeReadConsistency === true) {
      createWriteReadConsistencyTests(getContext);
    }

    // LSP scenarios (require sandbox with process manager + LSP deps)
    if (testScenarios.lspDiagnostics === true) {
      createLspDiagnosticsTests(getContext);
    }

    if (testScenarios.lspPerFileRoot === true) {
      createLspPerFileRootTests(getContext);
    }

    if (testScenarios.lspLargeFile === true) {
      createLspLargeFileTests(getContext);
    }

    if (testScenarios.lspPython === true) {
      createLspPythonTests(getContext);
    }

    if (testScenarios.lspCrossFile === true) {
      createLspCrossFileTests(getContext);
    }

    if (testScenarios.lspExternalProject === true) {
      createLspExternalProjectTests(getContext);
    }

    if (testScenarios.lspGo === true) {
      createLspGoTests(getContext);
    }

    if (testScenarios.lspRust === true) {
      createLspRustTests(getContext);
    }

    if (testScenarios.lspEslint === true) {
      createLspEslintTests(getContext);
    }

    // Composite-specific scenarios (require CompositeFilesystem with 2+ mounts)
    const hasCompositeScenarios =
      testScenarios.mountRouting === true ||
      testScenarios.crossMountApi === true ||
      testScenarios.virtualDirectory === true ||
      testScenarios.mountIsolation === true;

    if (hasCompositeScenarios) {
      // Guard: defer the instanceof check to test-time (after beforeAll has run)
      // by wrapping in a describe block that validates the precondition.
      describe('Composite Filesystem', () => {
        beforeAll(() => {
          if (!(workspace.filesystem instanceof CompositeFilesystem)) {
            throw new Error(
              `${suiteName}: composite scenarios (mountRouting, crossMountApi, virtualDirectory, mountIsolation) ` +
                `require a Workspace with mounts. Got ${workspace.filesystem?.constructor.name ?? 'no filesystem'} instead.`,
            );
          }
        });

        if (testScenarios.mountRouting === true) {
          createMountRoutingTests(getContext);
        }

        if (testScenarios.crossMountApi === true) {
          createCrossMountApiTests(getContext);
        }

        if (testScenarios.virtualDirectory === true) {
          createVirtualDirectoryTests(getContext);
        }

        if (testScenarios.mountIsolation === true) {
          createMountIsolationTests(getContext);
        }
      });
    }
  });
}
