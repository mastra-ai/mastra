import crypto from 'node:crypto';

import type { FilesystemMountConfig } from '@mastra/core/workspace';

import { shellQuote } from '../../utils/shell-quote';

import { LOG_PREFIX, validateBucketName, runCommand } from './types';
import type { MountContext } from './types';

/**
 * GCS mount config for Blaxel (mounted via gcsfuse).
 *
 * If credentials are not provided, the bucket will be mounted as read-only
 * using anonymous access (for public buckets only).
 */
export interface BlaxelGCSMountConfig extends FilesystemMountConfig {
  type: 'gcs';
  /** GCS bucket name */
  bucket: string;
  /** Service account key JSON (optional - omit for public buckets) */
  serviceAccountKey?: string;
}

/**
 * Mount a GCS bucket using gcsfuse.
 */
export async function mountGCS(mountPath: string, config: BlaxelGCSMountConfig, ctx: MountContext): Promise<void> {
  const { sandbox, logger } = ctx;

  // Validate inputs before interpolating into shell commands
  validateBucketName(config.bucket);

  const quotedMountPath = shellQuote(mountPath);

  // Install gcsfuse if not present
  const checkResult = await runCommand(sandbox, 'which gcsfuse || echo "not found"');
  if (checkResult.stdout.includes('not found')) {
    logger.warn(`${LOG_PREFIX} gcsfuse not found, attempting runtime installation...`);
    logger.info(`${LOG_PREFIX} Tip: For faster startup, pre-install gcsfuse in your sandbox image`);

    // Detect distro codename for the gcsfuse repo (default to bookworm for Debian)
    const codenameResult = await runCommand(
      sandbox,
      'cat /etc/os-release 2>/dev/null | grep VERSION_CODENAME | cut -d= -f2 || echo bookworm',
    );
    const codename = codenameResult.stdout.trim() || 'bookworm';
    logger.debug(`${LOG_PREFIX} Detected distro codename: ${codename}`);

    // Ensure required tools and keyring directory exist
    const prepResult = await runCommand(
      sandbox,
      'apt-get update && apt-get install -y curl gnupg lsb-release fuse && mkdir -p /etc/apt/keyrings',
      { timeout: 120_000 },
    );
    if (prepResult.exitCode !== 0) {
      throw new Error(
        `Failed to install gcsfuse prerequisites.\n` + `Error details: ${prepResult.stderr || prepResult.stdout}`,
      );
    }

    // Add gcsfuse repo and install
    const installResult = await runCommand(
      sandbox,
      'curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /etc/apt/keyrings/gcsfuse.gpg && ' +
        `echo "deb [signed-by=/etc/apt/keyrings/gcsfuse.gpg] https://packages.cloud.google.com/apt gcsfuse-${codename} main" | tee /etc/apt/sources.list.d/gcsfuse.list && ` +
        'apt-get update && apt-get install -y gcsfuse',
      { timeout: 120_000 },
    );

    if (installResult.exitCode !== 0) {
      throw new Error(
        `Failed to install gcsfuse. ` +
          `For GCS mounting, your sandbox image needs gcsfuse and fuse packages.\n\n` +
          `Pre-install in your image: apt-get install -y gcsfuse fuse\n\n` +
          `Error details: ${installResult.stderr || installResult.stdout}`,
      );
    }

    // Verify installation
    const verifyResult = await runCommand(sandbox, 'which gcsfuse');
    if (verifyResult.exitCode !== 0) {
      throw new Error(
        `gcsfuse installation appeared to succeed but binary not found on PATH.\n` +
          `Install output: ${installResult.stdout}\n${installResult.stderr}`,
      );
    }
  }

  // Get user's uid/gid for proper file ownership
  const idResult = await runCommand(sandbox, 'id -u && id -g');
  if (idResult.exitCode !== 0) {
    throw new Error(`Failed to get uid/gid: ${idResult.stderr || idResult.stdout}`);
  }
  const [uid, gid] = idResult.stdout.trim().split('\n');

  // Build gcsfuse flags
  // Note: gcsfuse uses --uid/--gid flags, not -o uid=X style
  const uidGidFlags = uid && gid ? `--uid=${uid} --gid=${gid}` : '';

  const hasCredentials = !!config.serviceAccountKey;
  let mountCmd: string;

  if (hasCredentials) {
    // Use a mount-specific key path to avoid races with concurrent mounts
    const mountHash = crypto.createHash('md5').update(mountPath).digest('hex').slice(0, 8);
    const keyPath = `/tmp/gcs-key-${mountHash}.json`;
    await runCommand(sandbox, `rm -f ${keyPath}`);
    await sandbox.fs.write(keyPath, config.serviceAccountKey!);

    // Mount with credentials using --key-file flag
    // -o allow_other lets non-root users access the FUSE mount
    mountCmd = `gcsfuse --key-file=${keyPath} -o allow_other ${uidGidFlags} ${config.bucket} ${quotedMountPath}`;
  } else {
    // Public bucket mode - read-only access without credentials
    // Use --anonymous-access flag (not -o option)
    logger.debug(`${LOG_PREFIX} No credentials provided, mounting GCS as public bucket (read-only)`);

    mountCmd = `gcsfuse --anonymous-access -o allow_other ${uidGidFlags} ${config.bucket} ${quotedMountPath}`;
  }

  logger.debug(`${LOG_PREFIX} Mounting GCS:`, mountCmd);

  const result = await runCommand(sandbox, mountCmd, { timeout: 60_000 });
  logger.debug(`${LOG_PREFIX} gcsfuse result:`, {
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
  });
  if (result.exitCode !== 0) {
    throw new Error(`Failed to mount GCS bucket: ${result.stderr || result.stdout}`);
  }
}
