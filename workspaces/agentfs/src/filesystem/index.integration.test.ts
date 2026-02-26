/**
 * AgentFS Filesystem Integration Tests
 *
 * Conformance test suite against a real AgentFS SQLite database.
 * No mocks — every test hits the real agentfs-sdk.
 */

import { createFilesystemTestSuite } from '@internal/workspace-test-utils/filesystem';

import { AgentFSFilesystem } from './index';

createFilesystemTestSuite({
  suiteName: 'AgentFSFilesystem Conformance',
  createFilesystem: () => {
    return new AgentFSFilesystem({
      agentId: `conformance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    });
  },
  cleanupFilesystem: async fs => {
    try {
      const files = await fs.readdir('/');
      for (const file of files) {
        if (file.type === 'file') {
          await fs.deleteFile(`/${file.name}`, { force: true });
        } else if (file.type === 'directory') {
          await fs.rmdir(`/${file.name}`, { recursive: true });
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  },
  capabilities: {
    supportsAppend: true,
    supportsBinaryFiles: true,
    supportsForceDelete: true,
    supportsOverwrite: true,
    supportsConcurrency: true,
    supportsEmptyDirectories: true,
    deleteThrowsOnMissing: true,
  },
  testTimeout: 30000,
});
