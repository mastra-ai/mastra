import { readFileSync } from 'fs';
import { join } from 'path';
import stripJsonComments from 'strip-json-comments';
import { logger } from '../../../utils/logger.js';
import type { LintContext, LintRule } from './types.js';

function readTsConfig(dir: string) {
  const tsConfigPath = join(dir, 'tsconfig.json');
  try {
    const tsConfigContent = readFileSync(tsConfigPath, 'utf-8');
    const cleanTsConfigContent = stripJsonComments(tsConfigContent);
    return JSON.parse(cleanTsConfigContent);
  } catch {
    return null;
  }
}

export const tsConfigRule: LintRule = {
  name: 'ts-config',
  description: 'Checks if TypeScript config is properly configured for Mastra packages',
  async run(context: LintContext): Promise<boolean> {
    const tsConfig = readTsConfig(context.rootDir);
    if (!tsConfig) {
      logger.warn('No tsconfig.json found. This might cause issues with Mastra packages.');
      return true; // Not a critical error, just a warning
    }

    const { module, moduleResolution } = tsConfig.compilerOptions || {};

    // Check if either moduleResolution is 'bundler' or module is 'CommonJS'
    const isValidConfig = moduleResolution === 'bundler' || module === 'CommonJS';
    if (!isValidConfig) {
      logger.error('tsconfig.json has invalid configuration');
      logger.error('Please set either:');
      logger.error('  "compilerOptions": {');
      logger.error('    "moduleResolution": "bundler"');
      logger.error('  }');
      logger.error('or');
      logger.error('  "compilerOptions": {');
      logger.error('    "module": "CommonJS"');
      logger.error('  }');
      logger.error('For the recommended TypeScript configuration, see:');
      logger.error('https://mastra.ai/en/docs/getting-started/installation#initialize-typescript');
      return false;
    }

    logger.info('TypeScript config is properly configured for Mastra packages');
    return true;
  },
};
