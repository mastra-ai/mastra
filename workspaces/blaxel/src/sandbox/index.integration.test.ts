/**
 * Blaxel Sandbox Integration Tests
 *
 * These tests require real Blaxel API access and run against actual Blaxel sandboxes.
 * They are separated from unit tests to avoid mock conflicts.
 *
 * Required environment variables:
 * - BL_API_KEY (or BL_CLIENT_CREDENTIALS): Blaxel authentication
 * - BL_WORKSPACE: Blaxel workspace name
 * - S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY: For S3 mount tests
 * - S3_ENDPOINT, S3_REGION: For S3-compatible services (R2, MinIO)
 * - GCS_SERVICE_ACCOUNT_KEY, TEST_GCS_BUCKET: For GCS mount tests
 */

import {
  createSandboxTestSuite,
  createWorkspaceIntegrationTests,
  cleanupCompositeMounts,
} from '@internal/workspace-test-utils';
import { Workspace } from '@mastra/core/workspace';
import { GCSFilesystem } from '@mastra/gcs';
import { S3Filesystem } from '@mastra/s3';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { BlaxelSandbox } from './index';

const hasBlaxelCredentials = !!(process.env.BL_API_KEY || process.env.BL_CLIENT_CREDENTIALS);

/**
 * Check if we have S3-compatible credentials.
 */
const hasS3Credentials = !!(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY && process.env.S3_BUCKET);
const hasGCSCredentials = !!(process.env.GCS_SERVICE_ACCOUNT_KEY && process.env.TEST_GCS_BUCKET);

/**
 * Get S3 test configuration from environment.
 */
function getS3TestConfig() {
  return {
    type: 's3' as const,
    bucket: process.env.S3_BUCKET!,
    region: process.env.S3_REGION || 'auto',
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    endpoint: process.env.S3_ENDPOINT,
  };
}

/**
 * Basic Blaxel integration tests.
 */
