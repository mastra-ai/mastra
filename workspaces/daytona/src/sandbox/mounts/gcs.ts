import { createHash } from 'node:crypto';

import type { FilesystemMountConfig } from '@mastra/core/workspace';

import { shellQuote } from '../../utils/shell-quote';
import { LOG_PREFIX, validateBucketName } from './types';
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
  const { run, writeFile, logger } = ctx;

  validateBucketName(config.bucket);

  const quotedMountPath = shellQuote(mountPath);

  // Install gcsfuse if not present
  const checkResult = await run('which gcsfuse 2>/dev/null || echo "not found"', 30_000);
  if (checkResult.stdout.includes('not found')) {
    logger.warn(`${LOG_PREFIX} gcsfuse not found, attempting runtime installation...`);
    logger.info(`${LOG_PREFIX} Tip: For faster startup, pre-install gcsfuse in your sandbox image`);

    const codenameResult = await run('lsb_release -cs 2>/dev/null || echo jammy', 30_000);
    const detectedCodename = codenameResult.stdout.trim() || 'jammy';
    if (!/^[a-z0-9][a-z0-9-]*$/.test(detectedCodename)) {
      throw new Error(`Invalid distro codename for gcsfuse repo: "${detectedCodename}"`);
    }

    // Set up the gcsfuse apt repository. Use separate curl + gpg steps (not piped)
    // so a curl failure propagates as non-zero exit rather than being masked by gpg.
    await run(
      'sudo mkdir -p /etc/apt/keyrings && ' +
        'curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg -o /tmp/gcsfuse-key.gpg 2>/dev/null && ' +
        'sudo gpg --batch --yes --dearmor -o /etc/apt/keyrings/gcsfuse.gpg /tmp/gcsfuse-key.gpg && ' +
        `echo "deb [signed-by=/etc/apt/keyrings/gcsfuse.gpg] https://packages.cloud.google.com/apt gcsfuse-${detectedCodename} main" | sudo tee /etc/apt/sources.list.d/gcsfuse.list`,
      30_000,
    );

    // apt-get update may fail on unrelated repos (e.g. broken keys); use || true and verify install separately
    await run('sudo apt-get update -qq 2>&1 || true', 60_000);

    let installResult = await run('sudo apt-get install -y gcsfuse 2>&1', 120_000);

    // Fallback: if install failed with detected codename (e.g. 'noble' repo not yet available),
    // retry with 'jammy' which is a known-stable codename with available packages.
    if (installResult.exitCode !== 0 && detectedCodename !== 'jammy') {
      logger.warn(
        `${LOG_PREFIX} gcsfuse install failed for codename "${detectedCodename}", retrying with "jammy" fallback`,
      );
      await run(
        'sudo rm -f /etc/apt/sources.list.d/gcsfuse.list && ' +
          'echo "deb [signed-by=/etc/apt/keyrings/gcsfuse.gpg] https://packages.cloud.google.com/apt gcsfuse-jammy main" | sudo tee /etc/apt/sources.list.d/gcsfuse.list',
        10_000,
      );
      await run('sudo apt-get update -qq 2>&1 || true', 60_000);
      installResult = await run('sudo apt-get install -y gcsfuse 2>&1', 120_000);
    }

    if (installResult.exitCode !== 0) {
      throw new Error(`Failed to install gcsfuse: ${installResult.stderr || installResult.stdout}`);
    }

    // Verify installation
    const verifyResult = await run('which gcsfuse 2>/dev/null || echo "not found"', 30_000);
    if (verifyResult.stdout.includes('not found')) {
      throw new Error('gcsfuse installation appeared to succeed but binary not found on PATH');
    }
  }

  // Get uid/gid for proper file ownership
  const idResult = await run('id -u && id -g', 30_000);
  const [uid, gid] = idResult.stdout.trim().split('\n');
  const validUidGid = uid && gid && /^\d+$/.test(uid) && /^\d+$/.test(gid);
  if (!validUidGid) {
    logger.warn(
      `${LOG_PREFIX} Unexpected uid/gid format: "${idResult.stdout.trim()}" — mounted files will be owned by root`,
    );
  }
  // Note: gcsfuse uses --uid/--gid flags, not -o uid=X style
  const uidGidFlags = validUidGid ? `--uid=${uid} --gid=${gid}` : '';

  // Allow non-root processes to use FUSE and the allow_other mount option.
  // These are no-ops if already configured.
  await run(
    `sudo chmod a+rw /dev/fuse 2>/dev/null || true; ` +
      `sudo bash -c 'grep -q "^user_allow_other" /etc/fuse.conf 2>/dev/null || echo "user_allow_other" >> /etc/fuse.conf' 2>/dev/null || true`,
  );

  const hasCredentials = !!config.serviceAccountKey;
  // Run gcsfuse as the sandbox user (not root) so the FUSE connection is registered
  // in the container's user namespace — allowing fusermount -u to unmount it later.
  let mountCmd: string;

  if (hasCredentials) {
    // Use a mount-specific key path to avoid races with concurrent mounts
    const mountHash = createHash('md5').update(mountPath).digest('hex').slice(0, 8);
    const keyPath = `/tmp/gcs-key-${mountHash}.json`;
    await run(`sudo rm -f ${shellQuote(keyPath)}`, 30_000);
    await writeFile(keyPath, config.serviceAccountKey!);
    await run(`chmod 600 ${shellQuote(keyPath)}`, 30_000);

    mountCmd = `gcsfuse --key-file=${shellQuote(keyPath)} -o allow_other ${uidGidFlags} ${shellQuote(config.bucket)} ${quotedMountPath}`;
  } else {
    logger.debug(`${LOG_PREFIX} No credentials provided, mounting GCS as public bucket (read-only)`);
    mountCmd = `gcsfuse --anonymous-access -o allow_other ${uidGidFlags} ${shellQuote(config.bucket)} ${quotedMountPath}`;
  }

  logger.debug(`${LOG_PREFIX} Mounting GCS: ${mountCmd}`);

  const result = await run(mountCmd, 60_000);
  logger.debug(`${LOG_PREFIX} gcsfuse result:`, {
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
  });
  if (result.exitCode !== 0) {
    throw new Error(`Failed to mount GCS bucket: ${result.stderr || result.stdout}`);
  }
}
