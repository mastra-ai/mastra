# Workspace Providers Shared Test Suite Design

This document outlines the design for a shared test suite for workspace providers (filesystems and sandboxes).

---

## Overview

Create a shared test suite following the patterns established in `stores/_test-utils` and `server-adapters/_test-utils`. The test suite will:

1. Provide reusable test factories for filesystem and sandbox providers
2. Support capability flags for provider-specific limitations
3. Enable both unit tests and integration tests
4. Allow provider-specific tests alongside shared tests

---

## Directory Structure

```
workspaces/
├── _test-utils/                          # Shared test utilities package
│   ├── package.json                      # @internal/workspace-test-utils
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                      # Main exports
│       │
│       ├── filesystem/
│       │   ├── index.ts                  # Filesystem test exports
│       │   ├── factory.ts                # createFilesystemTestSuite()
│       │   ├── config-validation.ts      # createFilesystemConfigTests()
│       │   ├── test-helpers.ts           # Mock data, utilities
│       │   └── domains/
│       │       ├── file-operations.ts    # read, write, append, delete, copy, move
│       │       ├── directory-ops.ts      # mkdir, rmdir, readdir
│       │       ├── path-operations.ts    # exists, stat, isFile, isDirectory
│       │       ├── error-handling.ts     # FileNotFoundError, PermissionError
│       │       ├── lifecycle.ts          # init, destroy, status transitions
│       │       └── mount-config.ts       # getMountConfig, readOnly enforcement
│       │
│       ├── sandbox/
│       │   ├── index.ts                  # Sandbox test exports
│       │   ├── factory.ts                # createSandboxTestSuite()
│       │   ├── config-validation.ts      # createSandboxConfigTests()
│       │   ├── test-helpers.ts           # Mock commands, utilities
│       │   └── domains/
│       │       ├── command-execution.ts  # executeCommand tests
│       │       ├── lifecycle.ts          # start, stop, destroy, status
│       │       ├── mount-operations.ts   # mount(), unmount(), reconcile
│       │       └── reconnection.ts       # Sandbox reconnection tests
│       │
│       └── integration/
│           ├── index.ts                  # Integration test exports
│           ├── factory.ts                # createWorkspaceIntegrationTests()
│           └── scenarios/
│               ├── file-sync.ts          # Write file, read via sandbox
│               ├── multi-mount.ts        # Multiple filesystems at different paths
│               └── cross-mount-copy.ts   # Copy between mounts
│
├── e2b/                                  # E2B Sandbox Provider
│   ├── src/
│   │   ├── sandbox/                      # If only sandbox (current structure)
│   │   │   └── e2b-sandbox.ts
│   │   └── __tests__/
│   │       ├── e2b-sandbox.test.ts       # Shared tests via factory
│   │       └── e2b-specific.test.ts      # E2B-specific tests (templates, reconnect)
│   └── package.json
│
├── s3/                                   # S3 Filesystem Provider
│   ├── src/
│   │   ├── filesystem/                   # If only filesystem
│   │   │   └── s3-filesystem.ts
│   │   └── __tests__/
│   │       ├── s3-filesystem.test.ts     # Shared tests via factory
│   │       └── s3-specific.test.ts       # S3-specific tests (multipart, presigned)
│   └── package.json
│
├── gcs/                                  # GCS Filesystem Provider
│   ├── src/
│   │   ├── filesystem/
│   │   │   └── gcs-filesystem.ts
│   │   └── __tests__/
│   │       ├── gcs-filesystem.test.ts    # Shared tests via factory
│   │       └── gcs-specific.test.ts      # GCS-specific tests
│   └── package.json
│
└── daytona/                              # Example: Provider with BOTH
    ├── src/
    │   ├── filesystem/                   # Daytona filesystem
    │   │   └── daytona-filesystem.ts
    │   ├── sandbox/                      # Daytona sandbox
    │   │   └── daytona-sandbox.ts
    │   └── __tests__/
    │       ├── daytona-filesystem.test.ts
    │       ├── daytona-sandbox.test.ts
    │       ├── daytona-integration.test.ts  # Tests both together
    │       └── daytona-specific.test.ts
    └── package.json
```

