import { createHash } from 'node:crypto';

import type { FilesystemMountConfig } from '@mastra/core/workspace';

import { shellQuote } from '../../utils/shell-quote';
import { LOG_PREFIX, validateEndpoint, validatePrefix } from './types';
import type { MountContext } from './types';

/**
 * Azure Blob mount config for Daytona (mounted via blobfuse2).
 *
 * Authentication is selected from the first applicable option:
 *   1. `useDefaultCredential` (managed identity, requires running in Azure)
 *   2. `sasToken`
 *   3. `accountKey`
 *   4. `connectionString` (parsed for AccountName/AccountKey/SharedAccessSignature/BlobEndpoint)
 */
export interface DaytonaAzureBlobMountConfig extends FilesystemMountConfig {
  type: 'azure-blob';
  /** Azure Blob container name */
  container: string;
  /** Storage account name (required unless supplied via connectionString) */
  accountName?: string;
  /** Storage account access key */
  accountKey?: string;
  /** Shared Access Signature token (without leading '?') */
  sasToken?: string;
  /** Azure Storage connection string */
  connectionString?: string;
  /** Use DefaultAzureCredential / managed identity (mode: msi) */
  useDefaultCredential?: boolean;
  /** Custom blob endpoint (e.g. for sovereign clouds or Azurite) */
  endpoint?: string;
  /**
   * Optional prefix (subdirectory) to mount instead of the entire container.
   * Uses blobfuse2 --subdirectory. Leading/trailing slashes are normalized.
   */
  prefix?: string;
  /** Mount as read-only */
  readOnly?: boolean;
}

// Azure container names: 3-63 lowercase alphanumeric chars or hyphens, no leading/
// trailing hyphen, no consecutive hyphens.
const SAFE_CONTAINER_NAME = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const BLOBFUSE2_GITHUB_DEB =
  'https://github.com/Azure/azure-storage-fuse/releases/download/blobfuse2-2.5.1/blobfuse2-2.5.1-Ubuntu-22.04.x86_64.deb';

function validateContainerName(name: string): void {
  if (!SAFE_CONTAINER_NAME.test(name) || name.includes('--')) {
    throw new Error(
      `Invalid Azure container name: "${name}". Container names must be 3-63 lowercase alphanumeric characters or hyphens, with no consecutive hyphens.`,
    );
  }
}

interface ParsedConnectionString {
  accountName?: string;
  accountKey?: string;
  sasToken?: string;
  endpoint?: string;
  endpointSuffix?: string;
  protocol?: string;
}

function parseConnectionString(cs: string): ParsedConnectionString {
  const out: ParsedConnectionString = {};
  for (const part of cs.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (!value) continue;
    if (key === 'AccountName') out.accountName = value;
    else if (key === 'AccountKey') out.accountKey = value;
    else if (key === 'SharedAccessSignature') out.sasToken = value;
    else if (key === 'BlobEndpoint') out.endpoint = value;
    else if (key === 'EndpointSuffix') out.endpointSuffix = value;
    else if (key === 'DefaultEndpointsProtocol') out.protocol = value;
  }
  if (!out.endpoint && out.accountName) {
    out.endpoint = `${out.protocol || 'https'}://${out.accountName}.blob.${out.endpointSuffix || 'core.windows.net'}`;
  }
  return out;
}

function yamlString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function parseOsRelease(output: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of output.split('\n')) {
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq);
    const value = line
      .slice(eq + 1)
      .trim()
      .replace(/^"|"$/g, '');
    values[key] = value;
  }
  return values;
}

interface MicrosoftAptRepo {
  repoUrl: string;
  suite: string;
}

