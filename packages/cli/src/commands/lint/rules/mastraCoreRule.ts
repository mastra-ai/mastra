import type { LintContext, LintIssue, LintRule } from './types.js';

export const mastraCoreRule: LintRule = {
  name: 'mastra-core',
  description: 'Checks if @mastra/core is installed',
  async run(context: LintContext): Promise<LintIssue[]> {
    const hasCore = context.mastraPackages.some(pkg => pkg.name === '@mastra/core');
    if (!hasCore) {
      return [
        {
          code: 'MISSING_MASTRA_CORE',
          severity: 'error',
          scope: 'project',
          message: '@mastra/core is not installed. This package is required for Mastra to work properly.',
          fix: 'Install @mastra/core: pnpm add @mastra/core',
        },
      ];
    }

    return [];
  },
};
