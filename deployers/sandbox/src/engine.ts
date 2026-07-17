import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { supportsNetworking } from '@mastra/core/workspace';
import type { WorkspaceSandbox } from '@mastra/core/workspace';
import {
  DEFAULT_PORT,
  INSTALL_MARKER,
  SERVER_LOGFILE,
  SERVER_PIDFILE,
  SERVER_SCRIPT,
  getInfoSafe,
  killPreviousServer,
  launchServer,
  resolveRemoteDir,
  runInSandbox,
  shellQuote,
  tailServerLog,
  waitForHealthy,
} from './shared';
import type { DeployToSandboxOptions, SandboxDeployLogger, SandboxDeployment } from './types';

const execFileAsync = promisify(execFile);

const noopLogger: SandboxDeployLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

/** Max shell-command payload per chunk for the base64 upload fallback. */
const UPLOAD_CHUNK_SIZE = 96_000;

/**
 * Deploy a prebuilt Mastra server directory into any workspace sandbox that
 * supports networking. Provider-agnostic: only uses the core WorkspaceSandbox
 * contract (`executeCommand` + `networking`, with `writeFiles` / `processes`
 * as fast paths).
 */
export async function deployToSandbox(options: DeployToSandboxOptions): Promise<SandboxDeployment> {
  const {
    sandbox,
    dir,
    port = DEFAULT_PORT,
    env = {},
    studio = false,
    healthCheckPath = '/api',
    healthCheckTimeoutMs = 60_000,
    healthCheckIntervalMs = 1_000,
    installCommand = 'npm install --omit=dev',
    logger = noopLogger,
  } = options;

  if (!existsSync(join(dir, 'index.mjs'))) {
    throw new Error(`No index.mjs found in "${dir}" — did the build succeed?`);
  }

  // 1. Start (providers handle create-or-resume by identity, e.g. sandbox name).
  logger.info(`Starting ${sandbox.provider} sandbox...`);
  await sandbox.start?.();

  if (!supportsNetworking(sandbox)) {
    throw new Error(
      `Sandbox provider "${sandbox.provider}" does not support networking (public port URLs), ` +
        `which is required for sandbox deploys.`,
    );
  }
  if (!sandbox.executeCommand) {
    throw new Error(
      `Sandbox provider "${sandbox.provider}" does not support executeCommand, which is required for sandbox deploys.`,
    );
  }

  const url = await sandbox.networking.getPortUrl(port);
  if (!url) {
    throw new Error(
      `Sandbox provider "${sandbox.provider}" did not expose a public URL for port ${port}. ` +
        `Make sure the port is declared when constructing the sandbox (e.g. \`ports: [${port}]\`).`,
    );
  }

  // Default the remote dir to $HOME/mastra-app — home directories persist
  // across snapshot stop/resume (unlike /tmp), so wakes find the app intact.
  const remoteDir = await resolveRemoteDir(sandbox, options.remoteDir);

  const mergedEnv = { ...env };
  if (studio && mergedEnv.MASTRA_STUDIO_PATH === undefined) {
    mergedEnv.MASTRA_STUDIO_PATH = `${remoteDir}/studio`;
  }

  // 2. Upload the build output as a tarball and extract it in the sandbox.
  logger.info(`Uploading build output from ${dir}...`);
  const tarball = await createTarball(dir);
  logger.debug(`Tarball size: ${(tarball.length / 1024 / 1024).toFixed(2)} MB`);

  const remoteTarball = `${remoteDir}/.deploy.tgz`;
  await runInSandbox(sandbox, `mkdir -p ${shellQuote(remoteDir)}`);
  await uploadFile(sandbox, remoteTarball, tarball);

  // Stop the previous server BEFORE extracting over the live directory so it
  // can never serve a mix of old and new files while the release lands.
  await killPreviousServer(sandbox, remoteDir);

  await runInSandbox(sandbox, `cd ${shellQuote(remoteDir)} && tar -xzf .deploy.tgz && rm -f .deploy.tgz`, {
    timeout: 120_000,
  });

  // 3. Install dependencies, skipped when the install inputs (package.json,
  // bundled lockfiles, and the install command itself) are unchanged since
  // the last completed install.
  const installHash = await hashInstallInputs(dir, installCommand);
  const marker = `${remoteDir}/${INSTALL_MARKER}`;
  const markerCheck = await runInSandbox(sandbox, `cat ${shellQuote(marker)} 2>/dev/null || true`, {
    allowFailure: true,
  });

  if (installHash && markerCheck.stdout.trim() === installHash) {
    logger.info('Dependencies unchanged — skipping install.');
  } else {
    logger.info(`Installing dependencies (${installCommand})...`);
    await runInSandbox(sandbox, `cd ${shellQuote(remoteDir)} && ${installCommand}`, {
      timeout: 600_000,
      label: `install dependencies (${installCommand})`,
    });
    if (installHash) {
      await runInSandbox(sandbox, `printf '%s' ${shellQuote(installHash)} > ${shellQuote(marker)}`);
    }
  }

  // 4. Write the launch script and start the new server (the previous one was
  // stopped before extraction).
  const launchScript = buildLaunchScript({ remoteDir, port, env: mergedEnv });
  await uploadFile(sandbox, `${remoteDir}/${SERVER_SCRIPT}`, Buffer.from(launchScript));
  await runInSandbox(sandbox, `chmod 700 ${shellQuote(`${remoteDir}/${SERVER_SCRIPT}`)}`);

  logger.info('Starting Mastra server...');
  await launchServer(sandbox, remoteDir);

  // 5. Wait for the server to answer on its public URL.
  const healthy = await waitForHealthy(url, {
    path: healthCheckPath,
    timeoutMs: healthCheckTimeoutMs,
    intervalMs: healthCheckIntervalMs,
  });
  if (!healthy) {
    const log = await tailServerLog(sandbox, remoteDir).catch(() => '');
    throw new Error(
      `Mastra server did not become healthy at ${url}${healthCheckPath} within ${healthCheckTimeoutMs}ms.` +
        (log ? `\n\nServer log:\n${log}` : '\n\n(no server log output captured)'),
    );
  }

  const info = await getInfoSafe(sandbox);

  return {
    url,
    sandboxId: info?.id ?? sandbox.id,
    expiresAt: info?.timeoutAt,
    stop: async () => {
      await sandbox.stop?.();
    },
    destroy: async () => {
      await sandbox.destroy?.();
    },
    logs: (lines?: number) => tailServerLog(sandbox, remoteDir, lines),
  };
}

