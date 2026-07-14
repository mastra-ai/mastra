import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { execa } from 'execa';

import { DEFAULT_CONFIG_DIR } from '../constants.js';
import { getEntryPackageRoot, installPluginDependenciesForEntry } from './dependencies.js';
import type { PluginInstallExecutionOptions } from './dependencies.js';
import { getSingleManifestPlugin } from './manifest.js';
import { ensureMastraCodePackageLink } from './package-link.js';
import type { PluginPathOptions } from './paths.js';

const ENTRY_CANDIDATES = ['src/index.ts', 'index.ts'];
export const NON_INTERACTIVE_GIT_ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0' };

export type PreparedPluginSource = {
  source: 'local' | 'github';
  pluginRoot: string;
  entry: string;
  ref?: string;
};

export type PreparePluginSourceOptions = PluginPathOptions &
  PluginInstallExecutionOptions & {
    cwd?: string;
    entry?: string;
    ref?: string;
    githubCliPath?: string;
    standalone?: boolean;
    checkoutDir?: string;
    lockWaitMs?: number;
    staleLockMs?: number;
  };

export type ParsedGithubUrl = { owner: string; repo: string; repoSpec: string; ref?: string };

const FULL_COMMIT_SHA = /^[a-fA-F0-9]{40}$/;
const DEFAULT_LOCK_WAIT_MS = 30_000;
const DEFAULT_STALE_LOCK_MS = 120_000;