---

## Core Interfaces

### Filesystem Test Configuration

```typescript
interface FilesystemTestConfig {
  /** Display name for test suite */
  suiteName: string;

  /** Factory to create filesystem instance for testing */
  createFilesystem: () => Promise<WorkspaceFilesystem>;

  /** Cleanup after tests (delete test files, etc.) */
  cleanupFilesystem?: (fs: WorkspaceFilesystem) => Promise<void>;

  /** Capability flags - skip tests for unsupported features */
  capabilities?: FilesystemCapabilities;

  /** Test domains to run (default: all) */
  testDomains?: FilesystemTestDomains;
}

interface FilesystemCapabilities {
  /** Supports append operations (default: true) */
  supportsAppend?: boolean;

  /** Supports symbolic links (default: false) */
  supportsSymlinks?: boolean;

  /** Supports binary files (default: true) */
  supportsBinaryFiles?: boolean;

  /** Supports file permissions (default: false) */
  supportsPermissions?: boolean;

  /** Supports case-sensitive paths (default: true) */
  supportsCaseSensitive?: boolean;

  /** Supports concurrent operations (default: true) */
  supportsConcurrency?: boolean;

  /** Supports getMountConfig() for sandbox mounting */
  supportsMounting?: boolean;

  /** Maximum file size for tests (default: 10MB) */
  maxTestFileSize?: number;
}

interface FilesystemTestDomains {
  fileOperations?: boolean;    // read, write, append, delete, copy, move
  directoryOps?: boolean;      // mkdir, rmdir, readdir
  pathOperations?: boolean;    // exists, stat, isFile, isDirectory
  errorHandling?: boolean;     // FileNotFoundError, PermissionError
  lifecycle?: boolean;         // init, destroy, status transitions
  mountConfig?: boolean;       // getMountConfig, readOnly enforcement
}
```

### Sandbox Test Configuration

```typescript
interface SandboxTestConfig {
  /** Display name for test suite */
  suiteName: string;

  /** Factory to create sandbox instance for testing */
  createSandbox: () => Promise<WorkspaceSandbox>;

  /** Cleanup after tests */
  cleanupSandbox?: (sandbox: WorkspaceSandbox) => Promise<void>;

  /** Capability flags */
  capabilities?: SandboxCapabilities;

  /** Test domains to run (default: all) */
  testDomains?: SandboxTestDomains;
}

interface SandboxCapabilities {
  /** Supports mounting filesystems (default: false) */
  supportsMounting?: boolean;

  /** Supports reconnection to existing sandbox (default: false) */
  supportsReconnection?: boolean;

  /** Supports concurrent command execution (default: true) */
  supportsConcurrency?: boolean;

  /** Supports environment variables (default: true) */
  supportsEnvVars?: boolean;

  /** Supports working directory changes (default: true) */
  supportsWorkingDirectory?: boolean;

  /** Supports command timeout (default: true) */
  supportsTimeout?: boolean;

  /** Default command timeout for tests (ms) */
  defaultTimeout?: number;
}

interface SandboxTestDomains {
  commandExecution?: boolean;  // executeCommand tests
  lifecycle?: boolean;         // start, stop, destroy, status
  mountOperations?: boolean;   // mount(), unmount(), reconcile
  reconnection?: boolean;      // Sandbox reconnection tests
}
```

### Integration Test Configuration

```typescript
interface WorkspaceIntegrationTestConfig {
  /** Display name for test suite */
  suiteName: string;

  /** Create a complete workspace with filesystem and sandbox */
  createWorkspace: () => Promise<{
    workspace: Workspace;
    filesystem: WorkspaceFilesystem;
    sandbox: WorkspaceSandbox;
  }>;

  /** Cleanup after tests */
  cleanupWorkspace?: (workspace: Workspace) => Promise<void>;

  /** Test scenarios to run (default: all) */
  testScenarios?: IntegrationTestScenarios;
}

interface IntegrationTestScenarios {
  fileSync?: boolean;        // Write file via API, read via sandbox command
  multiMount?: boolean;      // Multiple filesystems at different paths
  crossMountCopy?: boolean;  // Copy between different mounts
  readOnlyMount?: boolean;   // Verify readOnly enforcement end-to-end
}
```

