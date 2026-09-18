import type { FilesystemMountConfig, WorkspaceFilesystem } from '@mastra/core/workspace';
import { afterAll, describe, expect, it } from 'vitest';

import { CreateOSSandbox } from './index';

const hasCredentials = Boolean(process.env.CREATEOS_SANDBOX_API_KEY?.trim());
const hasS3Credentials = Boolean(
  process.env.CREATEOS_TEST_S3_BUCKET?.trim() &&
  process.env.CREATEOS_TEST_S3_ACCESS_KEY_ID?.trim() &&
  process.env.CREATEOS_TEST_S3_SECRET_ACCESS_KEY?.trim(),
);
const sandbox = new CreateOSSandbox({
  id: `mastra-createos-integration-${Date.now()}`,
  autoPauseAfterSeconds: 300,
});

describe.skipIf(!hasCredentials)('CreateOSSandbox integration', () => {
  afterAll(async () => {
    if (sandbox.status !== 'destroyed') {
      await sandbox._destroy();
    }
  });

  it('executes commands, uploads files, and reconnects after a pause', async () => {
    await expect(sandbox._start()).resolves.toEqual({ outcome: 'created' });

    await sandbox.writeFiles([{ path: '/tmp/mastra-createos.txt', content: 'createos-ready\n' }]);
    await expect(sandbox.executeCommand('cat', ['/tmp/mastra-createos.txt'])).resolves.toMatchObject({
      success: true,
      stdout: 'createos-ready\n',
    });

    await sandbox._stop();
    await expect(sandbox._start()).resolves.toEqual({ outcome: 'connected' });
  });

  it.skipIf(!hasS3Credentials)('live-mounts and unmounts an S3-compatible filesystem', async () => {
    if (!(await sandbox.isReady())) await sandbox._start();
    const config: FilesystemMountConfig = {
      type: 's3',
      bucket: process.env.CREATEOS_TEST_S3_BUCKET!,
      region: process.env.CREATEOS_TEST_S3_REGION ?? 'us-east-1',
      endpoint: process.env.CREATEOS_TEST_S3_ENDPOINT,
      accessKeyId: process.env.CREATEOS_TEST_S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CREATEOS_TEST_S3_SECRET_ACCESS_KEY!,
      prefix: process.env.CREATEOS_TEST_S3_PREFIX,
    } as FilesystemMountConfig;
    const filesystem = {
      id: 'createos-live-s3',
      name: 'CreateOS live S3 filesystem',
      provider: 's3',
      status: 'running',
      getMountConfig: () => config,
    } as unknown as WorkspaceFilesystem;
    const mountPath = '/mnt/mastra-createos-test';

    await expect(sandbox.mount(filesystem, mountPath)).resolves.toEqual({ success: true, mountPath });
    await expect(sandbox.executeCommand('ls', [mountPath])).resolves.toMatchObject({ success: true });
    await expect(sandbox.unmount(mountPath)).resolves.toBeUndefined();
  });
});