export async function preparePluginSource(
  specifier: string,
  options: PreparePluginSourceOptions,
): Promise<PreparedPluginSource> {
  if (/^https?:\/\//i.test(specifier)) return prepareGithubPluginSource(specifier, options);
  return prepareLocalPluginSource(specifier, options);
}

export async function prepareLocalPluginSource(
  specifier: string,
  options: PreparePluginSourceOptions,
): Promise<PreparedPluginSource> {
  const pluginRoot = path.resolve(options.cwd ?? options.projectRoot, specifier);
  if (!fs.existsSync(pluginRoot) || !fs.statSync(pluginRoot).isDirectory()) {
    throw new Error(`Local plugin path does not exist or is not a directory: ${specifier}`);
  }
  const entry = detectEntry(pluginRoot, options.entry);
  ensureMastraCodePackageLink(getEntryPackageRoot(pluginRoot, entry));
  return { source: 'local', pluginRoot, entry };
}

export async function prepareGithubPluginSource(
  specifier: string,
  options: PreparePluginSourceOptions,
): Promise<PreparedPluginSource> {
  const parsed = parseGithubUrl(specifier);
  const ref = options.ref ?? parsed.ref;
  if (ref?.startsWith('-')) throw new Error('GitHub plugin ref must not start with a dash');
  const checkoutDir = options.checkoutDir ?? getStandaloneCheckoutDir(parsed, ref, options);
  const githubCli = options.githubCliPath ?? 'gh';

  if (!options.standalone) {
    await assertGithubCliAvailable(githubCli);
    await assertGithubCliAuthenticated(githubCli);
    await cloneAndPrepare(parsed, ref, checkoutDir, githubCli, options);
    return {
      source: 'github',
      pluginRoot: checkoutDir,
      entry: detectEntry(checkoutDir, options.entry),
      ...(ref ? { ref } : {}),
    };
  }

  return withCheckoutLock(checkoutDir, options, async () => {
    if (ref && FULL_COMMIT_SHA.test(ref) && (await checkoutMatchesCommit(checkoutDir, ref))) {
      return {
        source: 'github' as const,
        pluginRoot: checkoutDir,
        entry: detectEntry(checkoutDir, options.entry),
        ref,
      };
    }

    await assertGithubCliAvailable(githubCli);
    await assertGithubCliAuthenticated(githubCli);
    const temporaryDir = `${checkoutDir}.tmp-${process.pid}-${randomUUID()}`;
    fs.rmSync(temporaryDir, { recursive: true, force: true });
    try {
      await cloneAndPrepare(parsed, ref, temporaryDir, githubCli, options);
      fs.rmSync(checkoutDir, { recursive: true, force: true });
      fs.mkdirSync(path.dirname(checkoutDir), { recursive: true });
      fs.renameSync(temporaryDir, checkoutDir);
    } catch (error) {
      fs.rmSync(temporaryDir, { recursive: true, force: true });
      throw error;
    }

    return {
      source: 'github' as const,
      pluginRoot: checkoutDir,
      entry: detectEntry(checkoutDir, options.entry),
      ...(ref ? { ref } : {}),
    };
  });
}

async function cloneAndPrepare(
  parsed: ParsedGithubUrl,
  ref: string | undefined,
  checkoutDir: string,
  githubCli: string,
  options: PreparePluginSourceOptions,
): Promise<void> {
  fs.rmSync(checkoutDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(checkoutDir), { recursive: true });
  await runCommand(
    githubCli,
    ['repo', 'clone', parsed.repoSpec, checkoutDir, ...(ref ? [] : ['--', '--depth', '1'])],
    undefined,
    options,
  );
  if (ref) await runCommand('git', ['checkout', ref], checkoutDir, options);
  const entry = detectEntry(checkoutDir, options.entry);
  await installPluginDependenciesForEntry(checkoutDir, entry, options);
  ensureMastraCodePackageLink(getEntryPackageRoot(checkoutDir, entry));
}

async function checkoutMatchesCommit(checkoutDir: string, ref: string): Promise<boolean> {
  if (!fs.existsSync(checkoutDir)) return false;
  try {
    const result = await execa('git', ['rev-parse', 'HEAD'], {
      cwd: checkoutDir,
      env: NON_INTERACTIVE_GIT_ENV,
      stdout: 'pipe',
      stderr: 'ignore',
    });
    return result.stdout.trim().toLowerCase() === ref.toLowerCase();
  } catch {
    return false;
  }
}

async function withCheckoutLock<T>(
  checkoutDir: string,
  options: PreparePluginSourceOptions,
  operation: () => Promise<T>,
): Promise<T> {
  const lockDir = `${checkoutDir}.lock`;
  const waitMs = options.lockWaitMs ?? DEFAULT_LOCK_WAIT_MS;
  const staleMs = options.staleLockMs ?? DEFAULT_STALE_LOCK_MS;
  const deadline = Date.now() + waitMs;
  fs.mkdirSync(path.dirname(lockDir), { recursive: true });

  while (true) {
    try {
      fs.mkdirSync(lockDir);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const stat = fs.statSync(lockDir);
      if (Date.now() - stat.mtimeMs > staleMs) {
        fs.rmSync(lockDir, { recursive: true, force: true });
        continue;
      }
      if (Date.now() >= deadline) throw new Error('Timed out waiting to prepare GitHub plugin source');
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  try {
    return await operation();
  } finally {
    fs.rmSync(lockDir, { recursive: true, force: true });
  }
}

function getStandaloneCheckoutDir(
  parsed: ParsedGithubUrl,
  ref: string | undefined,
  options: PluginPathOptions,
): string {
  const baseDir = options.homeDir ?? os.homedir();
  const configDir = options.configDir ?? DEFAULT_CONFIG_DIR;
  const refKey = ref && FULL_COMMIT_SHA.test(ref) ? ref.toLowerCase() : hashRef(ref ?? 'default');
  return path.join(baseDir, configDir, 'plugins', 'standalone', 'github', `${parsed.owner}-${parsed.repo}`, refKey);
}

function hashRef(ref: string): string {
  return createHash('sha256').update(ref).digest('hex').slice(0, 16);
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string | undefined,
  options: PluginInstallExecutionOptions,
): Promise<void> {
  const child = execa(command, args, {
    ...(cwd ? { cwd } : {}),
    env: NON_INTERACTIVE_GIT_ENV,
    stdout: options.onOutput ? 'pipe' : 'ignore',
    stderr: options.onOutput ? 'pipe' : 'ignore',
    cancelSignal: options.signal,
  });
  if (options.onOutput) {
    child.stdout?.on('data', options.onOutput);
    child.stderr?.on('data', options.onOutput);
  }
  await child;
}

async function assertGithubCliAvailable(githubCli: string): Promise<void> {
  try {
    await execa(githubCli, ['--version'], { env: NON_INTERACTIVE_GIT_ENV });
  } catch {
    throw new Error('GitHub CLI is required to install GitHub plugins. Install gh and run gh auth login.');
  }
}

async function assertGithubCliAuthenticated(githubCli: string): Promise<void> {
  try {
    await execa(githubCli, ['auth', 'status'], { env: NON_INTERACTIVE_GIT_ENV });
  } catch {
    throw new Error('GitHub CLI is not authenticated. Run gh auth login, then install the plugin again.');
  }
}

export function detectEntry(pluginDir: string, explicitEntry?: string): string {
  const root = path.resolve(pluginDir);
  if (explicitEntry) {
    const entryPath = path.resolve(pluginDir, explicitEntry);
    if (entryPath !== root && !entryPath.startsWith(root + path.sep)) {
      throw new Error('Plugin entry must be inside the plugin directory');
    }
    if (fs.existsSync(entryPath) && fs.statSync(entryPath).isDirectory()) {
      return path.relative(root, path.join(entryPath, detectEntry(entryPath)));
    }
    if (path.extname(entryPath) !== '.ts') throw new Error('Plugin entry must be a .ts file');
    if (!fs.existsSync(entryPath) || !fs.statSync(entryPath).isFile()) {
      throw new Error(`Plugin entry file does not exist: ${explicitEntry}`);
    }
    return path.relative(root, entryPath);
  }
  const manifestPlugin = getSingleManifestPlugin(pluginDir);
  if (manifestPlugin) return detectEntry(pluginDir, manifestPlugin.entry);
  for (const candidate of ENTRY_CANDIDATES) {
    const entryPath = path.join(pluginDir, candidate);
    if (fs.existsSync(entryPath) && fs.statSync(entryPath).isFile()) return candidate;
  }
  throw new Error(`Could not find a plugin entry file. Tried: ${ENTRY_CANDIDATES.join(', ')}`);
}

export function parseGithubUrl(specifier: string): ParsedGithubUrl {
  const [urlPart, ref] = specifier.split('#', 2);
  if (!urlPart) throw new Error(`Invalid GitHub URL: ${specifier}`);
  let url: URL;
  try {
    url = new URL(urlPart);
  } catch {
    throw new Error(`Invalid GitHub URL: ${specifier}`);
  }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com') {
    throw new Error('Only https://github.com plugin URLs are supported');
  }
  const [owner, rawRepo, ...rest] = url.pathname.split('/').filter(Boolean);
  if (!owner || !rawRepo || rest.length > 0) {
    throw new Error('GitHub plugin URL must be in the form https://github.com/owner/repo');
  }
  const repo = rawRepo.replace(/\.git$/, '');
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new Error('GitHub owner and repo may only contain letters, numbers, dots, underscores, and dashes');
  }
  return { owner, repo, repoSpec: `${owner}/${repo}`, ...(ref ? { ref } : {}) };
}
