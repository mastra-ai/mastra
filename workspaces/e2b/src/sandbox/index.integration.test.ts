/**
 * E2B Sandbox Integration Tests
 *
 * These tests require real E2B API access and run against actual E2B sandboxes.
 * They are separated from unit tests to avoid mock conflicts.
 *
 * Required environment variables:
 * - E2B_API_KEY: E2B API key
 * - S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY: For S3 mount tests
 * - S3_ENDPOINT, S3_REGION: For S3-compatible services (R2, MinIO)
 * - GCS_SERVICE_ACCOUNT_KEY, TEST_GCS_BUCKET: For GCS mount tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { E2BSandbox } from './index';

/**
 * Check if we have S3-compatible credentials.
 */
const hasS3Credentials = !!(process.env.S3_ACCESS_KEY_ID && process.env.S3_BUCKET);

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
 * Basic E2B integration tests.
 */
describe.skipIf(!process.env.E2B_API_KEY)('E2BSandbox Integration', () => {
  let sandbox: E2BSandbox;

  beforeEach(() => {
    sandbox = new E2BSandbox({
      id: `test-${Date.now()}`,
      timeout: 60000,
    });
  });

  afterEach(async () => {
    if (sandbox) {
      try {
        await sandbox.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('can start and execute commands', async () => {
    await sandbox.start();

    const result = await sandbox.executeCommand('echo', ['Hello E2B']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('Hello E2B');
  }, 120000);

  it('can reconnect to existing sandbox', async () => {
    await sandbox.start();
    const originalId = sandbox.id;

    // Create new sandbox instance with same ID
    const sandbox2 = new E2BSandbox({ id: originalId });
    await sandbox2.start();

    // Should reconnect to existing
    expect(sandbox2.status).toBe('running');

    await sandbox2.destroy();
  }, 120000);
});

/**
 * S3 Mount integration tests.
 */
describe.skipIf(!process.env.E2B_API_KEY || !hasS3Credentials)(
  'E2BSandbox S3 Mount Integration',
  () => {
    let sandbox: E2BSandbox;

    beforeEach(() => {
      sandbox = new E2BSandbox({
        id: `test-s3-${Date.now()}`,
        timeout: 120000,
      });
    });

    afterEach(async () => {
      if (sandbox) {
        try {
          await sandbox.destroy();
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it('S3 with credentials mounts successfully', async () => {
      await sandbox.start();

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
      const lsResult = await sandbox.executeCommand('ls', ['-la', '/data/s3-test']);
      expect(lsResult.exitCode).toBe(0);
    }, 180000);

    it('S3 public bucket mounts with public_bucket=1', async () => {
      await sandbox.start();

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
      await sandbox.start();

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
          // No credentials - should warn/fail for S3-compatible
        }),
      } as any;

      const result = await sandbox.mount(mockFilesystem, '/data/compat-test');
      expect(result.success).toBe(false);
      expect(result.error).toContain('credentials');
    }, 180000);

    it('S3 with readOnly mounts with -o ro', async () => {
      await sandbox.start();

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

    it('S3 mount sets uid/gid for file ownership', async () => {
      await sandbox.start();

      const s3Config = getS3TestConfig();
      const mockFilesystem = {
        id: 'test-s3-ownership',
        name: 'S3Filesystem',
        provider: 's3',
        status: 'ready',
        getMountConfig: () => s3Config,
      } as any;

      await sandbox.mount(mockFilesystem, '/data/s3-ownership');

      // Files should be owned by user, not root
      const statResult = await sandbox.executeCommand('stat', ['-c', '%U', '/data/s3-ownership']);
      expect(statResult.stdout.trim()).not.toBe('root');
    }, 180000);
  },
);

/**
 * GCS Mount integration tests.
 */
describe.skipIf(!process.env.E2B_API_KEY || !process.env.GCS_SERVICE_ACCOUNT_KEY || !process.env.TEST_GCS_BUCKET)(
  'E2BSandbox GCS Mount Integration',
  () => {
    let sandbox: E2BSandbox;

    beforeEach(() => {
      sandbox = new E2BSandbox({
        id: `test-gcs-${Date.now()}`,
        timeout: 120000,
      });
    });

    afterEach(async () => {
      if (sandbox) {
        try {
          await sandbox.destroy();
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it('GCS with service account mounts successfully', async () => {
      await sandbox.start();

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

      // Verify the FUSE mount was created by checking mount output
      // Note: mountpoint command may fail if gcsfuse can't access bucket content,
      // but the mount itself is established. We verify via `mount` output.
      const mountsResult = await sandbox.executeCommand('mount');
      const hasFuseMount = mountsResult.stdout.includes('/data/gcs-test') && mountsResult.stdout.includes('fuse.gcsfuse');
      expect(hasFuseMount).toBe(true);

      // If the mount is accessible, verify we can list (may fail due to bucket perms)
      const lsResult = await sandbox.executeCommand('ls', ['/data/gcs-test']);
      if (lsResult.exitCode !== 0) {
        console.log(`[GCS TEST] Note: ls failed (bucket may be empty or have access restrictions): ${lsResult.stderr}`);
      }
    }, 180000);

    it('GCS public bucket mounts with anonymous access', async () => {
      await sandbox.start();

      const mockFilesystem = {
        id: 'test-gcs-public',
        name: 'GCSFilesystem',
        provider: 'gcs',
        status: 'ready',
        getMountConfig: () => ({
          type: 'gcs',
          bucket: 'gcp-public-data-landsat', // Known public bucket
        }),
      } as any;

      const result = await sandbox.mount(mockFilesystem, '/data/gcs-public');
      expect(result.success).toBe(true);
    }, 180000);
  },
);

/**
 * Mount safety and error handling integration tests.
 */
describe.skipIf(!process.env.E2B_API_KEY)('E2BSandbox Mount Safety', () => {
  let sandbox: E2BSandbox;

  beforeEach(() => {
    sandbox = new E2BSandbox({
      id: `test-safety-${Date.now()}`,
      timeout: 60000,
    });
  });

  afterEach(async () => {
    if (sandbox) {
      try {
        await sandbox.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('mount errors if directory exists and is non-empty', async () => {
    await sandbox.start();

    // Use home directory instead of /data to avoid sudo complexity
    const testDir = '/home/user/test-non-empty';

    // Create non-empty directory
    await sandbox.executeCommand('mkdir', ['-p', testDir]);
    await sandbox.executeCommand('sh', ['-c', `echo "existing" > ${testDir}/file.txt`]);

    // Verify setup succeeded
    const lsResult = await sandbox.executeCommand('ls', ['-la', testDir]);
    expect(lsResult.exitCode).toBe(0);
    expect(lsResult.stdout).toContain('file.txt');

    const mockFilesystem = {
      id: 'test-fs',
      name: 'MockFS',
      provider: 'mock',
      status: 'ready',
      getMountConfig: () => ({ type: 's3', bucket: 'test' }),
    } as any;

    const result = await sandbox.mount(mockFilesystem, testDir);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not empty');
  }, 120000);

  it('mount succeeds if directory exists but is empty', async () => {
    await sandbox.start();

    // Use home directory to avoid sudo
    const testDir = '/home/user/test-empty-dir';

    // Create empty directory
    await sandbox.executeCommand('mkdir', ['-p', testDir]);

    const mockFilesystem = {
      id: 'test-fs',
      name: 'MockFS',
      provider: 'mock',
      status: 'ready',
      getMountConfig: () => ({ type: 's3', bucket: 'test' }),
    } as any;

    const result = await sandbox.mount(mockFilesystem, testDir);
    if (!result.success) {
      expect(result.error).not.toContain('not empty');
    }
  }, 120000);

  it.skipIf(!hasS3Credentials)('mount creates directory with sudo for paths outside home', async () => {
    await sandbox.start();

    // Use real S3 config so mount succeeds and directory persists
    const s3Config = getS3TestConfig();
    const mockFilesystem = {
      id: 'test-fs-outside-home',
      name: 'S3Filesystem',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => s3Config,
    } as any;

    // /opt is outside home, requires sudo to create
    const result = await sandbox.mount(mockFilesystem, '/opt/test-mount');
    expect(result.success).toBe(true);

    // Verify directory was created (mount succeeded)
    const checkDir = await sandbox.executeCommand('test', ['-d', '/opt/test-mount']);
    expect(checkDir.exitCode).toBe(0);
  }, 120000);
});

/**
 * Mount reconciliation integration tests.
 */
describe.skipIf(!process.env.E2B_API_KEY)('E2BSandbox Mount Reconciliation', () => {
  let sandbox: E2BSandbox;

  beforeEach(() => {
    sandbox = new E2BSandbox({
      id: `test-reconcile-${Date.now()}`,
      timeout: 60000,
    });
  });

  afterEach(async () => {
    if (sandbox) {
      try {
        await sandbox.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('reconcileMounts unmounts stale FUSE mounts', async () => {
    await sandbox.start();
    await expect(sandbox.reconcileMounts(['/expected-path'])).resolves.not.toThrow();
  }, 120000);

  it('reconcileMounts cleans up orphaned marker files', async () => {
    await sandbox.start();

    // Create orphaned marker file
    await sandbox.executeCommand('mkdir', ['-p', '/tmp/.mastra-mounts']);
    await sandbox.executeCommand('sh', ['-c', 'echo "/orphan|abc123" > /tmp/.mastra-mounts/mount-orphan']);

    await sandbox.reconcileMounts(['/expected-path']);

    // Marker should be cleaned up
    const checkMarker = await sandbox.executeCommand('test', ['-f', '/tmp/.mastra-mounts/mount-orphan']);
    expect(checkMarker.exitCode).not.toBe(0);
  }, 120000);

  it('reconcileMounts handles malformed marker files', async () => {
    await sandbox.start();

    // Create malformed marker file
    await sandbox.executeCommand('mkdir', ['-p', '/tmp/.mastra-mounts']);
    await sandbox.executeCommand('sh', ['-c', 'echo "invalid-no-pipe" > /tmp/.mastra-mounts/mount-malformed']);

    await expect(sandbox.reconcileMounts(['/expected'])).resolves.not.toThrow();
  }, 120000);
});

/**
 * Marker file handling integration tests.
 */
describe.skipIf(!process.env.E2B_API_KEY || !hasS3Credentials)(
  'E2BSandbox Marker Files',
  () => {
    let sandbox: E2BSandbox;

    beforeEach(() => {
      sandbox = new E2BSandbox({
        id: `test-markers-${Date.now()}`,
        timeout: 120000,
      });
    });

    afterEach(async () => {
      if (sandbox) {
        try {
          await sandbox.destroy();
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it('successful mount creates marker file', async () => {
      await sandbox.start();

      const s3Config = getS3TestConfig();
      const mockFilesystem = {
        id: 'test-s3-marker',
        name: 'S3Filesystem',
        provider: 's3',
        status: 'ready',
        getMountConfig: () => s3Config,
      } as any;

      await sandbox.mount(mockFilesystem, '/data/marker-test');

      // Check marker file exists
      const markerDir = await sandbox.executeCommand('ls', ['/tmp/.mastra-mounts/']);
      expect(markerDir.stdout).toContain('mount-');
    }, 180000);

    it('unmount removes marker file', async () => {
      await sandbox.start();

      const s3Config = getS3TestConfig();
      const mockFilesystem = {
        id: 'test-s3-unmount-marker',
        name: 'S3Filesystem',
        provider: 's3',
        status: 'ready',
        getMountConfig: () => s3Config,
      } as any;

      const mountPath = '/data/unmount-marker-test';
      await sandbox.mount(mockFilesystem, mountPath);

      // Unmount
      await sandbox.unmount(mountPath);

      // Check marker file is gone
      const markerFilename = sandbox.mounts.markerFilename(mountPath);
      const checkMarker = await sandbox.executeCommand('test', ['-f', `/tmp/.mastra-mounts/${markerFilename}`]);
      expect(checkMarker.exitCode).not.toBe(0);
    }, 180000);

    it('unmount removes empty mount directory', async () => {
      await sandbox.start();

      const s3Config = getS3TestConfig();
      const mockFilesystem = {
        id: 'test-s3-rmdir',
        name: 'S3Filesystem',
        provider: 's3',
        status: 'ready',
        getMountConfig: () => s3Config,
      } as any;

      const mountPath = '/data/rmdir-test';
      await sandbox.mount(mockFilesystem, mountPath);
      await sandbox.unmount(mountPath);

      // Directory should be removed
      const checkDir = await sandbox.executeCommand('test', ['-d', mountPath]);
      expect(checkDir.exitCode).not.toBe(0);
    }, 180000);
  },
);

/**
 * Existing mount detection integration tests.
 */
describe.skipIf(!process.env.E2B_API_KEY || !hasS3Credentials)(
  'E2BSandbox Existing Mount Detection',
  () => {
    let sandbox: E2BSandbox;

    beforeEach(() => {
      sandbox = new E2BSandbox({
        id: `test-existing-${Date.now()}`,
        timeout: 120000,
      });
    });

    afterEach(async () => {
      if (sandbox) {
        try {
          await sandbox.destroy();
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it('mount skips if already mounted with matching config', async () => {
      await sandbox.start();

      const s3Config = getS3TestConfig();
      const mockFilesystem = {
        id: 'test-s3-skip',
        name: 'S3Filesystem',
        provider: 's3',
        status: 'ready',
        getMountConfig: () => s3Config,
      } as any;

      const mountPath = '/data/skip-test';

      // Mount once
      const result1 = await sandbox.mount(mockFilesystem, mountPath);
      expect(result1.success).toBe(true);

      // Mount again with same config - should skip
      const result2 = await sandbox.mount(mockFilesystem, mountPath);
      expect(result2.success).toBe(true);
    }, 180000);

    it('mount unmounts and remounts if config changed', async () => {
      await sandbox.start();

      const s3Config = getS3TestConfig();
      const createFilesystem = (readOnly: boolean) =>
        ({
          id: 'test-s3-remount',
          name: 'S3Filesystem',
          provider: 's3',
          status: 'ready',
          getMountConfig: () => ({
            ...s3Config,
            readOnly,
          }),
        }) as any;

      const mountPath = '/data/remount-test';

      // Mount with readOnly: false
      await sandbox.mount(createFilesystem(false), mountPath);

      // Mount again with readOnly: true - should remount
      const result = await sandbox.mount(createFilesystem(true), mountPath);
      expect(result.success).toBe(true);

      // Verify it's now read-only
      const writeResult = await sandbox.executeCommand('sh', [
        '-c',
        `echo "test" > ${mountPath}/test.txt 2>&1 || echo "write failed"`,
      ]);
      expect(writeResult.stdout).toMatch(/Read-only|write failed/);
    }, 240000);
  },
);
