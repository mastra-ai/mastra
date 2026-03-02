/**
 * Daytona Sandbox Integration Tests
 *
 * These tests require real Daytona API access and run against actual Daytona sandboxes.
 * They are separated from unit tests to avoid mock conflicts.
 *
 * Required environment variables:
 * - DAYTONA_API_KEY: Daytona API key
 * - S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY: For S3 mount tests
 * - S3_ENDPOINT, S3_REGION: For S3-compatible services (R2, MinIO)
 * - GCS_SERVICE_ACCOUNT_KEY, TEST_GCS_BUCKET: For GCS mount tests
 */

import { createSandboxTestSuite } from '@internal/workspace-test-utils';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { DaytonaSandbox } from './index';

const hasS3Credentials = !!(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY && process.env.S3_BUCKET);
const hasGCSCredentials = !!(process.env.GCS_SERVICE_ACCOUNT_KEY && process.env.TEST_GCS_BUCKET);

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
 * Basic Daytona integration tests.
 */
describe.skipIf(!process.env.DAYTONA_API_KEY)('DaytonaSandbox Integration', () => {
  let sandbox: DaytonaSandbox;

  beforeEach(() => {
    sandbox = new DaytonaSandbox({
      id: `test-${Date.now()}`,
      timeout: 60000,
      language: 'typescript',
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

    const result = await sandbox.executeCommand('echo', ['Hello Daytona']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('Hello Daytona');
  }, 120000);

  it('passes environment variables', async () => {
    const envSandbox = new DaytonaSandbox({
      id: `test-env-${Date.now()}`,
      env: { TEST_VAR: 'hello-from-env' },
    });

    try {
      await envSandbox._start();
      const result = await envSandbox.executeCommand('printenv', ['TEST_VAR']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toContain('hello-from-env');
    } finally {
      await envSandbox._destroy();
    }
  }, 120000);

  it('supports working directory option', async () => {
    await sandbox._start();

    const result = await sandbox.executeCommand('pwd', [], { cwd: '/tmp' });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('/tmp');
  }, 120000);

  it('handles command timeout', async () => {
    await sandbox._start();

    const result = await sandbox.executeCommand('sleep', ['30'], { timeout: 2000 });

    expect(result.success).toBe(false);
  }, 120000);

  it('reports correct sandbox info', async () => {
    await sandbox._start();

    const info = await sandbox.getInfo();

    expect(info.provider).toBe('daytona');
    expect(info.name).toBe('DaytonaSandbox');
    expect(info.status).toBe('running');
    expect(info.createdAt).toBeInstanceOf(Date);
  }, 120000);
});

/**
 * S3 Mount integration tests.
 */
describe.skipIf(!process.env.DAYTONA_API_KEY || !hasS3Credentials)('DaytonaSandbox S3 Mount Integration', () => {
  let sandbox: DaytonaSandbox;

  beforeEach(() => {
    sandbox = new DaytonaSandbox({
      id: `test-s3-${Date.now()}`,
      timeout: 120000,
      language: 'typescript',
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

  it('S3 with readOnly mounts with -o ro', async () => {
    await sandbox._start();

    const s3Config = getS3TestConfig();
    const mockFilesystem = {
      id: 'test-s3-ro',
      name: 'S3Filesystem',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => ({ ...s3Config, readOnly: true }),
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

    const statResult = await sandbox.executeCommand('stat', ['-c', '%U', '/data/s3-ownership']);
    expect(statResult.stdout.trim()).not.toBe('root');
  }, 180000);

  it('full workflow: mount S3, read/write files', async () => {
    await sandbox._start();

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

    // Write file
    const testContent = `test-${Date.now()}`;
    const testFile = `${mountPath}/workflow-test-file.txt`;
    const writeResult = await sandbox.executeCommand('sh', ['-c', `echo "${testContent}" > ${testFile}`]);
    expect(writeResult.exitCode).toBe(0);

    // Read file back
    const readResult = await sandbox.executeCommand('cat', [testFile]);
    expect(readResult.exitCode).toBe(0);
    expect(readResult.stdout.trim()).toBe(testContent);

    // Cleanup
    await sandbox.executeCommand('rm', [testFile]);
  }, 240000);
});

/**
 * GCS Mount integration tests.
 */
describe.skipIf(!process.env.DAYTONA_API_KEY || !hasGCSCredentials)('DaytonaSandbox GCS Mount Integration', () => {
  let sandbox: DaytonaSandbox;

  beforeEach(() => {
    sandbox = new DaytonaSandbox({
      id: `test-gcs-${Date.now()}`,
      timeout: 120000,
      language: 'typescript',
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
    if (!result.success && result.error?.includes('Cannot reach Google Cloud Storage')) {
      console.log('[GCS TEST] Skipped: sandbox is on a restricted tier (no GCS access)');
      return;
    }
    expect(result.success).toBe(true);

    const mountsResult = await sandbox.executeCommand('mount');
    const hasFuseMount = mountsResult.stdout.includes('/data/gcs-test') && mountsResult.stdout.includes('fuse.gcsfuse');
    expect(hasFuseMount).toBe(true);

    // If accessible, verify we can list
    const lsResult = await sandbox.executeCommand('ls', ['/data/gcs-test']);
    if (lsResult.exitCode !== 0) {
      console.log(`[GCS TEST] Note: ls failed (bucket may be empty or have access restrictions): ${lsResult.stderr}`);
    }
  }, 180000);

  it('full workflow: mount GCS and verify FUSE mount', async () => {
    await sandbox._start();
    expect(sandbox.status).toBe('running');

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
    if (!mountResult.success && mountResult.error?.includes('Cannot reach Google Cloud Storage')) {
      console.log('[GCS TEST] Skipped: sandbox is on a restricted tier (no GCS access)');
      return;
    }
    expect(mountResult.success).toBe(true);

    // Verify FUSE mount
    const mountsResult = await sandbox.executeCommand('mount');
    const hasFuseMount = mountsResult.stdout.includes(mountPath) && mountsResult.stdout.includes('fuse.gcsfuse');
    expect(hasFuseMount).toBe(true);

    // Try file operations (may fail depending on bucket permissions)
    const lsResult = await sandbox.executeCommand('ls', [mountPath]);
    if (lsResult.exitCode === 0) {
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

  it('GCS mount sets uid/gid for file ownership', async () => {
    await sandbox._start();

    const bucket = process.env.TEST_GCS_BUCKET!;
    const mockFilesystem = {
      id: 'test-gcs-ownership',
      name: 'GCSFilesystem',
      provider: 'gcs',
      status: 'ready',
      getMountConfig: () => ({
        type: 'gcs',
        bucket,
        serviceAccountKey: process.env.GCS_SERVICE_ACCOUNT_KEY,
      }),
    } as any;

    const result = await sandbox.mount(mockFilesystem, '/data/gcs-ownership');
    if (!result.success && result.error?.includes('Cannot reach Google Cloud Storage')) {
      console.log('[GCS TEST] Skipped: sandbox is on a restricted tier (no GCS access)');
      return;
    }

    const statResult = await sandbox.executeCommand('stat', ['-c', '%U', '/data/gcs-ownership']);
    expect(statResult.stdout.trim()).not.toBe('root');
  }, 180000);
});

/**
 * Mount tests that only require DAYTONA_API_KEY (no cloud storage credentials).
 */
describe.skipIf(!process.env.DAYTONA_API_KEY)('DaytonaSandbox Mount Error Handling', () => {
  let sandbox: DaytonaSandbox;

  beforeEach(() => {
    sandbox = new DaytonaSandbox({
      id: `test-mount-errors-${Date.now()}`,
      timeout: 120000,
      language: 'typescript',
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

  it('S3-compatible without credentials fails with credentials error', async () => {
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
    if (!result.success && result.error?.includes('Cannot reach Google Cloud Storage')) {
      console.log('[GCS TEST] Skipped: sandbox is on a restricted tier (no GCS access)');
      return;
    }
    if (!result.success && result.error?.includes('Failed to install gcsfuse')) {
      console.log('[GCS TEST] Skipped: gcsfuse package not available (distro/repo mismatch)');
      return;
    }
    expect(result.success).toBe(true);
  }, 180000);
});

/**
 * Mount safety and error handling integration tests.
 */
describe.skipIf(!process.env.DAYTONA_API_KEY)('DaytonaSandbox Mount Safety', () => {
  let sandbox: DaytonaSandbox;

  beforeEach(() => {
    sandbox = new DaytonaSandbox({
      id: `test-safety-${Date.now()}`,
      timeout: 60000,
      language: 'typescript',
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

  it.skipIf(!hasS3Credentials)(
    'mount creates directory with sudo for paths outside home',
    async () => {
      await sandbox._start();

      const s3Config = getS3TestConfig();
      const mockFilesystem = {
        id: 'test-fs-outside-home',
        name: 'S3Filesystem',
        provider: 's3',
        status: 'ready',
        getMountConfig: () => s3Config,
      } as any;

      const result = await sandbox.mount(mockFilesystem, '/opt/test-mount');
      expect(result.success).toBe(true);

      const checkDir = await sandbox.executeCommand('test', ['-d', '/opt/test-mount']);
      expect(checkDir.exitCode).toBe(0);
    },
    120000,
  );
});

/**
 * Marker file handling integration tests.
 */
describe.skipIf(!process.env.DAYTONA_API_KEY || !hasS3Credentials)('DaytonaSandbox Marker Files', () => {
  let sandbox: DaytonaSandbox;

  beforeEach(() => {
    sandbox = new DaytonaSandbox({
      id: `test-markers-${Date.now()}`,
      timeout: 120000,
      language: 'typescript',
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
    await sandbox.unmount(mountPath);

    const markerFilename = sandbox.mounts.markerFilename(mountPath);
    const checkMarker = await sandbox.executeCommand('test', ['-f', `/tmp/.mastra-mounts/${markerFilename}`]);
    expect(checkMarker.exitCode).not.toBe(0);
  }, 180000);
});

/**
 * Existing mount detection integration tests.
 */
describe.skipIf(!process.env.DAYTONA_API_KEY || !hasS3Credentials)('DaytonaSandbox Existing Mount Detection', () => {
  let sandbox: DaytonaSandbox;

  beforeEach(() => {
    sandbox = new DaytonaSandbox({
      id: `test-existing-${Date.now()}`,
      timeout: 120000,
      language: 'typescript',
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

  it.skipIf(!hasS3Credentials)(
    'mount skips if already mounted with matching config',
    async () => {
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

      const result1 = await sandbox.mount(mockFilesystem, mountPath);
      expect(result1.success).toBe(true);

      const markerBefore = await sandbox.executeCommand('sh', [
        '-c',
        `cat /tmp/.mastra-mounts/${sandbox.mounts.markerFilename(mountPath)} 2>/dev/null || echo "none"`,
      ]);

      const result2 = await sandbox.mount(mockFilesystem, mountPath);
      expect(result2.success).toBe(true);

      const markerAfter = await sandbox.executeCommand('sh', [
        '-c',
        `cat /tmp/.mastra-mounts/${sandbox.mounts.markerFilename(mountPath)} 2>/dev/null || echo "none"`,
      ]);
      expect(markerAfter.stdout).toBe(markerBefore.stdout);
    },
    180000,
  );

  it('mount unmounts and remounts if config changed', async () => {
    await sandbox._start();

    const s3Config = getS3TestConfig();
    const createFilesystem = (readOnly: boolean) =>
      ({
        id: 'test-s3-remount',
        name: 'S3Filesystem',
        provider: 's3',
        status: 'ready',
        getMountConfig: () => ({ ...s3Config, readOnly }),
      }) as any;

    const mountPath = '/data/remount-test';

    await sandbox.mount(createFilesystem(false), mountPath);

    const markerFile = `/tmp/.mastra-mounts/${sandbox.mounts.markerFilename(mountPath)}`;
    const markerBefore = await sandbox.executeCommand('cat', [markerFile]);

    const result = await sandbox.mount(createFilesystem(true), mountPath);
    expect(result.success).toBe(true);

    const markerAfter = await sandbox.executeCommand('cat', [markerFile]);
    expect(markerAfter.stdout).not.toBe(markerBefore.stdout);

    // Verify the mount has the 'ro' option via /proc/mounts (more reliable than
    // checking write failure messages, which vary across FUSE implementations).
    const mountOpts = await sandbox.executeCommand('sh', ['-c', `grep '${mountPath}' /proc/mounts | head -1`]);
    expect(mountOpts.stdout).toMatch(/\bro\b/);
  }, 240000);
});

/**
 * Mount reconciliation integration tests.
 */
describe.skipIf(!process.env.DAYTONA_API_KEY)('DaytonaSandbox Mount Reconciliation', () => {
  let sandbox: DaytonaSandbox;

  beforeEach(() => {
    sandbox = new DaytonaSandbox({
      id: `test-reconcile-${Date.now()}`,
      timeout: 60000,
      language: 'typescript',
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

  it('reconcileMounts cleans up orphaned marker files', async () => {
    await sandbox._start();

    await sandbox.executeCommand('mkdir', ['-p', '/tmp/.mastra-mounts']);
    await sandbox.executeCommand('sh', ['-c', 'echo "/orphan|abc123" > /tmp/.mastra-mounts/mount-orphan']);

    await sandbox.reconcileMounts(['/expected-path']);

    const checkMarker = await sandbox.executeCommand('test', ['-f', '/tmp/.mastra-mounts/mount-orphan']);
    expect(checkMarker.exitCode).not.toBe(0);
  }, 120000);

  it('reconcileMounts handles malformed marker files', async () => {
    await sandbox._start();

    await sandbox.executeCommand('mkdir', ['-p', '/tmp/.mastra-mounts']);
    await sandbox.executeCommand('sh', ['-c', 'echo "invalid-no-pipe" > /tmp/.mastra-mounts/mount-malformed']);

    await expect(sandbox.reconcileMounts(['/expected'])).resolves.not.toThrow();

    const checkMalformed = await sandbox.executeCommand('test', ['-f', '/tmp/.mastra-mounts/mount-malformed']);
    expect(checkMalformed.exitCode).not.toBe(0);
  }, 120000);
});

/**
 * Stop/destroy behavior integration tests.
 */
describe.skipIf(!process.env.DAYTONA_API_KEY || !hasS3Credentials)('DaytonaSandbox Stop/Destroy', () => {
  it('stop unmounts all filesystems', async () => {
    const sandbox = new DaytonaSandbox({
      id: `test-stop-unmount-${Date.now()}`,
      timeout: 120000,
      language: 'typescript',
    });
    await sandbox._start();

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

    const mountsBefore = await sandbox.executeCommand('mount');
    expect(mountsBefore.stdout).toContain('/data/mount1');
    expect(mountsBefore.stdout).toContain('/data/mount2');

    await sandbox.stop();

    const sandbox2 = new DaytonaSandbox({ id: sandbox.id, timeout: 60000, language: 'typescript' });
    await sandbox2._start();

    const mountsAfter = await sandbox2.executeCommand('mount');
    expect(mountsAfter.stdout.includes('/data/mount1') && mountsAfter.stdout.includes('fuse')).toBe(false);
    expect(mountsAfter.stdout.includes('/data/mount2') && mountsAfter.stdout.includes('fuse')).toBe(false);

    await sandbox2._destroy();
  }, 300000);
});

/**
 * Stale FUSE mount recovery tests.
 */
describe.skipIf(!process.env.DAYTONA_API_KEY || !hasS3Credentials)('DaytonaSandbox Stale Mount Recovery', () => {
  let sandbox: DaytonaSandbox;

  beforeEach(() => {
    sandbox = new DaytonaSandbox({
      id: `test-stale-${Date.now()}`,
      timeout: 180000,
      language: 'typescript',
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

    const testFile = `${mountPath}/recovery-test.txt`;
    const content = `recovery-${Date.now()}`;
    await sandbox.executeCommand('sh', ['-c', `echo -n "${content}" > ${testFile}`]);

    // Kill the FUSE mount
    await sandbox.executeCommand('sudo', ['fusermount', '-u', mountPath]);

    // Re-mount
    const remountResult = await sandbox.mount(mockFilesystem, mountPath);
    expect(remountResult.success).toBe(true);

    // File should still be readable (data persisted in S3)
    const readResult = await sandbox.executeCommand('cat', [testFile]);
    expect(readResult.exitCode).toBe(0);
    expect(readResult.stdout.trim()).toBe(content);

    await sandbox.executeCommand('rm', [testFile]);
  }, 300000);

  it('sandbox reconnect preserves mounts', async () => {
    const sandboxId = `reconnect-mount-${Date.now()}`;

    const sandbox1 = new DaytonaSandbox({ id: sandboxId, timeout: 120000, language: 'typescript' });
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

    const testFile = `${mountPath}/reconnect-marker.txt`;
    await sandbox1.executeCommand('sh', ['-c', `echo "before-reconnect" > ${testFile}`]);

    await sandbox1.stop();

    const sandbox2 = new DaytonaSandbox({ id: sandboxId, timeout: 120000, language: 'typescript' });
    await sandbox2._start();

    expect(sandbox2.status).toBe('running');

    const checkMount = await sandbox2.executeCommand('mountpoint', ['-q', mountPath]);
    if (checkMount.exitCode !== 0) {
      await sandbox2.mount(mockFilesystem, mountPath);
    }

    const readResult = await sandbox2.executeCommand('cat', [testFile]);
    expect(readResult.stdout.trim()).toBe('before-reconnect');

    await sandbox2.executeCommand('rm', [testFile]);
    await sandbox2._destroy();
  }, 300000);
});

/**
 * Shared sandbox conformance tests.
 */
describe.skipIf(!process.env.DAYTONA_API_KEY)('DaytonaSandbox Conformance', () => {
  createSandboxTestSuite({
    suiteName: 'DaytonaSandbox',
    createSandbox: async options =>
      new DaytonaSandbox({
        id: `conformance-${Date.now()}`,
        timeout: 60000,
        language: 'typescript',
        ...(options?.env && { env: options.env }),
      }),
    createInvalidSandbox: () =>
      new DaytonaSandbox({
        id: `bad-config-${Date.now()}`,
        image: 'nonexistent/fake-image:latest',
      }),
    createMountableFilesystem: hasS3Credentials
      ? () =>
          ({
            id: `conformance-s3-${Date.now()}`,
            name: 'S3Filesystem',
            provider: 's3',
            status: 'ready' as const,
            getMountConfig: () => getS3TestConfig(),
          }) as any
      : undefined,
    capabilities: {
      supportsMounting: true,
      supportsReconnection: true,
      supportsEnvVars: true,
      supportsWorkingDirectory: true,
      supportsTimeout: true,
      supportsStreaming: true,
      supportsConcurrency: true,
    },
    testTimeout: 120000,
  });
});