/**
 * Build the POSIX launch script. Re-running the script restarts the server —
 * the wake path uses this after a snapshot resume (which restores the
 * filesystem but not processes).
 */
export function buildLaunchScript(opts: { remoteDir: string; port: number; env: Record<string, string> }): string {
  const lines = ['#!/bin/sh', `cd ${shellQuote(opts.remoteDir)}`];

  // MASTRA_AUTO_DETECT_URL so Studio connects to the sandbox's public URL
  // (same origin) instead of localhost:4111 — overridable. PORT and
  // MASTRA_HOST are applied AFTER custom env: networking (`getPortUrl`) and
  // health checks target the configured port, and the server must bind
  // 0.0.0.0 to be reachable through the public port proxy. Change the port
  // via the deploy `port` option, not env.
  const env: Record<string, string> = {
    MASTRA_AUTO_DETECT_URL: 'true',
    ...opts.env,
    PORT: String(opts.port),
    MASTRA_HOST: '0.0.0.0',
  };
  for (const [key, value] of Object.entries(env)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`Invalid environment variable name: "${key}"`);
    }
    lines.push(`export ${key}=${shellQuote(value)}`);
  }

  lines.push(`echo $$ > ${shellQuote(SERVER_PIDFILE)}`);
  lines.push(`exec node index.mjs >> ${shellQuote(SERVER_LOGFILE)} 2>&1`);
  return lines.join('\n') + '\n';
}

/** Create a gzipped tarball of the directory contents (excluding node_modules). */
async function createTarball(dir: string): Promise<Buffer> {
  const tmp = await mkdtemp(join(tmpdir(), 'mastra-sandbox-'));
  const tarPath = join(tmp, 'deploy.tgz');
  try {
    await execFileAsync('tar', ['-czf', tarPath, '--exclude=node_modules', '-C', dir, '.']);
    return await readFile(tarPath);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

/**
 * Upload a file into the sandbox. Uses the provider's native `writeFiles` fast
 * path when available, otherwise falls back to base64 chunks over
 * `executeCommand` — so `executeCommand` + `networking` is the minimum contract.
 */
async function uploadFile(sandbox: WorkspaceSandbox, remotePath: string, content: Buffer): Promise<void> {
  if (sandbox.writeFiles) {
    await sandbox.writeFiles([{ path: remotePath, content }]);
    return;
  }

  const b64 = content.toString('base64');
  const tmpPath = `${remotePath}.b64`;
  await runInSandbox(sandbox, `rm -f ${shellQuote(tmpPath)}`);
  for (let i = 0; i < b64.length; i += UPLOAD_CHUNK_SIZE) {
    const chunk = b64.slice(i, i + UPLOAD_CHUNK_SIZE);
    await runInSandbox(sandbox, `printf '%s' ${shellQuote(chunk)} >> ${shellQuote(tmpPath)}`, {
      label: `upload chunk to ${remotePath}`,
    });
  }
  await runInSandbox(
    sandbox,
    `base64 -d ${shellQuote(tmpPath)} > ${shellQuote(remotePath)} && rm -f ${shellQuote(tmpPath)}`,
    { label: `decode upload at ${remotePath}` },
  );
}

/** Lockfiles that, when present in the build output, participate in the install-skip hash. */
const LOCKFILES = ['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock'];

/**
 * Hash everything that determines the outcome of a dependency install:
 * package.json, any bundled lockfile, and the install command itself. A
 * matching hash means the previous `node_modules` can be reused.
 */
async function hashInstallInputs(dir: string, installCommand: string): Promise<string | null> {
  const hash = createHash('sha256');
  try {
    hash.update(await readFile(join(dir, 'package.json')));
  } catch {
    return null;
  }
  for (const lockfile of LOCKFILES) {
    let content: Buffer;
    try {
      content = await readFile(join(dir, lockfile));
    } catch {
      // Lockfile not part of the build output.
      continue;
    }
    hash.update(lockfile).update(content);
  }
  hash.update(installCommand);
  return hash.digest('hex');
}
