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

  // gcsfuse needs to reach Google Cloud Storage APIs at runtime.
  // Daytona's free/restricted tiers block access to Google services.
  // Fail fast with a clear message instead of hanging on the mount command.
  const connectivityCheck = await run('curl -sS --max-time 5 http://storage.googleapis.com 2>&1', 10_000);
  const checkOutput = connectivityCheck.stdout.trim();
  // Daytona's restricted tiers return HTTP 200 with a plain-text restriction message
  // for HTTP requests, or reset the connection for HTTPS. Detect either case.
  if (
    connectivityCheck.exitCode !== 0 ||
    checkOutput.toLowerCase().includes('restricted') ||
    checkOutput.toLowerCase().includes('blocked')
  ) {
    throw new Error(
      `Cannot reach Google Cloud Storage from this sandbox. ` +
        `GCS mounting requires network access to storage.googleapis.com, ` +
        `which may be blocked on Daytona's restricted tiers. ` +
        `Upgrade to a tier with unrestricted internet access, or contact Daytona support to remove the network restriction.` +
        (checkOutput ? `\n\nSandbox network response: ${checkOutput}` : ''),
    );
  }

  // Install gcsfuse if not present
  const checkResult = await run('which gcsfuse 2>/dev/null || echo "not found"', 30_000);
  if (checkResult.stdout.includes('not found')) {
    logger.warn(`${LOG_PREFIX} gcsfuse not found, attempting runtime installation...`);
    logger.info(`${LOG_PREFIX} Tip: For faster startup, pre-install gcsfuse in your sandbox image`);

    // Ensure curl and gpg are available for downloading the gcsfuse apt key.
    // Do NOT pre-install fuse here — the fuse package post-install script fails in containers
    // (can't run modprobe), leaving dpkg in a broken state that prevents gcsfuse from installing.
    // The gcsfuse apt package handles the fuse/fuse3 dependency automatically when installed.
    await run('sudo apt-get update -qq 2>&1', 60_000);
    const prepResult = await run('sudo apt-get install -y curl gnupg 2>&1', 120_000);
    if (prepResult.exitCode !== 0) {
      throw new Error(
        `Failed to install gcsfuse prerequisites (curl, gnupg): ${prepResult.stderr || prepResult.stdout}`,
      );
    }

    // Detect distro ID and codename from /etc/os-release (more reliable than lsb_release).
    // Google's gcsfuse apt repo only has packages for certain codenames (e.g. bookworm, jammy).
    // If the detected codename has no repo (e.g. trixie, noble), fall back to a known-good
    // codename for the distro family: bookworm for Debian, jammy for Ubuntu.
    const distroIdResult = await run(
      'cat /etc/os-release 2>/dev/null | grep "^ID=" | cut -d= -f2 || echo debian',
      30_000,
    );
    const distroId = distroIdResult.stdout.trim().replace(/"/g, '') || 'debian';

    // Pick the appropriate known-good fallback for this distro family
    const fallbackCodename = distroId === 'ubuntu' ? 'jammy' : 'bookworm';

    const codenameResult = await run(
      `cat /etc/os-release 2>/dev/null | grep "^VERSION_CODENAME=" | cut -d= -f2 || echo ${fallbackCodename}`,
      30_000,
    );
    const detectedCodename = codenameResult.stdout.trim() || fallbackCodename;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(detectedCodename)) {
      throw new Error(`Invalid distro codename for gcsfuse repo: "${detectedCodename}"`);
    }

    logger.debug(`${LOG_PREFIX} Detected distro: ${distroId}/${detectedCodename}, fallback: ${fallbackCodename}`);

    // Set up the gcsfuse apt repository. Use separate curl + gpg steps (not piped)
    // so a curl failure propagates as non-zero exit rather than being masked by gpg.
    const repoSetup = await run(
      'sudo mkdir -p /etc/apt/keyrings && ' +
        'curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg -o /tmp/gcsfuse-key.gpg && ' +
        'sudo gpg --batch --yes --dearmor -o /etc/apt/keyrings/gcsfuse.gpg /tmp/gcsfuse-key.gpg && ' +
        `echo "deb [signed-by=/etc/apt/keyrings/gcsfuse.gpg] https://packages.cloud.google.com/apt gcsfuse-${detectedCodename} main" | sudo tee /etc/apt/sources.list.d/gcsfuse.list`,
      30_000,
    );
    if (repoSetup.exitCode !== 0) {
      throw new Error(`Failed to set up gcsfuse apt repository: ${repoSetup.stderr || repoSetup.stdout}`);
    }

    // apt-get update may fail on unrelated repos (e.g. broken keys); use || true and verify install separately
    await run('sudo apt-get update -qq 2>&1 || true', 60_000);

    let installResult = await run('sudo apt-get install -y gcsfuse 2>&1', 120_000);

    // Fallback: if install failed with detected codename (e.g. trixie, noble — no repo yet),
    // retry with a known-good codename for the distro family.
    if (installResult.exitCode !== 0 && detectedCodename !== fallbackCodename) {
      logger.warn(
        `${LOG_PREFIX} gcsfuse install failed for "${detectedCodename}", retrying with "${fallbackCodename}" fallback`,
      );
      await run(
        'sudo rm -f /etc/apt/sources.list.d/gcsfuse.list && ' +
          `echo "deb [signed-by=/etc/apt/keyrings/gcsfuse.gpg] https://packages.cloud.google.com/apt gcsfuse-${fallbackCodename} main" | sudo tee /etc/apt/sources.list.d/gcsfuse.list`,
        10_000,
      );
      await run('sudo apt-get update -qq 2>&1 || true', 60_000);
      installResult = await run('sudo apt-get install -y gcsfuse 2>&1', 120_000);
    }

    // Verify installation by checking the binary directly.
    // dpkg may report a non-zero exit if fuse's post-install script fails in containers
    // (can't run modprobe), but gcsfuse is still unpacked and usable in that case.
    const verifyResult = await run('which gcsfuse 2>/dev/null || echo "not found"', 30_000);
    if (verifyResult.stdout.includes('not found')) {
      throw new Error(`Failed to install gcsfuse: ${installResult.stderr || installResult.stdout}`);
    }
    if (installResult.exitCode !== 0) {
      logger.warn(`${LOG_PREFIX} gcsfuse install reported dpkg errors (likely fuse post-install in container) but binary is present — proceeding`);
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

  logger.debug(`${LOG_PREFIX} Mounting GCS:`, mountCmd);

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
