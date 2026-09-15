import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PinoLogger } from '@mastra/loggers';
import { copy } from 'fs-extra';

function resolveFactoryUISource(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  return join(dirname(__dirname), 'dist', 'factory');
}

/**
 * Resolve the Factory SPA dir the dev server should serve (via `MASTRACODE_UI_DIST`).
 *
 * Prefers a locally built UI at `<publicDir>/factory` (e.g. `build:ui` output) by
 * returning `undefined` — the server already picks that up as `cwd/factory`.
 * Otherwise falls back to the SPA bundled with the CLI, or `undefined` when no
 * prebuilt UI exists (behavior unchanged: no SPA middleware is mounted).
 */
export function resolveFactoryUIDevDist(
  publicDir: string,
  factoryUISource = resolveFactoryUISource(),
): string | undefined {
  if (existsSync(join(publicDir, 'factory', 'index.html'))) return undefined;
  return existsSync(join(factoryUISource, 'index.html')) ? factoryUISource : undefined;
}

/**
 * Copies the Factory SPA bundled with the CLI into the project's public directory
 * so the bundler's `copyPublic()` can include it in the deployment output.
 */
export async function buildFactoryUI(
  mastraDir: string,
  logger: PinoLogger,
  factoryUISource = resolveFactoryUISource(),
): Promise<void> {
  const sourceIndex = join(factoryUISource, 'index.html');
  if (!existsSync(sourceIndex)) {
    throw new Error(`Prebuilt Factory UI not found: ${sourceIndex}`);
  }

  logger.info('Copying Factory UI...');

  const factoryUIOutput = join(mastraDir, 'public', 'factory');
  await copy(factoryUISource, factoryUIOutput, { overwrite: true });

  const outputIndex = join(factoryUIOutput, 'index.html');
  if (!existsSync(outputIndex)) {
    throw new Error(`Factory UI copy did not produce expected output: ${outputIndex}`);
  }

  logger.info('Factory UI copied successfully');
}
