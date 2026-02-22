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
 * filesystem, and contained: false treats those as absolute host paths.
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
  },
  createWorkspace: () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'ws-local-contained-'));
    const filesystem = new LocalFilesystem({ basePath: tempDir, contained: true });
    const sandbox = new LocalSandbox({ workingDirectory: tempDir, env: process.env });
    return new Workspace({ filesystem, sandbox });
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
  },
  createWorkspace: () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'ws-local-uncontained-'));
    const filesystem = new LocalFilesystem({ basePath: tempDir, contained: false });
    const sandbox = new LocalSandbox({ workingDirectory: tempDir, env: process.env });
    return new Workspace({ filesystem, sandbox });
  },
});

// =============================================================================
// 3. Mounts with LocalFilesystem (contained: true) + LocalSandbox
//
// Only composite API-only scenarios are enabled. Sandbox-dependent scenarios
// (fileSync, crossMountCopy) don't work with local mounts because there is
// no FUSE bridge — sandbox commands use host paths while the filesystem API
// resolves paths relative to each mount's basePath.
// =============================================================================

createWorkspaceIntegrationTests({
  suiteName: 'Local Workspace with Mounts (contained: true)',
  testTimeout: 30000,
  testScenarios: {
    fileSync: false,
    mountRouting: true,
    crossMountApi: true,
    virtualDirectory: true,
    mountIsolation: true,
  },
  createWorkspace: () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'ws-mounts-contained-'));
    const mountADir = join(tempDir, 'mount-a');
    const mountBDir = join(tempDir, 'mount-b');
    mkdirSync(mountADir, { recursive: true });
    mkdirSync(mountBDir, { recursive: true });

    const sandbox = new LocalSandbox({ workingDirectory: tempDir, env: process.env });
    return new Workspace({
      sandbox,
      mounts: {
        '/mount-a': new LocalFilesystem({ basePath: mountADir, contained: true }),
        '/mount-b': new LocalFilesystem({ basePath: mountBDir, contained: true }),
      },
    });
  },
});
