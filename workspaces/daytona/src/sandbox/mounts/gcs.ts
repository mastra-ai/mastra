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
  const checkResult = await run('which gcsfuse || echo "not found"');
  if (checkResult.stdout.includes('not found')) {
    const codenameResult = await run('lsb_release -cs 2>/dev/null || echo jammy');
    const codename = codenameResult.stdout.trim() || 'jammy';

    const installResult = await run(
      'curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo gpg --dearmor -o /etc/apt/keyrings/gcsfuse.gpg && ' +
        `echo "deb [signed-by=/etc/apt/keyrings/gcsfuse.gpg] https://packages.cloud.google.com/apt gcsfuse-${codename} main" | sudo tee /etc/apt/sources.list.d/gcsfuse.list && ` +
        'sudo apt-get update && sudo apt-get install -y gcsfuse',
      120_000,
    );

    if (installResult.exitCode !== 0) {
      throw new Error(`Failed to install gcsfuse: ${installResult.stderr || installResult.stdout}`);
    }
  }

  // Get uid/gid for proper file ownership
  const idResult = await run('id -u && id -g');
  const [uid, gid] = idResult.stdout.trim().split('\n');
  const uidGidFlags = uid && gid ? `--uid=${uid} --gid=${gid}` : '';

  const hasCredentials = !!config.serviceAccountKey;
  let mountCmd: string;

  if (hasCredentials) {
    const keyPath = '/tmp/gcs-key.json';
    await run(`sudo rm -f ${keyPath}`);
    await writeFile(keyPath, config.serviceAccountKey!);
    await run(`sudo chown root:root ${keyPath} && sudo chmod 600 ${keyPath}`);

    mountCmd = `sudo gcsfuse --key-file=${keyPath} -o allow_other ${uidGidFlags} ${config.bucket} ${mountPath}`;
  } else {
    logger.debug(`${LOG_PREFIX} No credentials provided, mounting GCS as public bucket (read-only)`);
    mountCmd = `sudo gcsfuse --anonymous-access -o allow_other ${uidGidFlags} ${config.bucket} ${mountPath}`;
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
