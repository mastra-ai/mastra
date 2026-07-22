import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { PinoLogger } from '@mastra/loggers';
import { execa } from 'execa';
import type { PackageManager } from '../../utils/package-manager';

const LOCKFILE_MAP: [string, PackageManager][] = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['package-lock.json', 'npm'],
  ['yarn.lock', 'yarn'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
];

export function detectPackageManagerFromRoot(rootDir: string): PackageManager {
  for (const [file, pm] of LOCKFILE_MAP) {
    if (existsSync(join(rootDir, file))) return pm;
  }
  return 'npm';
}

/**
 * Runs the project's standardized `build:ui` script to produce the Factory SPA
 * at `src/mastra/public/factory/`. Called before `prepare()` clears `.mastra`
 * so the bundler's `copyPublic()` can pick up the built assets.
 */
export async function buildFactoryUI(rootDir: string, mastraDir: string, logger: PinoLogger): Promise<void> {
  const pm = detectPackageManagerFromRoot(rootDir);
  logger.info('Building Factory UI...');

  try {
    await execa(pm, ['run', 'build:ui'], {
      cwd: rootDir,
      stdio: 'inherit',
    });
  } catch {
    throw new Error(`Factory UI build failed — run \`${pm} run build:ui\` manually to see the full output`);
  }

  const expectedOutput = join(mastraDir, 'public', 'factory', 'index.html');
  if (!existsSync(expectedOutput)) {
    throw new Error(`Factory UI build did not produce expected output: ${expectedOutput}`);
  }

  logger.info('Factory UI built successfully');
}
