import { logger } from '../../../utils/logger.js';
import type { LintContext, LintRule } from './types.js';

export const mastraDepsCompatibilityRule: LintRule = {
  name: 'mastra-deps-compatibility',
  description: 'Checks if Mastra package versions are compatible',
  async run(context: LintContext): Promise<boolean> {
    if (context.mastraPackages.length === 0) {
      logger.warn('No Mastra packages found in package.json');
      return true;
    }

    const hasAlpha = context.mastraPackages.some(pkg => pkg.isAlpha);
    const hasNonAlpha = context.mastraPackages.some(pkg => !pkg.isAlpha);

    if (hasAlpha && hasNonAlpha) {
      logger.error('Inconsistent Mastra package versions found:');
      context.mastraPackages.forEach(({ name, version }) => {
        logger.error(`  ${name}: ${version}`);
      });
      logger.error('All Mastra packages should be either alpha or non-alpha versions');
      return false;
    }

    logger.info('All Mastra package versions are consistent!');
    return true;
  },
};
