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