---

## Factory Function Signatures

### Filesystem Test Suite

```typescript
/**
 * Create a comprehensive test suite for a filesystem provider.
 *
 * @example
 * ```typescript
 * import { createFilesystemTestSuite } from '@internal/workspace-test-utils';
 * import { S3Filesystem } from '../s3-filesystem';
 *
 * createFilesystemTestSuite({
 *   suiteName: 'S3Filesystem',
 *   createFilesystem: async () => new S3Filesystem({
 *     bucket: process.env.TEST_BUCKET!,
 *     region: 'us-east-1',
 *     credentials: { ... },
 *   }),
 *   capabilities: {
 *     supportsAppend: false,  // S3 doesn't support native append
 *     supportsMounting: true,
 *   },
 * });
 * ```
 */
export function createFilesystemTestSuite(config: FilesystemTestConfig): void;
```

### Sandbox Test Suite

```typescript
/**
 * Create a comprehensive test suite for a sandbox provider.
 *
 * @example
 * ```typescript
 * import { createSandboxTestSuite } from '@internal/workspace-test-utils';
 * import { E2BSandbox } from '../e2b-sandbox';
 *
 * createSandboxTestSuite({
 *   suiteName: 'E2BSandbox',
 *   createSandbox: async () => new E2BSandbox({
 *     timeout: 60000,
 *   }),
 *   capabilities: {
 *     supportsMounting: true,
 *     supportsReconnection: true,
 *   },
 * });
 * ```
 */
export function createSandboxTestSuite(config: SandboxTestConfig): void;
```

### Config Validation Tests

```typescript
/**
 * Create tests for valid and invalid configuration handling.
 *
 * @example
 * ```typescript
 * createFilesystemConfigTests({
 *   providerName: 'S3Filesystem',
 *   createProvider: (config) => new S3Filesystem(config as any),
 *   validConfigs: [
 *     { description: 'minimal config', config: { bucket: 'test' } },
 *     { description: 'with region', config: { bucket: 'test', region: 'us-west-2' } },
 *   ],
 *   invalidConfigs: [
 *     { description: 'missing bucket', config: {}, expectedError: /bucket.*required/i },
 *   ],
 * });
 * ```
 */
export function createFilesystemConfigTests(config: ConfigTestConfig): void;
export function createSandboxConfigTests(config: ConfigTestConfig): void;
```

---

## Test Domains Detail

### Filesystem: File Operations

```typescript
// domains/file-operations.ts
export function createFileOperationsTests(config: FilesystemTestConfig) {
  describe('File Operations', () => {
    describe('readFile', () => {
      it('reads text file content');
      it('reads binary file content');
      it('reads with encoding option');
      it('throws FileNotFoundError for missing file');
    });

    describe('writeFile', () => {
      it('writes text content');
      it('writes binary content');
      it('creates parent directories if needed');
      it('overwrites existing file');
      it('respects readOnly flag');
    });

    describe('appendFile', () => {
      it('appends to existing file');
      it('creates file if not exists');
      // Skip if !capabilities.supportsAppend
    });

    describe('deleteFile', () => {
      it('deletes existing file');
      it('throws FileNotFoundError for missing file');
      it('succeeds with force option for missing file');
      it('respects readOnly flag');
    });

    describe('copyFile', () => {
      it('copies file to new location');
      it('overwrites with overwrite option');
      it('throws if source missing');
    });

    describe('moveFile', () => {
      it('moves file to new location');
      it('removes source after move');
      it('respects readOnly flag on source and dest');
    });
  });
}
```

### Filesystem: Lifecycle

```typescript
// domains/lifecycle.ts
export function createLifecycleTests(config: FilesystemTestConfig) {
  describe('Lifecycle', () => {
    it('starts with pending status');
    it('transitions to initializing then ready on init()');
    it('handles concurrent init() calls safely');
    it('transitions to destroyed on destroy()');
    it('operations fail after destroy');
    it('ensureReady() auto-initializes if pending');
  });
}
```

### Sandbox: Mount Operations