function resolveMicrosoftAptRepos(osReleaseOutput: string): MicrosoftAptRepo[] {
  const osRelease = parseOsRelease(osReleaseOutput);
  const distroId = osRelease.ID || 'ubuntu';
  const codename = osRelease.VERSION_CODENAME || (distroId === 'debian' ? 'bookworm' : 'jammy');
  const versionId = osRelease.VERSION_ID || (distroId === 'debian' ? '12' : '22.04');

  if (!/^[a-z0-9][a-z0-9-]*$/.test(codename)) {
    throw new Error(`Invalid distro codename for blobfuse2 repo: "${codename}"`);
  }
  if (!/^\d+(?:\.\d+)?$/.test(versionId)) {
    throw new Error(`Invalid distro version for blobfuse2 repo: "${versionId}"`);
  }

  if (distroId === 'debian') {
    const repos = [
      { repoUrl: `https://packages.microsoft.com/debian/${versionId.split('.')[0]}/prod`, suite: codename },
    ];
    if (versionId.split('.')[0] !== '12' || codename !== 'bookworm') {
      repos.push({ repoUrl: 'https://packages.microsoft.com/debian/12/prod', suite: 'bookworm' });
    }
    return repos;
  }
  if (distroId === 'ubuntu') {
    const repos = [{ repoUrl: `https://packages.microsoft.com/ubuntu/${versionId}/prod`, suite: codename }];
    if (versionId !== '24.04' || codename !== 'noble') {
      repos.push({ repoUrl: 'https://packages.microsoft.com/ubuntu/24.04/prod', suite: 'noble' });
    }
    if (versionId !== '22.04' || codename !== 'jammy') {
      repos.push({ repoUrl: 'https://packages.microsoft.com/ubuntu/22.04/prod', suite: 'jammy' });
    }
    return repos;
  }

  throw new Error(`Unsupported distro for blobfuse2 runtime installation: "${distroId}"`);
}

interface ResolvedAuth {
  mode: 'key' | 'sas' | 'msi';
  accountName: string;
  accountKey?: string;
  sasToken?: string;
  endpoint?: string;
}

function resolveAuth(config: DaytonaAzureBlobMountConfig): ResolvedAuth {
  let accountName = config.accountName;
  let accountKey = config.accountKey;
  let sasToken = config.sasToken;
  let endpoint = config.endpoint;

  if (config.connectionString) {
    const parsed = parseConnectionString(config.connectionString);
    accountName = accountName ?? parsed.accountName;
    accountKey = accountKey ?? parsed.accountKey;
    sasToken = sasToken ?? parsed.sasToken;
    endpoint = endpoint ?? parsed.endpoint;
  }

  let mode: 'key' | 'sas' | 'msi';
  if (config.useDefaultCredential) {
    mode = 'msi';
  } else if (sasToken) {
    mode = 'sas';
  } else if (accountKey) {
    mode = 'key';
  } else {
    throw new Error(
      'Azure Blob mount requires credentials: provide connectionString, accountKey + accountName, sasToken + accountName, or useDefaultCredential.',
    );
  }

  if (!accountName) {
    throw new Error('Azure Blob mount requires an accountName (either explicitly or via connectionString).');
  }

  if (endpoint) {
    validateEndpoint(endpoint);
  }

  return { mode, accountName, accountKey, sasToken, endpoint };
}

function buildBlobfuseConfig(container: string, auth: ResolvedAuth, cachePath: string, readOnly: boolean): string {
  const lines: string[] = [
    'allow-other: true',
    'foreground: false',
    `read-only: ${readOnly ? 'true' : 'false'}`,
    'logging:',
    '  type: silent',
    'components:',
    '  - libfuse',
    '  - file_cache',
    '  - attr_cache',
    '  - azstorage',
    'libfuse:',
    '  attribute-expiration-sec: 240',
    '  entry-expiration-sec: 240',
    '  negative-entry-expiration-sec: 120',
    'file_cache:',
    `  path: ${yamlString(cachePath)}`,
    '  timeout-sec: 120',
    'attr_cache:',
    '  timeout-sec: 7200',
    'azstorage:',
    `  mode: ${auth.mode}`,
    `  account-name: ${yamlString(auth.accountName)}`,
    `  container: ${yamlString(container)}`,
  ];
  if (auth.mode === 'key' && auth.accountKey) {
    lines.push(`  account-key: ${yamlString(auth.accountKey)}`);
  } else if (auth.mode === 'sas' && auth.sasToken) {
    lines.push(`  sas: ${yamlString(auth.sasToken)}`);
  }
  if (auth.endpoint) {
    lines.push(`  endpoint: ${yamlString(auth.endpoint.replace(/\/$/, ''))}`);
  }
  return lines.join('\n') + '\n';
}

