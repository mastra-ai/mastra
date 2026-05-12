import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import stripJsonComments from 'strip-json-comments';
import type { LintContext, LintIssue, LintRule } from './types.js';

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
  async run(context: LintContext): Promise<LintIssue[]> {
    const tsConfig = readTsConfig(context.rootDir);
    if (!tsConfig) {
      return [
        {
          code: 'MISSING_TSCONFIG',
          severity: 'warning',
          scope: 'project',
          message: 'No tsconfig.json found. Mastra projects should include a TypeScript config.',
          fix: 'Add a tsconfig.json file. See https://mastra.ai/en/docs/getting-started/installation#initialize-typescript',
        },
      ];
    }

    const { module, moduleResolution } = tsConfig.compilerOptions || {};

    const isValidConfig = moduleResolution === 'bundler' || module === 'CommonJS';
    if (!isValidConfig) {
      return [
        {
          code: 'INVALID_TSCONFIG',
          severity: 'error',
          scope: 'project',
          message:
            'tsconfig.json must set either compilerOptions.moduleResolution to "bundler" or compilerOptions.module to "CommonJS".',
          fix: 'Update tsconfig.json with either { "compilerOptions": { "moduleResolution": "bundler" } } or { "compilerOptions": { "module": "CommonJS" } }. See https://mastra.ai/en/docs/getting-started/installation#initialize-typescript',
        },
      ];
    }

    return [];
  },
};