```typescript
// domains/mount-operations.ts
export function createMountOperationsTests(config: SandboxTestConfig) {
  describe('Mount Operations', () => {
    it('mounts filesystem at specified path');
    it('creates mount directory if needed');
    it('writes marker file after successful mount');
    it('detects existing mount on reconnect');
    it('remounts if config changed');
    it('unmounts and cleans up directory');
    it('handles mount errors gracefully');
  });
}
```

---

## Test Helpers

### Mock Data Generators

```typescript
// test-helpers.ts

/** Generate random text content of specified size */
export function generateTextContent(sizeBytes: number): string;

/** Generate random binary content */
export function generateBinaryContent(sizeBytes: number): Buffer;

/** Generate unique test path */
export function generateTestPath(prefix?: string): string;

/** Create a test directory structure */
export interface TestDirectoryStructure {
  [name: string]: string | Buffer | TestDirectoryStructure;
}
export async function createTestStructure(
  fs: WorkspaceFilesystem,
  basePath: string,
  structure: TestDirectoryStructure
): Promise<void>;

/** Clean up test directory */
export async function cleanupTestPath(
  fs: WorkspaceFilesystem,
  path: string
): Promise<void>;
```

### Mock Providers (for unit tests)

```typescript
/** In-memory filesystem for fast unit tests */
export class MockFilesystem implements WorkspaceFilesystem {
  // Full implementation backed by Map<string, Buffer>
}

/** Mock sandbox that doesn't execute real commands */
export class MockSandbox implements WorkspaceSandbox {
  // Returns predefined responses
}
```

---

## Usage Examples

### S3 Filesystem Tests

```typescript
// workspaces/s3/src/__tests__/s3-filesystem.test.ts

import { createFilesystemTestSuite, createFilesystemConfigTests } from '@internal/workspace-test-utils';
import { S3Filesystem } from '../filesystem/s3-filesystem';

// Shared test suite
createFilesystemTestSuite({
  suiteName: 'S3Filesystem',
  createFilesystem: async () => new S3Filesystem({
    bucket: process.env.S3_TEST_BUCKET!,
    region: process.env.AWS_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
    prefix: `test-${Date.now()}/`,  // Isolate test runs
  }),
  cleanupFilesystem: async (fs) => {
    // Delete test prefix
    await fs.rmdir('/', { recursive: true, force: true });
  },
  capabilities: {
    supportsAppend: false,  // S3 doesn't support native append
    supportsMounting: true,
    supportsCaseSensitive: true,
  },
});

// Config validation tests
createFilesystemConfigTests({
  providerName: 'S3Filesystem',
  createProvider: (config) => new S3Filesystem(config as any),
  validConfigs: [
    { description: 'minimal with bucket', config: { bucket: 'test' } },
    { description: 'with region', config: { bucket: 'test', region: 'us-west-2' } },
    { description: 'with credentials', config: { bucket: 'test', credentials: { accessKeyId: 'x', secretAccessKey: 'y' } } },
    { description: 'with custom endpoint (R2)', config: { bucket: 'test', endpoint: 'https://xxx.r2.cloudflarestorage.com' } },
  ],
  invalidConfigs: [
    { description: 'missing bucket', config: {}, expectedError: /bucket/i },
    { description: 'empty bucket', config: { bucket: '' }, expectedError: /bucket/i },
  ],
});
```

### S3-Specific Tests

```typescript
// workspaces/s3/src/__tests__/s3-specific.test.ts

import { S3Filesystem } from '../filesystem/s3-filesystem';

describe('S3Filesystem - S3-Specific Features', () => {
  describe('S3-compatible endpoints', () => {
    it('works with Cloudflare R2 endpoint');
    it('works with MinIO endpoint');
    it('works with GCS S3-compatible endpoint');
  });

  describe('getMountConfig', () => {
    it('returns correct s3 mount config');
    it('includes credentials in mount config');
    it('includes custom endpoint for R2/GCS');
  });

  describe('large files', () => {
    it('handles multipart upload for large files');
  });
});
```

### E2B Sandbox Tests