/**
 * Mount an Azure Blob container using blobfuse2.
 */
export async function mountAzure(
  mountPath: string,
  config: DaytonaAzureBlobMountConfig,
  ctx: MountContext,
): Promise<void> {
  const { run, writeFile, logger } = ctx;

  validateContainerName(config.container);
  const auth = resolveAuth(config);
  const prefix = config.prefix ? validatePrefix(config.prefix) : undefined;

  const quotedMountPath = shellQuote(mountPath);

  const curlCheck = await run('which curl 2>/dev/null || echo "not found"', 30_000);
  if (curlCheck.stdout.includes('not found')) {
    const curlInstall = await run('sudo apt-get update -qq 2>&1 && sudo apt-get install -y curl 2>&1', 120_000);
    if (curlInstall.exitCode !== 0) {
      throw new Error(
        `Failed to install curl for Azure Blob reachability check: ${curlInstall.stderr || curlInstall.stdout}`,
      );
    }
  }

  // Verify network reachability to the blob endpoint. Daytona's restricted tiers
  // block traffic to azure.com domains, which would otherwise hang the mount.
  const probeUrl = auth.endpoint
    ? auth.endpoint.replace(/\/$/, '')
    : `https://${auth.accountName}.blob.core.windows.net`;
  const connectivityCheck = await run(`curl -sS --max-time 5 ${shellQuote(probeUrl)} 2>&1`, 10_000);
  const checkOutput = connectivityCheck.stdout.trim();
  if (
    connectivityCheck.exitCode !== 0 ||
    checkOutput.toLowerCase().includes('restricted') ||
    checkOutput.toLowerCase().includes('blocked')
  ) {
    throw new Error(
      `Cannot reach ${probeUrl} from this sandbox. ` +
        `Azure Blob mounting requires network access to the storage endpoint, ` +
        `which may be blocked on Daytona's restricted tiers. ` +
        `Upgrade to a tier with unrestricted internet access, or contact Daytona support to remove the network restriction.` +
        (checkOutput ? `\n\nSandbox network response: ${checkOutput}` : ''),
    );
  }

  // Install blobfuse2 if not present
  const checkResult = await run('which blobfuse2 2>/dev/null || echo "not found"', 30_000);
  if (checkResult.stdout.includes('not found')) {
    logger.warn(`${LOG_PREFIX} blobfuse2 not found, attempting runtime installation...`);
    logger.info(`${LOG_PREFIX} Tip: For faster startup, pre-install blobfuse2 in your sandbox image`);

    await run('sudo apt-get update -qq 2>&1', 60_000);
    const prepResult = await run('sudo apt-get install -y curl gnupg 2>&1', 120_000);
    if (prepResult.exitCode !== 0) {
      throw new Error(
        `Failed to install blobfuse2 prerequisites (curl, gnupg): ${prepResult.stderr || prepResult.stdout}`,
      );
    }

    const osReleaseResult = await run('cat /etc/os-release 2>/dev/null || true', 30_000);
    const repos = resolveMicrosoftAptRepos(osReleaseResult.stdout);

    const repoSetup = await run(
      'sudo mkdir -p /etc/apt/keyrings && ' +
        'curl --retry 3 --retry-all-errors --retry-delay 2 -fsSL https://packages.microsoft.com/keys/microsoft.asc -o /tmp/ms-key.asc && ' +
        'sudo gpg --batch --yes --dearmor -o /etc/apt/keyrings/microsoft.gpg /tmp/ms-key.asc',
      30_000,
    );

    let installResult: { exitCode: number; stdout: string; stderr: string } | undefined;
    if (repoSetup.exitCode === 0) {
      for (const { repoUrl, suite } of repos) {
        await run(
          `echo "deb [signed-by=/etc/apt/keyrings/microsoft.gpg] ${repoUrl} ${suite} main" | sudo tee /etc/apt/sources.list.d/microsoft-prod.list`,
          30_000,
        );
        await run('sudo apt-get update -qq 2>&1 || true', 60_000);
        installResult = await run('sudo apt-get install -y blobfuse2 fuse3 2>&1', 120_000);
        if (installResult.exitCode === 0) break;
        logger.warn(`${LOG_PREFIX} blobfuse2 install failed for ${repoUrl} ${suite}, trying fallback if available`);
      }
    } else {
      logger.warn(`${LOG_PREFIX} Failed to set up Microsoft apt repository, trying GitHub release fallback`);
    }

    let verifyResult = await run('which blobfuse2 && blobfuse2 --version', 30_000);
    if (verifyResult.exitCode !== 0) {
      installResult = await run(
        'sudo apt-get update -qq 2>&1 || true && ' +
          'sudo apt-get install -y fuse3 ca-certificates curl 2>&1 && ' +
          `curl -L --retry 3 --retry-all-errors --retry-delay 2 -fSLo /tmp/blobfuse2.deb ${BLOBFUSE2_GITHUB_DEB} && ` +
          'sudo dpkg -i /tmp/blobfuse2.deb 2>&1 && ' +
          'sudo bash -c \'lib=$(find /usr/lib -name "libfuse3.so.3.*" | head -1); [ -z "$lib" ] || ln -sf "$lib" /usr/lib/x86_64-linux-gnu/libfuse3.so.3\'',
        180_000,
      );
      verifyResult = await run('which blobfuse2 && blobfuse2 --version', 30_000);
    }

    if (!installResult || verifyResult.exitCode !== 0) {
      throw new Error(
        `Failed to install blobfuse2: ${
          verifyResult.stderr ||
          verifyResult.stdout ||
          installResult?.stderr ||
          installResult?.stdout ||
          'unknown error'
        }`,
      );
    }
  }

  // Get uid/gid for proper file ownership of the cache directory
  const idResult = await run('id -u && id -g', 30_000);
  const [uid, gid] = idResult.stdout.trim().split('\n');
  const validUidGid = uid && gid && /^\d+$/.test(uid) && /^\d+$/.test(gid);

  // Allow non-root processes to use FUSE and the allow_other mount option.
  await run(
    `sudo chmod a+rw /dev/fuse 2>/dev/null || true; ` +
      `sudo bash -c 'grep -q "^user_allow_other" /etc/fuse.conf 2>/dev/null || echo "user_allow_other" >> /etc/fuse.conf' 2>/dev/null || true`,
  );

  // Use a mount-specific config + cache path to avoid races with concurrent mounts.
  const mountHash = createHash('md5').update(mountPath).digest('hex').slice(0, 8);
  const configPath = `/tmp/.blobfuse2-config-${mountHash}.yaml`;
  const cachePath = `/tmp/blobfuse2-cache-${mountHash}`;

  const yaml = buildBlobfuseConfig(config.container, auth, cachePath, !!config.readOnly);

  await run(`sudo rm -f ${shellQuote(configPath)}`, 30_000);
  await writeFile(configPath, yaml);
  await run(`chmod 600 ${shellQuote(configPath)}`, 30_000);

  // blobfuse2 requires an empty cache directory when mounting.
  await run(`sudo rm -rf ${shellQuote(cachePath)} && mkdir -p ${shellQuote(cachePath)}`, 30_000);
  if (validUidGid) {
    await run(`sudo chown ${uid}:${gid} ${shellQuote(cachePath)} 2>/dev/null || true`, 30_000);
  }

  // Run blobfuse2 as the sandbox user (not root) so the FUSE connection is registered
  // in the user namespace — allowing fusermount -u to unmount it later.
  const prefixFlags = prefix ? ` --virtual-directory=true --subdirectory=${shellQuote(prefix)}` : '';
  const mountCmd = `blobfuse2 mount ${quotedMountPath} --config-file=${shellQuote(configPath)}${prefixFlags}`;
  logger.debug(`${LOG_PREFIX} Mounting Azure Blob:`, mountCmd);

  const result = await run(mountCmd, 60_000);
  logger.debug(`${LOG_PREFIX} blobfuse2 result:`, {
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
  });
  if (result.exitCode !== 0) {
    throw new Error(`Failed to mount Azure Blob container: ${result.stderr || result.stdout}`);
  }
}
