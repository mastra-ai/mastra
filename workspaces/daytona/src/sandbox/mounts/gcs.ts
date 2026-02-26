import crypto from 'node:crypto';

import type { FilesystemMountConfig } from '@mastra/core/workspace';

import { shellQuote } from '../../utils/shell-quote';
import { LOG_PREFIX, validateBucketName, runCommand, writeFile } from './types';
import type { MountContext } from './types';

/**
 * GCS mount config for Daytona (mounted via gcsfuse).
 *
 * If credentials are not provided, the bucket will be mounted as read-only
 * using anonymous access (for public buckets only).
 */
export interface DaytonaGCSMountConfig extends FilesystemMountConfig {
  type: 'gcs';
  /** GCS bucket name */
  bucket: string;
  /** Service account key JSON (optional - omit for public buckets) */
  serviceAccountKey?: string;
}

/**
 * Mount a GCS bucket using gcsfuse.
 */
export async function mountGCS(mountPath: string, config: DaytonaGCSMountConfig, ctx: MountContext): Promise<void> {
  const { sandbox, logger } = ctx;

  // Validate inputs before interpolating into shell commands
  validateBucketName(config.bucket);

  const quotedMountPath = shellQuote(mountPath);

  // Install gcsfuse if not present
  const checkResult = await runCommand(sandbox, 'which gcsfuse || echo "not found"', { timeout: 30_000 });
  if (checkResult.output.includes('not found')) {
    logger.warn(`${LOG_PREFIX} gcsfuse not found, attempting runtime installation...`);
    logger.info(`${LOG_PREFIX} Tip: For faster startup, pre-install gcsfuse in your sandbox image`);

    // Detect distro codename for the gcsfuse repo (default to bookworm for Debian)
    const codenameResult = await runCommand(
      sandbox,
      'cat /etc/os-release 2>/dev/null | grep VERSION_CODENAME | cut -d= -f2 || echo bookworm',
      { timeout: 30_000 },
    );
    const codename = codenameResult.output.trim() || 'bookworm';
    if (!/^[a-z0-9][a-z0-9-]*$/.test(codename)) {
      throw new Error(`Invalid distro codename for gcsfuse repo: "${codename}"`);
    }
    logger.debug(`${LOG_PREFIX} Detected distro codename: ${codename}`);

    // Ensure required tools and keyring directory exist
    const prepResult = await runCommand(
      sandbox,
      'sudo apt-get update && sudo apt-get install -y curl gnupg lsb-release fuse && sudo mkdir -p /etc/apt/keyrings',
      { timeout: 120_000 },
    );
    if (prepResult.exitCode !== 0) {
      throw new Error(`Failed to install gcsfuse prerequisites.\n` + `Error details: ${prepResult.output}`);
    }

    // Add gcsfuse repo and install
    const installResult = await runCommand(
      sandbox,
      'curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo gpg --dearmor -o /etc/apt/keyrings/gcsfuse.gpg && ' +
        `echo "deb [signed-by=/etc/apt/keyrings/gcsfuse.gpg] https://packages.cloud.google.com/apt gcsfuse-${codename} main" | sudo tee /etc/apt/sources.list.d/gcsfuse.list && ` +
        'sudo apt-get update && sudo apt-get install -y gcsfuse',
      { timeout: 120_000 },
    );

    if (installResult.exitCode !== 0) {
      throw new Error(
        `Failed to install gcsfuse. ` +
          `For GCS mounting, your sandbox image needs gcsfuse and fuse packages.\n\n` +
          `Pre-install in your image: apt-get install -y gcsfuse fuse\n\n` +
          `Error details: ${installResult.output}`,
      );
    }

    // Verify installation
    const verifyResult = await runCommand(sandbox, 'which gcsfuse', { timeout: 30_000 });
    if (verifyResult.exitCode !== 0) {
      throw new Error(
        `gcsfuse installation appeared to succeed but binary not found on PATH.\n` +
          `Install output: ${installResult.output}`,
      );
    }
  }

  // Get user's uid/gid for proper file ownership
  const idResult = await runCommand(sandbox, 'id -u && id -g', { timeout: 30_000 });
  if (idResult.exitCode !== 0) {
    throw new Error(`Failed to get uid/gid: ${idResult.output}`);
  }
  const [uid, gid] = idResult.output.trim().split('\n');
  const validUidGid = uid && gid && /^\d+$/.test(uid) && /^\d+$/.test(gid);
  if (!validUidGid) {
    logger.warn(
      `${LOG_PREFIX} Unexpected uid/gid format: "${idResult.output.trim()}" — mounted files will be owned by root`,
    );
  }

  // Build gcsfuse flags
  // Note: gcsfuse uses --uid/--gid flags, not -o uid=X style
  const uidGidFlags = validUidGid ? `--uid=${uid} --gid=${gid}` : '';

  const hasCredentials = !!config.serviceAccountKey;
  let mountCmd: string;

  if (hasCredentials) {
    // Use a mount-specific key path to avoid races with concurrent mounts
    const mountHash = crypto.createHash('md5').update(mountPath).digest('hex').slice(0, 8);
    const keyPath = `/tmp/gcs-key-${mountHash}.json`;
    await runCommand(sandbox, `sudo rm -f ${shellQuote(keyPath)}`, { timeout: 30_000 });
    await writeFile(sandbox, keyPath, config.serviceAccountKey!);
    // Make readable by root (sudo gcsfuse runs as root)
    await runCommand(sandbox, `sudo chown root:root ${shellQuote(keyPath)} && sudo chmod 600 ${shellQuote(keyPath)}`, {
      timeout: 30_000,
    });

    // Mount with credentials using --key-file flag
    // Use sudo for /dev/fuse access
    // -o allow_other lets non-root users access the FUSE mount
    mountCmd = `sudo gcsfuse --key-file=${shellQuote(keyPath)} -o allow_other ${uidGidFlags} ${shellQuote(config.bucket)} ${quotedMountPath}`;
  } else {
    // Public bucket mode - read-only access without credentials
    // Use --anonymous-access flag (not -o option)
    logger.debug(`${LOG_PREFIX} No credentials provided, mounting GCS as public bucket (read-only)`);

    mountCmd = `sudo gcsfuse --anonymous-access -o allow_other ${uidGidFlags} ${shellQuote(config.bucket)} ${quotedMountPath}`;
  }

  logger.debug(`${LOG_PREFIX} Mounting GCS:`, mountCmd);

  const result = await runCommand(sandbox, mountCmd, { timeout: 60_000 });
  logger.debug(`${LOG_PREFIX} gcsfuse result:`, { exitCode: result.exitCode, output: result.output });
  if (result.exitCode !== 0) {
    throw new Error(`Failed to mount GCS bucket: ${result.output}`);
  }
}
