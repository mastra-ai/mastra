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

import {
  createSandboxTestSuite,
  createWorkspaceIntegrationTests,
  cleanupCompositeMounts,
} from '@internal/workspace-test-utils';
import { Workspace } from '@mastra/core/workspace';
import { GCSFilesystem } from '@mastra/gcs';
import { S3Filesystem } from '@mastra/s3';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { E2BSandbox } from './index';

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
        await sandbox._destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('can start and execute commands', async () => {
    await sandbox._start();

    const result = await sandbox.executeCommand('echo', ['Hello E2B']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('Hello E2B');
  }, 120000);

  it('can reconnect to existing sandbox', async () => {
    await sandbox._start();
    const originalId = sandbox.id;

    // Create new sandbox instance with same ID
    const sandbox2 = new E2BSandbox({ id: originalId });
    await sandbox2._start();

    // Should reconnect to existing
    expect(sandbox2.status).toBe('running');

    await sandbox2._destroy();
  }, 120000);
});

/**
 * S3 Mount integration tests.
 */
describe.skipIf(!process.env.E2B_API_KEY || !hasS3Credentials)('E2BSandbox S3 Mount Integration', () => {
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

    // Verify mount works by listing directory (FUSE mount may need a moment to become accessible)
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
        // No credentials - should warn/fail for S3-compatible
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

  it('S3 mount sets uid/gid for file ownership', async () => {
    await sandbox._start();

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
});

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

      // Verify the FUSE mount was created by checking mount output
      // Note: mountpoint command may fail if gcsfuse can't access bucket content,
      // but the mount itself is established. We verify via `mount` output.
      const mountsResult = await sandbox.executeCommand('mount');
      const hasFuseMount =
        mountsResult.stdout.includes('/data/gcs-test') && mountsResult.stdout.includes('fuse.gcsfuse');
      expect(hasFuseMount).toBe(true);

      // If the mount is accessible, verify we can list (may fail due to bucket perms)
      const lsResult = await sandbox.executeCommand('ls', ['/data/gcs-test']);
      if (lsResult.exitCode !== 0) {
        console.log(`[GCS TEST] Note: ls failed (bucket may be empty or have access restrictions): ${lsResult.stderr}`);
      }
    }, 180000);

    it('full workflow: mount GCS and verify FUSE mount', async () => {
      // 1. Start sandbox
      await sandbox._start();
      expect(sandbox.status).toBe('running');

      // 2. Mount GCS filesystem
      const bucket = process.env.TEST_GCS_BUCKET!;
      const mockFilesystem = {
        id: 'test-gcs-workflow',
        name: 'GCSFilesystem',
        provider: 'gcs',
        status: 'ready',
        getMountConfig: () => ({
          type: 'gcs',
          bucket,
          serviceAccountKey: process.env.GCS_SERVICE_ACCOUNT_KEY,
        }),
      } as any;

      const mountPath = '/data/gcs-workflow-test';
      const mountResult = await sandbox.mount(mockFilesystem, mountPath);
      expect(mountResult.success).toBe(true);

      // 3. Verify the FUSE mount was created
      const mountsResult = await sandbox.executeCommand('mount');
      const hasFuseMount = mountsResult.stdout.includes(mountPath) && mountsResult.stdout.includes('fuse.gcsfuse');
      expect(hasFuseMount).toBe(true);

      // 4. Try file operations (may fail depending on bucket permissions)
      const lsResult = await sandbox.executeCommand('ls', [mountPath]);
      if (lsResult.exitCode === 0) {
        // Bucket is accessible - try write/read cycle
        const testContent = `gcs-test-${Date.now()}`;
        const testFile = `${mountPath}/workflow-test-file.txt`;
        const writeResult = await sandbox.executeCommand('sh', ['-c', `echo "${testContent}" > ${testFile}`]);

        if (writeResult.exitCode === 0) {
          const readResult = await sandbox.executeCommand('cat', [testFile]);
          expect(readResult.exitCode).toBe(0);
          expect(readResult.stdout.trim()).toBe(testContent);
          await sandbox.executeCommand('rm', [testFile]);
        }
      } else {
        console.log(`[GCS TEST] Note: ls failed (bucket may have access restrictions): ${lsResult.stderr}`);
      }
    }, 240000);

    it('GCS public bucket mounts with anonymous access', async () => {
      await sandbox._start();

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
        await sandbox._destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('mount errors if directory exists and is non-empty', async () => {
    await sandbox._start();

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
    expect(result.error).toContain(`Cannot mount at ${testDir}: directory exists and is not empty`);
    expect(result.error).toContain('Mounting would hide existing files');
    expect(result.error).toContain('Use a different path or empty the directory first');
  }, 120000);

  it('mount succeeds if directory exists but is empty', async () => {
    await sandbox._start();

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
    // Empty directory should not block mounting
    if (!result.success) {
      // If mount failed, it should NOT be because of non-empty directory
      expect(result.error).not.toContain('not empty');
    } else {
      expect(result.success).toBe(true);
    }
  }, 120000);

  it.skipIf(!hasS3Credentials)(
    'mount creates directory with sudo for paths outside home',
    async () => {
      await sandbox._start();

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

      // Verify directory is owned by the current user (sudo chown was used)
      const ownerCheck = await sandbox.executeCommand('sh', ['-c', 'stat -c "%u" /opt/test-mount']);
      const currentUid = await sandbox.executeCommand('id', ['-u']);
      expect(ownerCheck.stdout.trim()).toBe(currentUid.stdout.trim());
    },
    120000,
  );
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
        await sandbox._destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('reconcileMounts unmounts stale FUSE mounts', async () => {
    await sandbox._start();

    // Create a fake stale mount marker so reconcile has something to clean
    await sandbox.executeCommand('mkdir', ['-p', '/tmp/.mastra-mounts']);
    await sandbox.executeCommand('sh', ['-c', 'echo "/data/stale-mount|deadbeef" > /tmp/.mastra-mounts/mount-stale']);

    await expect(sandbox.reconcileMounts(['/expected-path'])).resolves.not.toThrow();

    // The stale marker should be cleaned up since its path is not in expected list
    const checkStaleMarker = await sandbox.executeCommand('test', ['-f', '/tmp/.mastra-mounts/mount-stale']);
    expect(checkStaleMarker.exitCode).not.toBe(0);
  }, 120000);

  it('reconcileMounts cleans up orphaned marker files', async () => {
    await sandbox._start();

    // Create orphaned marker file
    await sandbox.executeCommand('mkdir', ['-p', '/tmp/.mastra-mounts']);
    await sandbox.executeCommand('sh', ['-c', 'echo "/orphan|abc123" > /tmp/.mastra-mounts/mount-orphan']);

    await sandbox.reconcileMounts(['/expected-path']);

    // Marker should be cleaned up
    const checkMarker = await sandbox.executeCommand('test', ['-f', '/tmp/.mastra-mounts/mount-orphan']);
    expect(checkMarker.exitCode).not.toBe(0);
  }, 120000);

  it('reconcileMounts handles malformed marker files', async () => {
    await sandbox._start();

    // Create malformed marker file (no pipe separator = invalid format)
    await sandbox.executeCommand('mkdir', ['-p', '/tmp/.mastra-mounts']);
    await sandbox.executeCommand('sh', ['-c', 'echo "invalid-no-pipe" > /tmp/.mastra-mounts/mount-malformed']);

    await expect(sandbox.reconcileMounts(['/expected'])).resolves.not.toThrow();

    // Malformed marker should be deleted
    const checkMalformed = await sandbox.executeCommand('test', ['-f', '/tmp/.mastra-mounts/mount-malformed']);
    expect(checkMalformed.exitCode).not.toBe(0);
  }, 120000);
});