```typescript
// workspaces/e2b/src/__tests__/e2b-sandbox.test.ts

import { createSandboxTestSuite, createSandboxConfigTests } from '@internal/workspace-test-utils';
import { E2BSandbox } from '../sandbox/e2b-sandbox';

// Shared test suite
createSandboxTestSuite({
  suiteName: 'E2BSandbox',
  createSandbox: async () => new E2BSandbox({
    id: `test-${Date.now()}`,
    timeout: 60000,
  }),
  cleanupSandbox: async (sandbox) => {
    await sandbox.destroy();
  },
  capabilities: {
    supportsMounting: true,
    supportsReconnection: true,
    supportsEnvVars: true,
    defaultTimeout: 30000,
  },
});

// Config validation
createSandboxConfigTests({
  providerName: 'E2BSandbox',
  createProvider: (config) => new E2BSandbox(config as any),
  validConfigs: [
    { description: 'minimal', config: {} },
    { description: 'with timeout', config: { timeout: 120000 } },
    { description: 'with template', config: { template: 'base' } },
  ],
  invalidConfigs: [
    { description: 'negative timeout', config: { timeout: -1 }, expectedError: /timeout/i },
  ],
});
```

### E2B-Specific Tests

```typescript
// workspaces/e2b/src/__tests__/e2b-specific.test.ts

import { E2BSandbox } from '../sandbox/e2b-sandbox';

describe('E2BSandbox - E2B-Specific Features', () => {
  describe('template handling', () => {
    it('uses default template when not specified');
    it('builds custom template from function');
    it('caches built templates');
    it('rebuilds template on cache miss');
  });

  describe('reconnection', () => {
    it('reconnects to existing sandbox by metadata');
    it('reconciles mounts after reconnection');
    it('detects stale mounts and cleans up');
  });

  describe('S3 mounting', () => {
    it('mounts S3 bucket via s3fs');
    it('passes credentials securely');
    it('handles public bucket (no credentials)');
    it('respects readOnly flag');
  });

  describe('GCS mounting', () => {
    it('mounts GCS bucket via gcsfuse');
    it('handles service account credentials');
  });
});
```

### Integration Tests

```typescript
// workspaces/e2b/src/__tests__/e2b-integration.test.ts

import { createWorkspaceIntegrationTests } from '@internal/workspace-test-utils';
import { Workspace } from '@mastra/core/workspace';
import { E2BSandbox } from '../sandbox/e2b-sandbox';
import { S3Filesystem } from '@mastra/s3';

createWorkspaceIntegrationTests({
  suiteName: 'E2B + S3 Integration',
  createWorkspace: async () => {
    const filesystem = new S3Filesystem({
      bucket: process.env.S3_TEST_BUCKET!,
      credentials: { ... },
    });
    const sandbox = new E2BSandbox({ timeout: 60000 });
    const workspace = new Workspace({
      mounts: { '/data': filesystem },
      sandbox,
    });
    return { workspace, filesystem, sandbox };
  },
  testScenarios: {
    fileSync: true,
    multiMount: false,  // Single mount in this config
    crossMountCopy: false,
    readOnlyMount: true,
  },
});
```

---

## Environment Variables for Integration Tests

```bash
# E2B
E2B_API_KEY=<your-e2b-api-key>

# AWS S3
AWS_ACCESS_KEY_ID=<your-aws-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret>
S3_TEST_BUCKET=<your-test-bucket>
AWS_REGION=us-east-1

# GCS (S3-compatible)
GCS_HMAC_ACCESS_KEY=<your-hmac-access-key>
GCS_HMAC_SECRET_KEY=<your-hmac-secret-key>
GCS_TEST_BUCKET=<your-gcs-test-bucket>

# GCS (native)
GCS_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
GCS_PROJECT_ID=<your-project-id>

# Cloudflare R2
R2_ACCESS_KEY_ID=<your-r2-key>
R2_SECRET_ACCESS_KEY=<your-r2-secret>
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_TEST_BUCKET=<your-r2-bucket>
```

---

## Package Configuration

