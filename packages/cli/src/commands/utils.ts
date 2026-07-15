import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { InvalidArgumentError } from 'commander';
import { execa } from 'execa';
import fsExtra from 'fs-extra';
import type { PackageManager } from '../utils/package-manager';
import { selectMatchingDistTag } from './create/command';
import { EDITOR, isValidEditor } from './init/mcp-docs-server-install';
import { areValidComponents, COMPONENTS, isValidLLMProvider, LLMProvider } from './init/utils';

export function getPackageManager(): PackageManager {
  const userAgent = process.env.npm_config_user_agent || '';
  const execPath = process.env.npm_execpath || '';

  // Check user agent first
  if (userAgent.includes('bun')) {
    return 'bun';
  }
  if (userAgent.includes('yarn')) {
    return 'yarn';
  }
  if (userAgent.includes('pnpm')) {
    return 'pnpm';
  }
  if (userAgent.includes('npm')) {
    return 'npm';
  }

  // Fallback to execpath check
  if (execPath.includes('bun')) {
    return 'bun';
  }
  if (execPath.includes('yarn')) {
    return 'yarn';
  }
  if (execPath.includes('pnpm')) {
    return 'pnpm';
  }
  if (execPath.includes('npm')) {
    return 'npm';
  }

  return 'npm'; // Default fallback
}

/**
 * Wrap an async commander action so failures print a clean error message
 * (never a stack trace) and exit non-zero.
 */
export function wrapAction(fn: (...args: any[]) => Promise<void>): (...args: any[]) => void {
  return (...args: any[]) => {
    fn(...args).catch((err: Error) => {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    });
  };
}

export function parseMcp(value: string) {
  if (!isValidEditor(value)) {
    throw new InvalidArgumentError(`Choose a valid value: ${EDITOR.join(', ')}`);
  }
  return value;
}

export function parseSkills(value: string) {
  // Skills flag accepts comma-separated agent names
  return value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

export function parseComponents(value: string) {
  const parsedValue = value.split(',');

  if (!areValidComponents(parsedValue)) {
    throw new InvalidArgumentError(`Choose valid components: ${COMPONENTS.join(', ')}`);
  }

  return parsedValue;
}

export function parseLlmProvider(value: string) {
  if (!isValidLLMProvider(value)) {
    throw new InvalidArgumentError(`Choose a valid provider: ${LLMProvider.join(', ')}`);
  }
  return value;
}

export function shouldSkipDotenvLoading(): boolean {
  return process.env.MASTRA_SKIP_DOTENV === 'true' || process.env.MASTRA_SKIP_DOTENV === '1';
}

/**
 * Get the version tag (e.g., 'beta', 'latest') for the currently running mastra CLI.
 * Create passes its known version to avoid resolving package metadata from an installed layout.
 * Init omits it and preserves the existing best-effort undefined fallback.
 */
export async function getVersionTag(version?: string): Promise<string | undefined> {
  try {
    let currentVersion = version;
    if (!currentVersion) {
      const pkgPath = fileURLToPath(import.meta.resolve('mastra/package.json'));
      const json = await fsExtra.readJSON(pkgPath);
      currentVersion = json.version;
    }
    if (!currentVersion) throw new Error('Missing mastra package version');

    const { stdout } = await execa('npm', ['dist-tag', 'ls', 'mastra'], {
      cwd: import.meta.dirname,
    });
    const tag = selectMatchingDistTag(currentVersion, stdout);
    if (tag) return tag;
  } catch {
    // The caller-specific fallback is handled below.
  }

  if (version) {
    console.error('We could not resolve the mastra version tag, falling back to "latest"');
    return 'latest';
  }

  return undefined;
}

/**
 * Check if the current directory already has git initialized.
 */
export async function isGitInitialized({ cwd }: { cwd: string }): Promise<boolean> {
  try {
    await execa('git', ['rev-parse', '--is-inside-work-tree'], { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Initialize a git repository in the specified directory.
 */
export async function gitInit({ cwd }: { cwd: string }) {
  const isolatedConfigDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-git-config-'));
  const emptyHooksDirectory = path.join(isolatedConfigDirectory, 'hooks');
  const emptyGlobalConfig = path.join(isolatedConfigDirectory, 'global.gitconfig');
  await fs.mkdir(emptyHooksDirectory);
  await fs.writeFile(emptyGlobalConfig, '');
  const env = {
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: emptyGlobalConfig,
    GIT_CONFIG_COUNT: '0',
  };

  try {
    await execa('git', ['init'], { cwd, stdio: 'ignore', env });
    await fs.appendFile(path.join(cwd, '.git', 'info', 'exclude'), '\n.env\n.env.*\n!.env.example\n!.env.*.example\n');
    await execa('git', ['add', '-A'], { cwd, stdio: 'ignore', env });
    await execa(
      'git',
      [
        '-c',
        'user.name=Mastra',
        '-c',
        'user.email=noreply@mastra.ai',
        '-c',
        'commit.gpgSign=false',
        '-c',
        `core.hooksPath=${emptyHooksDirectory}`,
        'commit',
        '--no-verify',
        '-m',
        'Initial commit from Mastra',
      ],
      { cwd, stdio: 'ignore', env },
    );
  } finally {
    await fs.rm(isolatedConfigDirectory, { recursive: true, force: true });
  }
}
