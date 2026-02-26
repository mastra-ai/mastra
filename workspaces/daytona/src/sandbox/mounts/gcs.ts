import type { FilesystemMountConfig } from '@mastra/core/workspace';

import { LOG_PREFIX } from '../index';
import { validateBucketName } from './types';
import type { MountContext } from './types';

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

  // Install gcsfuse if not present
  const checkResult = await run('which gcsfuse 2>/dev/null || echo "not found"');
  if (checkResult.stdout.includes('not found')) {
    const codenameResult = await run('lsb_release -cs 2>/dev/null || echo jammy');
    const detectedCodename = codenameResult.stdout.trim() || 'jammy';

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

    const gcsfuseCheck = await run('which gcsfuse 2>/dev/null || echo "not found"');
    if (gcsfuseCheck.stdout.includes('not found')) {
      throw new Error('Failed to install gcsfuse: binary not found after install attempt');
    }
  }

  // Get uid/gid for proper file ownership
  const idResult = await run('id -u && id -g');
  const [uid, gid] = idResult.stdout.trim().split('\n');
  const uidGidFlags = uid && gid ? `--uid=${uid} --gid=${gid}` : '';

  // Allow non-root processes to use FUSE and the allow_other mount option.
  // These are no-ops if already configured.
  await run(`sudo chmod a+rw /dev/fuse 2>/dev/null || true`);
  await run(
    `sudo bash -c 'grep -q "^user_allow_other" /etc/fuse.conf 2>/dev/null || echo "user_allow_other" >> /etc/fuse.conf' 2>/dev/null || true`,
  );

  const hasCredentials = !!config.serviceAccountKey;
  // Run gcsfuse as the sandbox user (not root) so the FUSE connection is registered
  // in the container's user namespace — allowing fusermount -u to unmount it later.
  let mountCmd: string;

  if (hasCredentials) {
    const keyPath = '/tmp/gcs-key.json';
    await run(`sudo rm -f ${keyPath}`);
    await writeFile(keyPath, config.serviceAccountKey!);
    await run(`chmod 600 ${keyPath}`);

    mountCmd = `gcsfuse --key-file=${keyPath} -o allow_other ${uidGidFlags} ${config.bucket} ${mountPath}`;
  } else {
    logger.debug(`${LOG_PREFIX} No credentials provided, mounting GCS as public bucket (read-only)`);
    mountCmd = `gcsfuse --anonymous-access -o allow_other ${uidGidFlags} ${config.bucket} ${mountPath}`;
  }

  logger.debug(`${LOG_PREFIX} Mounting GCS: ${mountCmd}`);

  try {
    const result = await run(mountCmd, 60_000);
    logger.debug(`${LOG_PREFIX} gcsfuse result:`, {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    });
    if (result.exitCode !== 0) {
      throw new Error(`Failed to mount GCS bucket: ${result.stderr || result.stdout}`);
    }
  } catch (error: unknown) {
    const errorObj = error as { result?: { exitCode: number; stdout: string; stderr: string } };
    const stderr = errorObj.result?.stderr || '';
    const stdout = errorObj.result?.stdout || '';
    logger.error(`${LOG_PREFIX} gcsfuse error:`, { stderr, stdout, error: String(error) });
    throw new Error(`Failed to mount GCS bucket: ${stderr || stdout || error}`);
  }
}
