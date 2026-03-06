/**
 * @internal/workspace-test-utils
 *
 * Shared test utilities for workspace providers (filesystems and sandboxes).
 * Follows patterns from stores/_test-utils and server-adapters/_test-utils.
 */

// Filesystem test utilities
export {
  createFilesystemTestSuite,
  createFilesystemConfigTests,
  type FilesystemTestConfig,
  type FilesystemCapabilities,
  type FilesystemTestDomains,
  type ConfigTestConfig,
} from './filesystem';

// Sandbox test utilities
export {
  createSandboxTestSuite,
  createSandboxConfigTests,
  createSandboxLifecycleTests,
  createMountOperationsTests,
  createProcessManagementTests,
  type SandboxTestConfig,
  type SandboxCapabilities,
  type SandboxTestDomains,
} from './sandbox';

// Integration test utilities
export {
  createWorkspaceIntegrationTests,
  type WorkspaceIntegrationTestConfig,
  type IntegrationTestScenarios,
} from './integration';

// Mock providers for unit tests
export { MockFilesystem } from './filesystem/mock-filesystem';
export { MockSandbox } from './sandbox/mock-sandbox';

// Test helpers
export {
  generateTextContent,
  generateBinaryContent,
  generateTestPath,
  createTestStructure,
  cleanupTestPath,
  type TestDirectoryStructure,
} from './test-helpers';
