import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { execa } from 'execa';

import type { FeatureId } from './catalog.js';
import { FeatureNotInstalledError } from './events.js';
import type { FeatureUnavailableReason } from './events.js';
import { acquireLock, isProcessAlive } from './lock.js';

/**
 * Feature packages live outside the mastracode install, in `<featuresRoot>/<sdkVersion>/<feature>/`, each
 * with its own `package.json` and `node_modules`. Global installs may be read-only, `npx` caches are
 * temporary and Homebrew or pnpm own their layouts, so mastracode never writes into its own install.
 *
 * A feature directory only exists once it is complete: npm runs in a staging directory, the result is
 * checked, a marker is written, and the staging directory is renamed into place.
 */

const MARKER_FILE = '.feature.json';
const RESOLVER_FILE = 'resolve.mjs';
const LOG_FILE = 'install.log';

export interface FeatureInstallTarget {
  id: FeatureId;
  /** `{ package: exactVersion }`. */
  packages: Record<string, string>;
  /** `<featuresRoot>/<sdkVersion>`. */
  versionDir: string;
}

export interface FeatureInstallOptions {
  /** Registry URL passed to npm. Omitted → the user's npm configuration decides. */
  registry?: string;
  /** Receives npm's output as it runs. */
  onOutput?: (chunk: string) => void;
  signal?: AbortSignal;
}

interface FeatureMarker {
  feature: FeatureId;
  packages: Record<string, string>;
  installedAt: string;
}

export function getFeatureDir(target: Pick<FeatureInstallTarget, 'id' | 'versionDir'>): string {
  return path.join(target.versionDir, target.id);
}

function readJson<T>(file: string): T | undefined {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return undefined;
  }
}

function samePackages(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => a[key] === b[key]);
}

/** Whether every package in `dir/node_modules` is present at exactly the pinned version. */
function hasPinnedPackages(dir: string, packages: Record<string, string>): boolean {
  return Object.entries(packages).every(
    ([name, version]) =>
      readJson<{ version?: string }>(path.join(dir, 'node_modules', name, 'package.json'))?.version === version,
  );
}

/** The feature directory if it holds a complete install of exactly these packages, else undefined. */
export function findInstalledFeature(target: FeatureInstallTarget): string | undefined {
  const dir = getFeatureDir(target);
  const marker = readJson<FeatureMarker>(path.join(dir, MARKER_FILE));
  if (!marker || !samePackages(marker.packages, target.packages)) return undefined;
  if (!hasPinnedPackages(dir, target.packages)) return undefined;
  return dir;
}

/** Resolves `specifier` from inside an installed feature directory, with Node's ESM conditions. */
export async function resolveFromFeatureDir(dir: string, specifier: string): Promise<string> {
  const resolver = (await import(pathToFileURL(path.join(dir, RESOLVER_FILE)).href)) as {
    resolve: (specifier: string) => string;
  };
  return resolver.resolve(specifier);
}

/** The lock was taken over (this process looked hung). The new owner finishes the install. */
class LockLostError extends Error {}

/** Installs a feature's packages into its own directory. Safe to call from several processes at once. */
export async function installFeature(
  target: FeatureInstallTarget,
  options: FeatureInstallOptions = {},
): Promise<string> {
  fs.mkdirSync(target.versionDir, { recursive: true });
  while (true) {
    try {
      return await installHoldingLock(target, options);
    } catch (error) {
      if (!(error instanceof LockLostError)) throw error;
    }
  }
}

async function installHoldingLock(target: FeatureInstallTarget, options: FeatureInstallOptions): Promise<string> {
  const lock = await acquireLock(path.join(target.versionDir, `.lock-${target.id}`), options.signal);
  const failedPath = path.join(target.versionDir, `.failed-${target.id}.json`);
  let staging: string | undefined;
  try {
    // Another process may have finished it while this one waited for the lock.
    const existing = findInstalledFeature(target);
    if (existing) return existing;

    removeStagingDirs(target);
    staging = fs.mkdtempSync(path.join(target.versionDir, `${stagingPrefix(target)}${process.pid}-`));
    fs.writeFileSync(
      path.join(staging, 'package.json'),
      `${JSON.stringify({ name: `mastracode-feature-${target.id}`, private: true, dependencies: target.packages }, null, 2)}\n`,
    );
    fs.writeFileSync(
      path.join(staging, RESOLVER_FILE),
      'export const resolve = specifier => import.meta.resolve(specifier);\n',
    );

    await runNpmInstall(target, staging, options);

    if (!hasPinnedPackages(staging, target.packages)) {
      throw new FeatureNotInstalledError(target.id, 'failed', 'npm finished but the pinned packages are missing.', {
        remedy: installRemedy(target.id),
      });
    }
    const marker: FeatureMarker = {
      feature: target.id,
      packages: target.packages,
      installedAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(staging, MARKER_FILE), `${JSON.stringify(marker, null, 2)}\n`);

    if (!lock.isHeld()) throw new LockLostError();
    const dir = getFeatureDir(target);
    // Move an outdated install aside rather than deleting it first, so the directory is only briefly absent.
    const previous = fs.existsSync(dir) ? `${staging}.previous` : undefined;
    if (previous) fs.renameSync(dir, previous);
    fs.renameSync(staging, dir);
    staging = previous;
    fs.rmSync(failedPath, { force: true });
    fs.rmSync(path.join(target.versionDir, `.failed-${target.id}.log`), { force: true });
    return dir;
  } catch (error) {
    if (options.signal?.aborted || error instanceof LockLostError) throw error;
    // Keep npm's output next to the failure record; the staging directory is about to go.
    const stagedLog = staging && path.join(staging, LOG_FILE);
    const logPath =
      stagedLog && fs.existsSync(stagedLog) ? path.join(target.versionDir, `.failed-${target.id}.log`) : undefined;
    if (stagedLog && logPath) fs.copyFileSync(stagedLog, logPath);
    const failure = new FeatureNotInstalledError(
      target.id,
      error instanceof FeatureNotInstalledError ? error.reason : 'failed',
      errorMessage(error),
      {
        remedy: error instanceof FeatureNotInstalledError ? error.remedy : installRemedy(target.id),
        logPath,
        cause: error,
      },
    );
    fs.writeFileSync(
      failedPath,
      `${JSON.stringify({ failedAt: new Date().toISOString(), reason: failure.reason, message: failure.message, logPath }, null, 2)}\n`,
    );
    throw failure;
  } finally {
    if (staging) fs.rmSync(staging, { recursive: true, force: true });
    lock.release();
  }
}