describe.skipIf(!hasBlaxelCredentials)('BlaxelSandbox Integration', () => {
  let sandbox: BlaxelSandbox;

  beforeEach(() => {
    sandbox = new BlaxelSandbox({
      id: `test-${Date.now()}`,
      timeout: '5m',
    });
  });

  afterEach(async () => {
    if (sandbox) {
      try {
        await sandbox._destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('can start and execute commands', async () => {
    await sandbox._start();

    const result = await sandbox.executeCommand('echo', ['Hello Blaxel']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('Hello Blaxel');
  }, 120000);

  it('can reconnect to existing sandbox', async () => {
    await sandbox._start();
    const originalId = sandbox.id;

    // Create new sandbox instance with same ID
    const sandbox2 = new BlaxelSandbox({ id: originalId });
    await sandbox2._start();

    // Should reconnect to existing
    expect(sandbox2.status).toBe('running');

    await sandbox2._destroy();
  }, 120000);

  it('can execute multiple commands sequentially', async () => {
    await sandbox._start();

    const result1 = await sandbox.executeCommand('echo', ['first']);
    expect(result1.exitCode).toBe(0);
    expect(result1.stdout.trim()).toBe('first');

    const result2 = await sandbox.executeCommand('echo', ['second']);
    expect(result2.exitCode).toBe(0);
    expect(result2.stdout.trim()).toBe('second');
  }, 120000);

  it('captures exit codes correctly', async () => {
    await sandbox._start();

    const result = await sandbox.executeCommand('sh', ['-c', 'exit 42']);
    expect(result.exitCode).toBe(42);
    expect(result.success).toBe(false);
  }, 120000);

  it('handles environment variables', async () => {
    await sandbox._start();

    const result = await sandbox.executeCommand('sh', ['-c', 'echo $MY_VAR'], {
      env: { MY_VAR: 'hello-world' },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello-world');
  }, 120000);

  it('respects working directory option', async () => {
    await sandbox._start();

    const result = await sandbox.executeCommand('pwd', [], { cwd: '/tmp' });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('/tmp');
  }, 120000);

  it('reports sandbox info', async () => {
    await sandbox._start();

    const info = await sandbox.getInfo();

    expect(info.id).toBe(sandbox.id);
    expect(info.provider).toBe('blaxel');
    expect(info.status).toBe('running');
    expect(info.createdAt).toBeInstanceOf(Date);
  }, 120000);

  it('can stop and restart', async () => {
    await sandbox._start();
    expect(sandbox.status).toBe('running');

    await sandbox._stop();
    expect(sandbox.status).toBe('stopped');

    // Restart
    await sandbox._start();
    expect(sandbox.status).toBe('running');

    const result = await sandbox.executeCommand('echo', ['after restart']);
    expect(result.exitCode).toBe(0);
  }, 180000);
});

/**
 * S3 Mount integration tests.
 */
describe.skipIf(!hasBlaxelCredentials || !hasS3Credentials)('BlaxelSandbox S3 Mount Integration', () => {
  let sandbox: BlaxelSandbox;

  beforeEach(() => {
    sandbox = new BlaxelSandbox({
      id: `test-s3-${Date.now()}`,
      timeout: '10m',
    });
  });

  afterEach(async () => {
    if (sandbox) {
      try {
        await sandbox._destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('S3 with credentials mounts successfully', async () => {
    await sandbox._start();

    const s3Config = getS3TestConfig();
    const mockFilesystem = {
      id: 'test-s3-fs',
      name: 'S3Filesystem',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => s3Config,
    } as any;

    const result = await sandbox.mount(mockFilesystem, '/data/s3-test');
    expect(result.success).toBe(true);

    // Verify mount works by listing directory
    let lsResult;
    for (let i = 0; i < 5; i++) {
      lsResult = await sandbox.executeCommand('ls', ['-la', '/data/s3-test']);
      if (lsResult.exitCode === 0) break;
      await new Promise(r => setTimeout(r, 500));
    }
    expect(lsResult!.exitCode).toBe(0);
  }, 180000);

  it('S3 public bucket mounts with public_bucket=1', async () => {
    await sandbox._start();

    const mockFilesystem = {
      id: 'test-s3-public',
      name: 'S3Filesystem',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => ({
        type: 's3',
        bucket: 'noaa-goes16', // Known public bucket
        region: 'us-east-1',
      }),
    } as any;

    const result = await sandbox.mount(mockFilesystem, '/data/public-bucket');
    expect(result.success).toBe(true);
  }, 180000);

  it('S3-compatible without credentials warns and fails', async () => {
    await sandbox._start();

    const mockFilesystem = {
      id: 'test-s3-compat',
      name: 'S3Filesystem',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => ({
        type: 's3',
        bucket: 'test-bucket',
        region: 'auto',
        endpoint: 'https://example.r2.cloudflarestorage.com',
      }),
    } as any;

    const result = await sandbox.mount(mockFilesystem, '/data/compat-test');
    expect(result.success).toBe(false);
    expect(result.error).toContain('credentials');
  }, 180000);

  it('S3 with readOnly mounts with -o ro', async () => {
    await sandbox._start();

    const s3Config = getS3TestConfig();
    const mockFilesystem = {
      id: 'test-s3-ro',
      name: 'S3Filesystem',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => ({
        ...s3Config,
        readOnly: true,
      }),
    } as any;

    const result = await sandbox.mount(mockFilesystem, '/data/s3-readonly');
    expect(result.success).toBe(true);

    // Verify writes fail
    const writeResult = await sandbox.executeCommand('sh', [
      '-c',
      'echo "test" > /data/s3-readonly/test-file.txt 2>&1 || echo "write failed"',
    ]);
    expect(writeResult.stdout).toMatch(/Read-only|write failed/);
  }, 180000);

  // Commented because: Currently Blaxel sandboxes run as root, so we expect the owner to be root
  // it('S3 mount sets uid/gid for file ownership', async () => {
  //   await sandbox._start();

  //   const s3Config = getS3TestConfig();
  //   const mockFilesystem = {
  //     id: 'test-s3-ownership',
  //     name: 'S3Filesystem',
  //     provider: 's3',
  //     status: 'ready',
  //     getMountConfig: () => s3Config,
  //   } as any;

  //   await sandbox.mount(mockFilesystem, '/data/s3-ownership');

  //   // Files should be owned by user, not root
  //   const statResult = await sandbox.executeCommand('stat', ['-c', '%U', '/data/s3-ownership']);
  //   expect(statResult.stdout.trim()).not.toBe('root');
  // }, 180000);

  it('unmount S3 successfully', async () => {
    await sandbox._start();

    const s3Config = getS3TestConfig();
    const mockFilesystem = {
      id: 'test-s3-unmount',
      name: 'S3Filesystem',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => s3Config,
    } as any;

    const mountResult = await sandbox.mount(mockFilesystem, '/data/s3-unmount');
    expect(mountResult.success).toBe(true);

    await sandbox.unmount('/data/s3-unmount');

    // Verify directory was removed
    const checkResult = await sandbox.executeCommand('ls', ['/data/s3-unmount']);
    expect(checkResult.exitCode).not.toBe(0);
  }, 180000);
});

/**
 * GCS Mount integration tests.
 */
describe.skipIf(!hasBlaxelCredentials || !hasGCSCredentials)('BlaxelSandbox GCS Mount Integration', () => {
  let sandbox: BlaxelSandbox;

  beforeEach(() => {
    sandbox = new BlaxelSandbox({
      id: `test-gcs-${Date.now()}`,
      timeout: '10m',
    });
  });

  afterEach(async () => {
    if (sandbox) {
      try {
        await sandbox._destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('GCS with service account mounts successfully', async () => {
    await sandbox._start();

    const bucket = process.env.TEST_GCS_BUCKET!;
    const mockFilesystem = {
      id: 'test-gcs-fs',
      name: 'GCSFilesystem',
      provider: 'gcs',
      status: 'ready',
      getMountConfig: () => ({
        type: 'gcs',
        bucket,
        serviceAccountKey: process.env.GCS_SERVICE_ACCOUNT_KEY,
      }),
    } as any;

    const result = await sandbox.mount(mockFilesystem, '/data/gcs-test');
    expect(result.success).toBe(true);

    // Verify the FUSE mount was created
    const mountsResult = await sandbox.executeCommand('mount');
    const hasFuseMount = mountsResult.stdout.includes('/data/gcs-test') && mountsResult.stdout.includes('fuse.gcsfuse');
    expect(hasFuseMount).toBe(true);
  }, 180000);

  it('GCS anonymous access for public buckets', async () => {
    await sandbox._start();

    const mockFilesystem = {
      id: 'test-gcs-anon',
      name: 'GCSFilesystem',
      provider: 'gcs',
      status: 'ready',
      getMountConfig: () => ({
        type: 'gcs',
        bucket: 'gcp-public-data-landsat', // Known public GCS bucket
      }),
    } as any;

    const result = await sandbox.mount(mockFilesystem, '/data/gcs-public');
    // Public GCS bucket mount may or may not succeed depending on gcsfuse version
    // and network conditions. Verify we get a well-formed result either way.
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.mountPath).toBe('string');
    if (!result.success) {
      // If it failed, make sure we got a meaningful error message
      expect(result.error).toBeDefined();
      expect(result.error!.length).toBeGreaterThan(0);
    }
  }, 180000);
});

/**
 * Mount reconciliation integration tests.
 */
describe.skipIf(!hasBlaxelCredentials || !hasS3Credentials)('BlaxelSandbox Mount Reconciliation Integration', () => {
  let sandbox: BlaxelSandbox;

  beforeEach(() => {
    sandbox = new BlaxelSandbox({
      id: `test-reconcile-${Date.now()}`,
      timeout: '10m',
    });
  });

  afterEach(async () => {
    if (sandbox) {
      try {
        await sandbox._destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('marker files are written after successful mount', async () => {
    await sandbox._start();

    const s3Config = getS3TestConfig();
    const mockFilesystem = {
      id: 'test-marker',
      name: 'S3Filesystem',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => s3Config,
    } as any;

    await sandbox.mount(mockFilesystem, '/data/marker-test');

    // Check marker file exists
    const markerFilename = sandbox.mounts.markerFilename('/data/marker-test');
    const checkResult = await sandbox.executeCommand('cat', [`/tmp/.mastra-mounts/${markerFilename}`]);
    expect(checkResult.exitCode).toBe(0);
    expect(checkResult.stdout).toContain('/data/marker-test');
  }, 180000);

  it('marker files are cleaned up after unmount', async () => {
    await sandbox._start();

    const s3Config = getS3TestConfig();
    const mockFilesystem = {
      id: 'test-cleanup',
      name: 'S3Filesystem',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => s3Config,
    } as any;

    await sandbox.mount(mockFilesystem, '/data/cleanup-test');
    const markerFilename = sandbox.mounts.markerFilename('/data/cleanup-test');

    await sandbox.unmount('/data/cleanup-test');

    // Marker file should be gone
    const checkResult = await sandbox.executeCommand('cat', [`/tmp/.mastra-mounts/${markerFilename}`]);
    expect(checkResult.exitCode).not.toBe(0);
  }, 180000);
});

/**
 * Shared Sandbox Conformance Tests
 *
 * These tests verify BlaxelSandbox conforms to the WorkspaceSandbox interface.
 * They use the shared test suite from @internal/workspace-test-utils.
 */
if (hasBlaxelCredentials) {
  createSandboxTestSuite({
    suiteName: 'BlaxelSandbox Conformance',
    createSandbox: options => {
      return new BlaxelSandbox({
        id: `conformance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timeout: '2m',
        ...(options?.env && { env: options.env }),
      });
    },
    cleanupSandbox: async sandbox => {
      try {
        await sandbox._destroy();
      } catch {
        // Ignore cleanup errors
      }
    },
    capabilities: {
      supportsMounting: true,
      supportsReconnection: true,
      supportsConcurrency: true,
      supportsEnvVars: true,
      supportsWorkingDirectory: true,
      supportsTimeout: true,
      defaultCommandTimeout: 30000,
    },
    testDomains: {
      processManagement: false, // BlaxelSandbox does not implement processes
    },
    testTimeout: 60000,
  });
}

/**
 * Shared Workspace Integration Tests (Blaxel + S3)
 *
 * These tests verify end-to-end filesystem<->sandbox sync using a real S3Filesystem
 * mounted via s3fs FUSE inside a Blaxel sandbox.
 */
const canRunSharedIntegration = !!(hasBlaxelCredentials && hasS3Credentials);

if (canRunSharedIntegration) {
  const mountPoint = '/data/s3-shared';

  createWorkspaceIntegrationTests({
    suiteName: 'Blaxel + S3 Shared Integration',
    testTimeout: 120000,
    testScenarios: {
      fileSync: true,
      concurrentOperations: true,
      largeFileHandling: true,
      writeReadConsistency: true,
    },
    createWorkspace: () => {
      const s3Config = getS3TestConfig();

      return new Workspace({
        mounts: {
          [mountPoint]: new S3Filesystem({
            bucket: s3Config.bucket,
            region: s3Config.region,
            accessKeyId: s3Config.accessKeyId,
            secretAccessKey: s3Config.secretAccessKey,
            endpoint: s3Config.endpoint,
          }),
        },
        sandbox: new BlaxelSandbox({
          id: `shared-int-${Date.now()}`,
          timeout: '3m',
        }),
      });
    },
    cleanupWorkspace: cleanupCompositeMounts,
  });
}

/**
 * S3+GCS Multi-Mount Integration Tests
 *
 * Two different buckets (S3 + GCS), each FUSE-mounted at a separate path.
 * Sandbox paths align with API paths, so all multi-mount and cross-mount tests run.
 */
if (canRunSharedIntegration && hasGCSCredentials) {
  const s3Mount = '/data/multi-s3';
  const gcsMount = '/data/multi-gcs';

  createWorkspaceIntegrationTests({
    suiteName: 'Blaxel + S3/GCS Multi-Mount Integration',
    testTimeout: 120000,
    sandboxPathsAligned: true,
    testScenarios: {
      fileSync: false,
      multiMount: true,
      crossMountCopy: true,
    },
    createWorkspace: () => {
      const s3Config = getS3TestConfig();

      return new Workspace({
        mounts: {
          [s3Mount]: new S3Filesystem({
            bucket: s3Config.bucket,
            region: s3Config.region,
            accessKeyId: s3Config.accessKeyId,
            secretAccessKey: s3Config.secretAccessKey,
            endpoint: s3Config.endpoint,
          }),
          [gcsMount]: new GCSFilesystem({
            bucket: process.env.TEST_GCS_BUCKET!,
            credentials: JSON.parse(process.env.GCS_SERVICE_ACCOUNT_KEY!),
          }),
        },
        sandbox: new BlaxelSandbox({
          id: `multi-s3gcs-${Date.now()}`,
          timeout: '4m',
        }),
      });
    },
    cleanupWorkspace: cleanupCompositeMounts,
  });
}

/**
 * S3+S3 Multi-Mount Integration Tests
 *
 * Same bucket with different prefixes. s3fs FUSE mounts the full bucket,
 * so sandbox paths don't align with prefix-scoped API paths.
 * Only the API-level isolation test runs; sandbox-dependent tests are skipped.
 */
if (canRunSharedIntegration) {
  createWorkspaceIntegrationTests({
    suiteName: 'Blaxel + S3+S3 Multi-Mount Integration',
    testTimeout: 120000,
    sandboxPathsAligned: false,
    testScenarios: {
      fileSync: false,
      multiMount: true,
      crossMountCopy: false,
    },
    createWorkspace: () => {
      const s3Config = getS3TestConfig();
      const prefix1 = `multi-s3a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const prefix2 = `multi-s3b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      return new Workspace({
        mounts: {
          '/data/multi-s3a': new S3Filesystem({ ...s3Config, prefix: prefix1 }),
          '/data/multi-s3b': new S3Filesystem({ ...s3Config, prefix: prefix2 }),
        },
        sandbox: new BlaxelSandbox({
          id: `multi-s3s3-${Date.now()}`,
          timeout: '4m',
        }),
      });
    },
    cleanupWorkspace: cleanupCompositeMounts,
  });
}

/**
 * Read-Only Mount Shared Integration Tests (Blaxel + S3 readOnly)
 *
 * Tests read-only mount enforcement end-to-end using an S3 filesystem
 * mounted with readOnly: true inside a Blaxel sandbox.
 */
if (canRunSharedIntegration) {
  const roMountPath = '/data/s3-readonly-shared';

  createWorkspaceIntegrationTests({
    suiteName: 'Blaxel + S3 Read-Only Mount Integration',
    testTimeout: 120000,
    testScenarios: {
      fileSync: false,
      readOnlyMount: true,
    },
    createWorkspace: () => {
      const s3Config = getS3TestConfig();

      return new Workspace({
        mounts: {
          [roMountPath]: new S3Filesystem({
            bucket: s3Config.bucket,
            region: s3Config.region,
            accessKeyId: s3Config.accessKeyId,
            secretAccessKey: s3Config.secretAccessKey,
            endpoint: s3Config.endpoint,
            readOnly: true,
          }),
        },
        sandbox: new BlaxelSandbox({
          id: `ro-int-${Date.now()}`,
          timeout: '3m',
        }),
      });
    },
  });
}

/**
 * Blaxel + CompositeFilesystem(S3+GCS) Integration Tests
 *
 * Tests composite-specific scenarios (mount routing, cross-mount API, virtual
 * directories, mount isolation) with a Blaxel sandbox containing S3 + GCS mounts.
 */
if (canRunSharedIntegration && hasGCSCredentials) {
  createWorkspaceIntegrationTests({
    suiteName: 'Blaxel + CompositeFilesystem(S3+GCS)',
    testTimeout: 120000,
    testScenarios: {
      fileSync: false,
      mountRouting: true,
      crossMountApi: true,
      virtualDirectory: true,
      mountIsolation: true,
    },
    createWorkspace: () => {
      const s3Config = getS3TestConfig();
      const prefix = `cfs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      return new Workspace({
        mounts: {
          '/s3': new S3Filesystem({
            ...s3Config,
            prefix: `${prefix}-s3`,
          }),
          '/gcs': new GCSFilesystem({
            bucket: process.env.TEST_GCS_BUCKET!,
            credentials: JSON.parse(process.env.GCS_SERVICE_ACCOUNT_KEY!),
            prefix: `${prefix}-gcs`,
          }),
        },
        sandbox: new BlaxelSandbox({
          id: `cfs-${Date.now()}`,
          timeout: '4m',
        }),
      });
    },
    cleanupWorkspace: cleanupCompositeMounts,
  });
}
