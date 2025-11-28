import { InvalidArgumentError } from 'commander';
import { execa } from 'execa';
import type { PackageManager } from '../utils/package-manager';
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

export function parseMcp(value: string) {
  if (!isValidEditor(value)) {
    throw new InvalidArgumentError(`Choose a valid value: ${EDITOR.join(', ')}`);
  }
  return value;
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
 * Initialize a git repository in the specified directory.
 */
export async function gitInit({ cwd }: { cwd: string }) {
  await execa('git', ['init'], { cwd, stdio: 'ignore' });
  await execa('git', ['add', '-A'], { cwd, stdio: 'ignore' });
  await execa(
    'git',
    [
      'commit',
      '-m',
      '"Initial commit from Mastra"',
      '--author="dane-ai-mastra[bot] <dane-ai-mastra[bot]@users.noreply.github.com>"',
    ],
    { cwd, stdio: 'ignore' },
  );
}