export function installRemedy(id: FeatureId): string {
  return `Run "mastracode features install ${id}" when the npm registry is reachable.`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function stagingPrefix(target: Pick<FeatureInstallTarget, 'id'>): string {
  return `.staging-${target.id}-`;
}

/**
 * Staging directories left by an interrupted install. Only called while holding the feature's lock; a
 * directory whose process is still running is left alone (that process lost the lock and cleans up itself).
 */
function removeStagingDirs(target: FeatureInstallTarget): void {
  const prefix = stagingPrefix(target);
  for (const entry of fs.readdirSync(target.versionDir)) {
    if (!entry.startsWith(prefix)) continue;
    const pid = Number(entry.slice(prefix.length).split('-')[0]);
    if (Number.isInteger(pid) && pid > 0 && isProcessAlive(pid)) continue;
    fs.rmSync(path.join(target.versionDir, entry), { recursive: true, force: true });
  }
}

type NpmCommand = { command: string; args: string[] };

/**
 * npm, preferring the copy that ships with the running Node (nvm, fnm, volta, Homebrew and the official
 * installers all put it there), then whatever `npm` is on PATH.
 */
export function findNpm(): NpmCommand {
  const nodeDir = path.dirname(process.execPath);
  for (const cli of [
    path.join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ]) {
    if (fs.existsSync(cli)) return { command: process.execPath, args: [cli] };
  }
  return { command: 'npm', args: [] };
}

/**
 * `npm_config_*` variables that would redirect the install, inherited when mastracode itself runs from
 * `npx` or an npm script. The user's `.npmrc` files (registry, proxy, auth) still apply.
 */
const REDIRECTING_NPM_ENV = ['npm_config_global', 'npm_config_location', 'npm_config_prefix'];

async function runNpmInstall(target: FeatureInstallTarget, cwd: string, options: FeatureInstallOptions): Promise<void> {
  const npm = findNpm();
  const args = [
    ...npm.args,
    'install',
    // Feature packages ship prebuilt binaries; no install script is needed (onnxruntime-node's only
    // downloads optional CUDA libraries). Same policy as plugin dependency installs.
    '--ignore-scripts',
    '--omit=dev',
    '--no-audit',
    '--no-fund',
    '--loglevel=error',
    ...(options.registry ? ['--registry', options.registry] : []),
  ];
  const env: Record<string, string | undefined> = { ...process.env };
  for (const key of Object.keys(env)) {
    if (REDIRECTING_NPM_ENV.includes(key.toLowerCase())) delete env[key];
  }

  const logPath = path.join(cwd, LOG_FILE);
  const log = fs.createWriteStream(logPath);
  const child = execa(npm.command, args, {
    cwd,
    env,
    extendEnv: false,
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
    cancelSignal: options.signal,
    reject: false,
  });
  const onData = (chunk: Buffer) => {
    log.write(chunk);
    options.onOutput?.(chunk.toString());
  };
  child.stdout?.on('data', onData);
  child.stderr?.on('data', onData);
  const result = await child;
  await new Promise(resolve => log.end(resolve));

  if (result.isCanceled) throw options.signal?.reason ?? new Error('Install cancelled');
  if ((result as { code?: string }).code === 'ENOENT') {
    throw new FeatureNotInstalledError(target.id, 'no-package-manager', 'npm was not found.', {
      remedy: `Install npm, or install the packages next to mastracode: npm install -g ${Object.entries(target.packages)
        .map(([name, version]) => `${name}@${version}`)
        .join(' ')}`,
      cause: result,
    });
  }
  if (result.exitCode !== 0) {
    const output = fs.readFileSync(logPath, 'utf8');
    const reason = classifyNpmFailure(output);
    throw new FeatureNotInstalledError(target.id, reason, describeFailure(reason, result.exitCode), {
      remedy: installRemedy(target.id),
    });
  }
}

/** Maps npm's error codes to a cause the user can act on. */
export function classifyNpmFailure(output: string): FeatureUnavailableReason {
  if (/\b(ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENETUNREACH|EHOSTUNREACH)\b/.test(output)) {
    return 'network';
  }
  if (/\b(E401|E403|ENEEDAUTH)\b/.test(output)) return 'auth';
  if (/\b(E404|ETARGET)\b/.test(output)) return 'not-found';
  return 'failed';
}

function describeFailure(reason: FeatureUnavailableReason, exitCode: number | undefined): string {
  switch (reason) {
    case 'network':
      return 'the npm registry could not be reached (offline, DNS or proxy problem).';
    case 'auth':
      return 'the npm registry refused the request (check your npm login or token).';
    case 'not-found':
      return 'the npm registry does not have the required version (a private mirror may lag behind).';
    default:
      return `npm install failed (exit code ${exitCode}).`;
  }
}