```json
// workspaces/_test-utils/package.json
{
  "name": "@internal/workspace-test-utils",
  "version": "0.0.1",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./filesystem": {
      "import": "./dist/filesystem/index.js",
      "types": "./dist/filesystem/index.d.ts"
    },
    "./sandbox": {
      "import": "./dist/sandbox/index.js",
      "types": "./dist/sandbox/index.d.ts"
    },
    "./integration": {
      "import": "./dist/integration/index.js",
      "types": "./dist/integration/index.d.ts"
    }
  },
  "devDependencies": {
    "@mastra/core": "workspace:*",
    "vitest": "catalog:"
  }
}
```

---

## Implementation Order

1. **Phase 1: Package Setup**
   - Create `workspaces/_test-utils/` package structure
   - Set up build configuration
   - Add to workspace dependencies

2. **Phase 2: Filesystem Tests**
   - Implement `createFilesystemTestSuite()`
   - Implement domain test factories
   - Add `MockFilesystem` for unit tests
   - Apply to `LocalFilesystem`, `S3Filesystem`, `GCSFilesystem`

3. **Phase 3: Sandbox Tests**
   - Implement `createSandboxTestSuite()`
   - Implement domain test factories
   - Add `MockSandbox` for unit tests
   - Apply to `LocalSandbox`, `E2BSandbox`

4. **Phase 4: Integration Tests**
   - Implement `createWorkspaceIntegrationTests()`
   - Implement scenario factories
   - Apply to E2B + S3, E2B + GCS combinations

5. **Phase 5: Provider-Specific Tests**
   - Add S3-specific tests
   - Add E2B-specific tests
   - Add GCS-specific tests

---

## Design Decisions

### 1. CI Environment

**Decision:** Skip integration tests if credentials are missing.

```typescript
// In test file
const hasS3Credentials = process.env.AWS_ACCESS_KEY_ID && process.env.S3_TEST_BUCKET;

describe.skipIf(!hasS3Credentials)('S3Filesystem Integration', () => {
  createFilesystemTestSuite({ ... });
});
```

### 2. Test Isolation

**Decision:** Provider-specific cleanup via factory pattern.

Each provider implements its own cleanup logic in the `cleanupFilesystem` / `cleanupSandbox` callback:

```typescript
createFilesystemTestSuite({
  suiteName: 'S3Filesystem',
  createFilesystem: async () => {
    const prefix = `test-${Date.now()}-${Math.random().toString(36).slice(2)}/`;
    return new S3Filesystem({ bucket: TEST_BUCKET, prefix });
  },
  cleanupFilesystem: async (fs) => {
    // S3-specific: delete all objects with test prefix
    await fs.rmdir('/', { recursive: true, force: true });
  },
});
```

### 3. Timeout Handling

**Decision:** Both separate fast/slow suites AND configurable timeouts.

```typescript
interface FilesystemTestConfig {
  // ... existing fields ...

  /** Timeout for individual tests (default: 5000ms) */
  testTimeout?: number;

  /** Run only fast tests (skip slow operations like large file tests) */
  fastOnly?: boolean;
}

// In domain tests
describe('Large File Operations', () => {
  it.skipIf(config.fastOnly)('handles 100MB file', async () => {
    // Slow test
  }, config.testTimeout ?? 30000);
});
```

### 4. CompositeFilesystem

**Decision:** Both its own test suite AND integration tests.

- **Own test suite**: Test path routing, mount resolution, readOnly enforcement, virtual directories
- **Integration tests**: Test with real mounted filesystems in workspace context

```typescript
// packages/core/src/workspace/filesystem/__tests__/composite-filesystem.test.ts
createFilesystemTestSuite({
  suiteName: 'CompositeFilesystem',
  createFilesystem: async () => new CompositeFilesystem({
    mounts: {
      '/local': new MockFilesystem(),
      '/memory': new MockFilesystem({ readOnly: true }),
    },
  }),
  capabilities: {
    // CompositeFilesystem delegates to underlying filesystems
    supportsAppend: true,
    supportsMounting: false,  // CompositeFilesystem IS the mount layer
  },
});

// Additional CompositeFilesystem-specific tests
describe('CompositeFilesystem - Routing', () => {
  it('routes to correct filesystem based on path');
  it('returns virtual entries for mount root');
  it('enforces readOnly on underlying filesystem');
  it('handles cross-mount copy');
});
```
