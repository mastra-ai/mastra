import type { FilesystemMountConfig } from '@mastra/core/workspace';

import { LOG_PREFIX } from './types';
import type { MountContext } from './types';

/**
 * GCS mount config for E2B (mounted via gcsfuse).
 *
 * If credentials are not provided, the bucket will be mounted as read-only
 * using anonymous access (for public buckets only).
 */
export interface E2BGCSMountConfig extends FilesystemMountConfig {
  type: 'gcs';
  /** GCS bucket name */
  bucket: string;
  /** Service account key JSON (optional - omit for public buckets) */
  serviceAccountKey?: string;
}

/**
 * Mount a GCS bucket using gcsfuse.
 */
export async function mountGCS(mountPath: string, config: E2BGCSMountConfig, ctx: MountContext): Promise<void> {
  const { sandbox, logger } = ctx;

  // Install gcsfuse if not present
  const checkResult = await sandbox.commands.run('which gcsfuse || echo "not found"');
  if (checkResult.stdout.includes('not found')) {
    await sandbox.commands.run(
      'echo "deb https://packages.cloud.google.com/apt gcsfuse-jammy main" | sudo tee /etc/apt/sources.list.d/gcsfuse.list && ' +
        'curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key add - && ' +
        'sudo apt-get update && sudo apt-get install -y gcsfuse',
    );
  }

  // Get user's uid/gid for proper file ownership
  const idResult = await sandbox.commands.run('id -u && id -g');
  const [uid, gid] = idResult.stdout.trim().split('\n');

  // Build gcsfuse flags
  // Note: gcsfuse uses --uid/--gid flags, not -o uid=X style
  const uidGidFlags = uid && gid ? `--uid=${uid} --gid=${gid}` : '';

  const hasCredentials = !!config.serviceAccountKey;
  let mountCmd: string;

  if (hasCredentials) {
    // Write service account key with root ownership so sudo gcsfuse can read it
    const keyPath = '/tmp/gcs-key.json';
    await sandbox.commands.run(`sudo rm -f ${keyPath}`);
    await sandbox.files.write(keyPath, config.serviceAccountKey!);
    // Make readable by root (sudo gcsfuse runs as root)
    await sandbox.commands.run(`sudo chown root:root ${keyPath} && sudo chmod 600 ${keyPath}`);

    // Mount with credentials using --key-file flag
    // Use sudo for /dev/fuse access (same as s3fs)
    mountCmd = `sudo gcsfuse --key-file=${keyPath} ${uidGidFlags} ${config.bucket} ${mountPath}`;
  } else {
    // Public bucket mode - read-only access without credentials
    // Use --anonymous-access flag (not -o option)
    // Use sudo for /dev/fuse access (same as s3fs)
    logger.debug(`${LOG_PREFIX} No credentials provided, mounting GCS as public bucket (read-only)`);

    mountCmd = `sudo gcsfuse --anonymous-access ${uidGidFlags} ${config.bucket} ${mountPath}`;
  }

  logger.debug(`${LOG_PREFIX} Mounting GCS:`, mountCmd);

  const result = await sandbox.commands.run(mountCmd);
  logger.debug(`${LOG_PREFIX} gcsfuse result:`, {
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
  });
  if (result.exitCode !== 0) {
    throw new Error(`Failed to mount GCS bucket: ${result.stderr || result.stdout}`);
  }
}
