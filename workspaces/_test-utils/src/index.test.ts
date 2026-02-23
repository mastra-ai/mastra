/**
 * Shared workspace integration tests with local providers.
 *
 * Runs the shared integration test suite against LocalFilesystem + LocalSandbox
 * to validate the factories themselves and ensure the local providers pass all
 * integration scenarios.
 *
 * Tests three configurations:
 * 1. LocalFilesystem (contained: true) + LocalSandbox
 * 2. LocalFilesystem (contained: false) + LocalSandbox
 * 3. Mounts with LocalFilesystem (contained: true) + LocalSandbox
 *
 * Note: Mounts with contained: false is not tested because CompositeFilesystem
 * passes `/`-prefixed paths (after stripping the mount prefix) to each mount's
 * filesystem, and contained: false treats those as absolute host paths (COR-554).
 */

import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LocalFilesystem, LocalSandbox, Workspace } from '@mastra/core/workspace';

import { createWorkspaceIntegrationTests } from './integration';

// =============================================================================
// 1. LocalFilesystem (contained: true) + LocalSandbox
// =============================================================================

createWorkspaceIntegrationTests({
  suiteName: 'Local Workspace (contained: true)',
  testTimeout: 30000,
  testScenarios: {
    fileSync: true,
    writeReadConsistency: true,
    concurrentOperations: true,
    largeFileHandling: true,
    lspDiagnostics: true,
    lspPerFileRoot: true,
    lspLargeFile: true,
    lspPython: true,
    lspCrossFile: true,
    lspGo: true,
    lspRust: true,
    lspEslint: true,
  },
  createWorkspace: () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'ws-local-contained-'));
    const filesystem = new LocalFilesystem({ basePath: tempDir, contained: true });
    const sandbox = new LocalSandbox({ workingDirectory: tempDir, env: process.env });
    return new Workspace({ filesystem, sandbox, lsp: { diagnosticTimeout: 10000 } });
  },
});

// =============================================================================
// 2. LocalFilesystem (contained: false) + LocalSandbox
// =============================================================================

createWorkspaceIntegrationTests({
  suiteName: 'Local Workspace (contained: false)',
  testTimeout: 30000,
  testScenarios: {
    fileSync: true,
    writeReadConsistency: true,
    concurrentOperations: true,
    largeFileHandling: true,
    lspDiagnostics: true,
    lspPerFileRoot: true,
    lspLargeFile: true,
    lspPython: true,
    lspCrossFile: true,
    lspExternalProject: true,
    lspGo: true,
    lspRust: true,
    lspEslint: true,
  },
  createWorkspace: () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'ws-local-uncontained-'));
    const filesystem = new LocalFilesystem({ basePath: tempDir, contained: false });
    const sandbox = new LocalSandbox({ workingDirectory: tempDir, env: process.env });
    return new Workspace({ filesystem, sandbox, lsp: { diagnosticTimeout: 10000 } });
  },
});

// =============================================================================
// 3. Mounts with LocalFilesystem (contained: true) + LocalSandbox
//
// Mount paths use the actual disk paths (e.g. /tmp/.../mount-a) so that both
// the CompositeFilesystem API and sandbox commands reference the same absolute
// paths. This enables sandbox-dependent scenarios (fileSync, crossMountCopy).
//
// virtualDirectory is excluded because readdir('/') with deeply nested mount
// paths returns intermediate path segments instead of mount names.
//
// readOnlyMount is excluded because LocalSandbox writes directly to disk,
// bypassing the API-level readOnly flag. (readOnly is tested at the API level
// in the filesystem conformance tests.)
// =============================================================================

createWorkspaceIntegrationTests({
  suiteName: 'Local Workspace with Mounts (contained: true)',
  testTimeout: 30000,
  testScenarios: {
    fileSync: true,
    writeReadConsistency: true,
    concurrentOperations: true,
    largeFileHandling: true,
    multiMount: true,
    crossMountCopy: true,
    mountRouting: true,
    crossMountApi: true,
    mountIsolation: true,
    lspDiagnostics: true,
    lspPerFileRoot: true,
    lspLargeFile: true,
    lspPython: true,
    lspCrossFile: true,
    lspGo: true,
    lspRust: true,
    lspEslint: true,
  },
  createWorkspace: () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'ws-mounts-'));
    const mountADir = join(tempDir, 'mount-a');
    const mountBDir = join(tempDir, 'mount-b');
    mkdirSync(mountADir, { recursive: true });
    mkdirSync(mountBDir, { recursive: true });

    const sandbox = new LocalSandbox({ workingDirectory: tempDir, env: process.env });
    return new Workspace({
      sandbox,
      lsp: { diagnosticTimeout: 10000 },
      mounts: {
        [mountADir]: new LocalFilesystem({ basePath: mountADir, contained: true }),
        [mountBDir]: new LocalFilesystem({ basePath: mountBDir, contained: true }),
      },
    });
  },
});

// =============================================================================
// 4. LocalFilesystem (contained: true) with subdirectory basePath
//
// basePath points to a subdirectory below where tsconfig.json lives.
// With contained: true, walkUpAsync can't see above basePath → falls back to
// default root. Verifies LSP still returns diagnostics using default settings.
// =============================================================================

createWorkspaceIntegrationTests({
  suiteName: 'Local Workspace (contained: true, subdirectory basePath)',
  testTimeout: 30000,
  testScenarios: {
    lspDiagnostics: true,
  },
  createWorkspace: () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'ws-local-subdir-'));
    const srcDir = join(projectDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    // basePath is src/ — tsconfig.json sits one level above in projectDir
    const filesystem = new LocalFilesystem({ basePath: srcDir, contained: true });
    const sandbox = new LocalSandbox({ workingDirectory: srcDir, env: process.env });
    return new Workspace({ filesystem, sandbox, lsp: { diagnosticTimeout: 10000 } });
  },
});