/**
 * Marker file handling integration tests.
 */
describe.skipIf(!process.env.E2B_API_KEY || !hasS3Credentials)('E2BSandbox Marker Files', () => {
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
        await sandbox._destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('successful mount creates marker file', async () => {
    await sandbox._start();

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

    // Verify marker file content is in "path|configHash" format
    const markerFilename = sandbox.mounts.markerFilename('/data/marker-test');
    const markerContent = await sandbox.executeCommand('cat', [`/tmp/.mastra-mounts/${markerFilename}`]);
    expect(markerContent.exitCode).toBe(0);
    expect(markerContent.stdout.trim()).toMatch(/^\/data\/marker-test\|[a-f0-9]+$/);
  }, 180000);

  it('unmount removes marker file', async () => {
    await sandbox._start();

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
    await sandbox._start();

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
});

/**
 * Existing mount detection integration tests.
 */
describe.skipIf(!process.env.E2B_API_KEY || !hasS3Credentials)('E2BSandbox Existing Mount Detection', () => {
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
        await sandbox._destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('mount skips if already mounted with matching config', async () => {
    await sandbox._start();

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

    // Record the marker file content before second mount
    const markerBefore = await sandbox.executeCommand('sh', [
      '-c',
      `cat /tmp/.mastra-mounts/${sandbox.mounts.markerFilename(mountPath)} 2>/dev/null || echo "none"`,
    ]);

    // Mount again with same config - should skip (not remount)
    const result2 = await sandbox.mount(mockFilesystem, mountPath);
    expect(result2.success).toBe(true);

    // Marker file should be identical (mount was skipped, not re-executed)
    const markerAfter = await sandbox.executeCommand('sh', [
      '-c',
      `cat /tmp/.mastra-mounts/${sandbox.mounts.markerFilename(mountPath)} 2>/dev/null || echo "none"`,
    ]);
    expect(markerAfter.stdout).toBe(markerBefore.stdout);
  }, 180000);

  it('mount unmounts and remounts if config changed', async () => {
    await sandbox._start();

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

    // Record marker content (contains configHash)
    const markerFile = `/tmp/.mastra-mounts/${sandbox.mounts.markerFilename(mountPath)}`;
    const markerBefore = await sandbox.executeCommand('cat', [markerFile]);

    // Mount again with readOnly: true - should unmount and remount
    const result = await sandbox.mount(createFilesystem(true), mountPath);
    expect(result.success).toBe(true);

    // Marker should have changed (different configHash proves remount happened)
    const markerAfter = await sandbox.executeCommand('cat', [markerFile]);
    expect(markerAfter.stdout).not.toBe(markerBefore.stdout);

    // Verify it's now read-only
    const writeResult = await sandbox.executeCommand('sh', [
      '-c',
      `echo "test" > ${mountPath}/test.txt 2>&1 || echo "write failed"`,
    ]);
    expect(writeResult.stdout).toMatch(/Read-only|write failed/);
  }, 240000);

  it('readOnly change triggers remount with ro flag', async () => {
    await sandbox._start();

    const s3Config = getS3TestConfig();
    const mountPath = '/data/readonly-remount';

    // Mount writable first
    const writableFs = {
      id: 'test-s3-rw',
      name: 'S3Filesystem',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => ({ ...s3Config, readOnly: false }),
    } as any;

    await sandbox.mount(writableFs, mountPath);

    // Record marker content before remount
    const markerFile = `/tmp/.mastra-mounts/${sandbox.mounts.markerFilename(mountPath)}`;
    const markerBefore = await sandbox.executeCommand('cat', [markerFile]);

    // Verify writable - write should succeed
    const writeOk = await sandbox.executeCommand('sh', [
      '-c',
      `echo "hello" > ${mountPath}/rw-test.txt && echo "write ok"`,
    ]);
    expect(writeOk.stdout).toContain('write ok');

    // Remount as read-only
    const readOnlyFs = {
      id: 'test-s3-rw',
      name: 'S3Filesystem',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => ({ ...s3Config, readOnly: true }),
    } as any;

    const result = await sandbox.mount(readOnlyFs, mountPath);
    expect(result.success).toBe(true);

    // Marker should have changed (unmount + remount with new config)
    const markerAfter = await sandbox.executeCommand('cat', [markerFile]);
    expect(markerAfter.stdout).not.toBe(markerBefore.stdout);

    // Verify read-only - write should fail
    const writeFail = await sandbox.executeCommand('sh', [
      '-c',
      `echo "test" > ${mountPath}/ro-test.txt 2>&1 || echo "write failed"`,
    ]);
    expect(writeFail.stdout).toMatch(/Read-only|write failed/);
  }, 240000);
});

/**
 * Full workflow integration tests - end-to-end scenarios.
 */
describe.skipIf(!process.env.E2B_API_KEY || !hasS3Credentials)('E2BSandbox Full Workflow', () => {
  let sandbox: E2BSandbox;

  beforeEach(() => {
    sandbox = new E2BSandbox({
      id: `test-workflow-${Date.now()}`,
      timeout: 120000,
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

  it('full workflow: create sandbox, mount S3, read/write files', async () => {
    // 1. Start sandbox
    await sandbox._start();
    expect(sandbox.status).toBe('running');

    // 2. Mount S3 filesystem
    const s3Config = getS3TestConfig();
    const mockFilesystem = {
      id: 'test-s3-workflow',
      name: 'S3Filesystem',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => s3Config,
    } as any;

    const mountPath = '/data/workflow-test';
    const mountResult = await sandbox.mount(mockFilesystem, mountPath);
    expect(mountResult.success).toBe(true);

    // 3. Write file via executeCommand
    const testContent = `test-${Date.now()}`;
    const testFile = `${mountPath}/workflow-test-file.txt`;
    const writeResult = await sandbox.executeCommand('sh', ['-c', `echo "${testContent}" > ${testFile}`]);
    expect(writeResult.exitCode).toBe(0);

    // 4. Read file via executeCommand
    const readResult = await sandbox.executeCommand('cat', [testFile]);
    expect(readResult.exitCode).toBe(0);
    expect(readResult.stdout.trim()).toBe(testContent);

    // 5. Verify file exists (list directory)
    const lsResult = await sandbox.executeCommand('ls', ['-la', mountPath]);
    expect(lsResult.stdout).toContain('workflow-test-file.txt');

    // Cleanup: remove test file
    await sandbox.executeCommand('rm', [testFile]);
  }, 240000);

  it('sandbox reconnect preserves mounts', async () => {
    const sandboxId = `reconnect-mount-${Date.now()}`;

    // 1. Create and start sandbox with mount
    const sandbox1 = new E2BSandbox({ id: sandboxId, timeout: 120000 });
    await sandbox1.start();

    const s3Config = getS3TestConfig();
    const mockFilesystem = {
      id: 'test-s3-reconnect',
      name: 'S3Filesystem',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => s3Config,
    } as any;

    const mountPath = '/data/reconnect-test';
    await sandbox1.mount(mockFilesystem, mountPath);

    // Write a file to verify mount works
    const testFile = `${mountPath}/reconnect-marker.txt`;
    await sandbox1.executeCommand('sh', ['-c', `echo "before-reconnect" > ${testFile}`]);

    // 2. Stop sandbox (but don't destroy - auto-pause keeps it)
    await sandbox1.stop();

    // 3. Create new E2BSandbox instance with same id
    const sandbox2 = new E2BSandbox({ id: sandboxId, timeout: 120000 });
    await sandbox2._start();

    // 4. Verify sandbox reconnected
    expect(sandbox2.status).toBe('running');

    // 5. Mount should still be accessible (or remount)
    // First, check if file is accessible
    const checkMount = await sandbox2.executeCommand('mountpoint', ['-q', mountPath]);
    if (checkMount.exitCode !== 0) {
      // Mount not present, remount it
      await sandbox2.mount(mockFilesystem, mountPath);
    }

    // Verify file still exists
    const readResult = await sandbox2.executeCommand('cat', [testFile]);
    expect(readResult.stdout.trim()).toBe('before-reconnect');

    // Cleanup
    await sandbox2.executeCommand('rm', [testFile]);
    await sandbox2._destroy();
  }, 300000);

  it('config change triggers remount on reconnect', async () => {
    const sandboxId = `config-change-${Date.now()}`;

    // 1. Start sandbox with S3 mount (readOnly: false)
    const sandbox1 = new E2BSandbox({ id: sandboxId, timeout: 120000 });
    await sandbox1.start();

    const s3Config = getS3TestConfig();
    const createFilesystem = (readOnly: boolean) =>
      ({
        id: 'test-s3-config-change',
        name: 'S3Filesystem',
        provider: 's3',
        status: 'ready',
        getMountConfig: () => ({
          ...s3Config,
          readOnly,
        }),
      }) as any;

    const mountPath = '/data/config-change-test';
    await sandbox1.mount(createFilesystem(false), mountPath);

    // Verify we can write
    const writeResult1 = await sandbox1.executeCommand('sh', ['-c', `echo "test" > ${mountPath}/write-test.txt`]);
    expect(writeResult1.exitCode).toBe(0);

    // Cleanup test file
    await sandbox1.executeCommand('rm', [`${mountPath}/write-test.txt`]);

    // 2. Stop sandbox
    await sandbox1.stop();

    // 3. Reconnect with readOnly: true
    const sandbox2 = new E2BSandbox({ id: sandboxId, timeout: 120000 });
    await sandbox2._start();

    // 4. Mount with readOnly: true - should trigger remount
    await sandbox2.mount(createFilesystem(true), mountPath);

    // 5. Verify writes now fail (read-only)
    const writeResult2 = await sandbox2.executeCommand('sh', [
      '-c',
      `echo "test" > ${mountPath}/readonly-test.txt 2>&1 || echo "write failed"`,
    ]);
    expect(writeResult2.stdout).toMatch(/Read-only|write failed/);

    await sandbox2._destroy();
  }, 300000);
});

/**
 * Stop/destroy behavior integration tests.
 */
describe.skipIf(!process.env.E2B_API_KEY || !hasS3Credentials)('E2BSandbox Stop/Destroy', () => {
  it('stop unmounts all filesystems', async () => {
    const sandbox = new E2BSandbox({
      id: `test-stop-unmount-${Date.now()}`,
      timeout: 120000,
    });
    await sandbox._start();

    // Mount multiple filesystems
    const s3Config = getS3TestConfig();
    const createFilesystem = (id: string) =>
      ({
        id,
        name: 'S3Filesystem',
        provider: 's3',
        status: 'ready',
        getMountConfig: () => s3Config,
      }) as any;

    await sandbox.mount(createFilesystem('fs1'), '/data/mount1');
    await sandbox.mount(createFilesystem('fs2'), '/data/mount2');

    // Verify mounts exist
    const mountsBefore = await sandbox.executeCommand('mount');
    expect(mountsBefore.stdout).toContain('/data/mount1');
    expect(mountsBefore.stdout).toContain('/data/mount2');

    // Stop should unmount all
    await sandbox.stop();

    // Reconnect to verify mounts are gone
    const sandbox2 = new E2BSandbox({ id: sandbox.id, timeout: 60000 });
    await sandbox2._start();

    const mountsAfter = await sandbox2.executeCommand('mount');
    // FUSE mounts should be gone (fusermount -u was called)
    // Note: The mount points may still exist as directories, but not as mounts
    const hasFuseMount1 = mountsAfter.stdout.includes('/data/mount1') && mountsAfter.stdout.includes('fuse');
    const hasFuseMount2 = mountsAfter.stdout.includes('/data/mount2') && mountsAfter.stdout.includes('fuse');

    expect(hasFuseMount1).toBe(false);
    expect(hasFuseMount2).toBe(false);

    await sandbox2._destroy();
  }, 300000);
});

/**
 * Environment variable handling integration tests.
 */
describe.skipIf(!process.env.E2B_API_KEY)('E2BSandbox Environment Variables', () => {
  let sandbox: E2BSandbox;

  afterEach(async () => {
    if (sandbox) {
      try {
        await sandbox._destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('env changes reflected without sandbox restart', async () => {
    // Create sandbox with initial env
    sandbox = new E2BSandbox({
      id: `test-env-${Date.now()}`,
      timeout: 60000,
      env: { MY_VAR: 'initial' },
    });
    await sandbox._start();

    // Check initial value
    const result1 = await sandbox.executeCommand('sh', ['-c', 'echo $MY_VAR']);
    expect(result1.stdout.trim()).toBe('initial');

    // Execute with different env value (should override)
    const result2 = await sandbox.executeCommand('sh', ['-c', 'echo $MY_VAR'], {
      env: { MY_VAR: 'changed' },
    });
    expect(result2.stdout.trim()).toBe('changed');

    // Original sandbox env should still work for new commands
    const result3 = await sandbox.executeCommand('sh', ['-c', 'echo $MY_VAR']);
    expect(result3.stdout.trim()).toBe('initial');
  }, 120000);

  it('env vars merged and passed per-command', async () => {
    sandbox = new E2BSandbox({
      id: `test-env-merge-${Date.now()}`,
      timeout: 60000,
      env: { VAR_A: '1', VAR_B: '2' },
    });
    await sandbox._start();

    // Command with additional env var - should merge
    const result = await sandbox.executeCommand('sh', ['-c', 'echo $VAR_A $VAR_B $VAR_C'], {
      env: { VAR_B: 'override', VAR_C: '3' },
    });

    // VAR_A from sandbox, VAR_B overridden, VAR_C from command
    expect(result.stdout.trim()).toBe('1 override 3');
  }, 120000);
});

/**
 * Shared Sandbox Conformance Tests
 *
 * These tests verify E2BSandbox conforms to the WorkspaceSandbox interface.
 * They use the shared test suite from @internal/workspace-test-utils.
 */
if (process.env.E2B_API_KEY) {
  createSandboxTestSuite({
    suiteName: 'E2BSandbox Conformance',
    createSandbox: options => {
      return new E2BSandbox({
        id: `conformance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timeout: 120000,
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
    testTimeout: 60000, // E2B commands can take time
  });
}

/**
 * Shared Workspace Integration Tests (E2B + S3)
 *
 * These tests verify end-to-end filesystem<->sandbox sync using a real S3Filesystem
 * mounted via s3fs FUSE inside an E2B sandbox.
 */
const canRunSharedIntegration = !!(process.env.E2B_API_KEY && hasS3Credentials);

if (canRunSharedIntegration) {
  const mountPoint = '/data/s3-shared';

  createWorkspaceIntegrationTests({
    suiteName: 'E2B + S3 Shared Integration',
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
        sandbox: new E2BSandbox({
          id: `shared-int-${Date.now()}`,
          timeout: 180000,
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
    suiteName: 'E2B + S3/GCS Multi-Mount Integration',
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
        sandbox: new E2BSandbox({
          id: `multi-s3gcs-${Date.now()}`,
          timeout: 240000,
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
    suiteName: 'E2B + S3+S3 Multi-Mount Integration',
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
        sandbox: new E2BSandbox({
          id: `multi-s3s3-${Date.now()}`,
          timeout: 240000,
        }),
      });
    },
    cleanupWorkspace: cleanupCompositeMounts,
  });
}

/**
 * Read-Only Mount Shared Integration Tests (E2B + S3 readOnly)
 *
 * Tests read-only mount enforcement end-to-end using an S3 filesystem
 * mounted with readOnly: true inside an E2B sandbox.
 */
if (canRunSharedIntegration) {
  const roMountPath = '/data/s3-readonly-shared';

  createWorkspaceIntegrationTests({
    suiteName: 'E2B + S3 Read-Only Mount Integration',
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
        sandbox: new E2BSandbox({
          id: `ro-int-${Date.now()}`,
          timeout: 180000,
        }),
      });
    },
  });
}

/**
 * E2B + CompositeFilesystem(S3+GCS) Integration Tests
 *
 * Tests composite-specific scenarios (mount routing, cross-mount API, virtual
 * directories, mount isolation) with an E2B sandbox containing S3 + GCS mounts.
 */
if (canRunSharedIntegration && hasGCSCredentials) {
  createWorkspaceIntegrationTests({
    suiteName: 'E2B + CompositeFilesystem(S3+GCS)',
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
        sandbox: new E2BSandbox({
          id: `cfs-${Date.now()}`,
          timeout: 240000,
        }),
      });
    },
    cleanupWorkspace: cleanupCompositeMounts,
  });
}

/**
 * Stale FUSE Mount Recovery Tests (E2B-specific)
 *
 * Tests FUSE mount failure detection and recovery scenarios
 * that are specific to E2B's s3fs mount implementation.
 */
describe.skipIf(!canRunSharedIntegration)('E2BSandbox Stale Mount Recovery', () => {
  let sandbox: E2BSandbox;

  beforeEach(() => {
    sandbox = new E2BSandbox({
      id: `test-stale-${Date.now()}`,
      timeout: 180000,
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

  it('detects when FUSE mount has died', async () => {
    await sandbox._start();

    const s3Config = getS3TestConfig();
    const mockFilesystem = {
      id: 'test-s3-stale-detect',
      name: 'S3Filesystem',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => s3Config,
    } as any;

    const mountPath = '/data/stale-detect';
    const mountResult = await sandbox.mount(mockFilesystem, mountPath);
    expect(mountResult.success).toBe(true);

    // Verify mount is active
    const checkBefore = await sandbox.executeCommand('mountpoint', ['-q', mountPath]);
    expect(checkBefore.exitCode).toBe(0);

    // Kill the FUSE mount
    await sandbox.executeCommand('sudo', ['fusermount', '-u', mountPath]);

    // mountpoint should now fail
    const checkAfter = await sandbox.executeCommand('mountpoint', ['-q', mountPath]);
    expect(checkAfter.exitCode).not.toBe(0);

    // cat should fail on a file in the dead mount
    const catResult = await sandbox.executeCommand('cat', [`${mountPath}/nonexistent.txt`]);
    expect(catResult.exitCode).not.toBe(0);
  }, 240000);

  it('remount recovers after FUSE mount killed', async () => {
    await sandbox._start();

    const s3Config = getS3TestConfig();
    const mockFilesystem = {
      id: 'test-s3-stale-remount',
      name: 'S3Filesystem',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => s3Config,
    } as any;

    const mountPath = '/data/stale-remount';
    await sandbox.mount(mockFilesystem, mountPath);

    // Write a file (goes to S3 via FUSE)
    const testFile = `${mountPath}/recovery-test.txt`;
    const content = `recovery-${Date.now()}`;
    await sandbox.executeCommand('sh', ['-c', `echo -n "${content}" > ${testFile}`]);

    // Kill the FUSE mount
    await sandbox.executeCommand('sudo', ['fusermount', '-u', mountPath]);

    // Re-mount — should succeed since data lives in S3
    const remountResult = await sandbox.mount(mockFilesystem, mountPath);
    expect(remountResult.success).toBe(true);

    // File should still be readable (data was persisted in S3)
    const readResult = await sandbox.executeCommand('cat', [testFile]);
    expect(readResult.exitCode).toBe(0);
    expect(readResult.stdout.trim()).toBe(content);

    // Cleanup
    await sandbox.executeCommand('rm', [testFile]);
  }, 300000);

  it('reconnect after stale mount re-mounts successfully', async () => {
    await sandbox._start();
    const sandboxId = sandbox.id;

    const s3Config = getS3TestConfig();
    const mockFilesystem = {
      id: 'test-s3-reconnect-stale',
      name: 'S3Filesystem',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => s3Config,
    } as any;

    const mountPath = '/data/reconnect-stale';
    await sandbox.mount(mockFilesystem, mountPath);

    // Write a file so we can verify after reconnect
    const testFile = `${mountPath}/reconnect-stale-test.txt`;
    const content = `reconnect-${Date.now()}`;
    await sandbox.executeCommand('sh', ['-c', `echo -n "${content}" > ${testFile}`]);

    // Kill FUSE mount
    await sandbox.executeCommand('sudo', ['fusermount', '-u', mountPath]);

    // Stop sandbox (don't destroy — keep it alive for reconnect)
    await sandbox.stop();

    // Create a new sandbox instance with the same ID and reconnect
    const sandbox2 = new E2BSandbox({ id: sandboxId, timeout: 180000 });
    await sandbox2._start();

    // Re-mount at the same path
    const remountResult = await sandbox2.mount(mockFilesystem, mountPath);
    expect(remountResult.success).toBe(true);

    // Verify the file is accessible (data persisted in S3)
    const readResult = await sandbox2.executeCommand('cat', [testFile]);
    expect(readResult.exitCode).toBe(0);
    expect(readResult.stdout.trim()).toBe(content);

    // Cleanup
    await sandbox2.executeCommand('rm', [testFile]);
    await sandbox2._destroy();

    // Prevent afterEach from double-destroying
    sandbox = undefined as any;
  }, 300000);
});
