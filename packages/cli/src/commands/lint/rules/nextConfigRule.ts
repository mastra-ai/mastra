import { readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../../../utils/logger.js';
import type { LintContext, LintRule } from './types.js';

function readNextConfig(dir: string) {
  const nextConfigPath = join(dir, 'next.config.js');
  try {
    const nextConfigContent = readFileSync(nextConfigPath, 'utf-8');
    const configMatch = nextConfigContent.match(/const nextConfig = ({[\s\S]*?});/);
    if (!configMatch?.[1]) {
      return null;
    }
    const configStr = configMatch[1].replace(/\n/g, '').replace(/\s+/g, ' ');
    return eval(`(${configStr})`);
  } catch {
    return null;
  }
}

function isNextJsProject(dir: string): boolean {
  const nextConfigPath = join(dir, 'next.config.js');
  try {
    readFileSync(nextConfigPath, 'utf-8');
    return true;
  } catch {
    return false;
  }
}
// TODO: Move to babel
export const nextConfigRule: LintRule = {
  name: 'next-config',
  description: 'Checks if Next.js config is properly configured for Mastra packages',
  async run(context: LintContext): Promise<boolean> {
    if (!isNextJsProject(context.rootDir)) {
      return true;
    }

    const nextConfig = readNextConfig(context.rootDir);
    if (!nextConfig) {
      return false;
    }

    const serverExternals = nextConfig.serverExternalPackages || [];
    const hasMastraExternals = serverExternals.some(
      (pkg: string) => pkg === '@mastra/*' || pkg === '@mastra/core' || pkg.startsWith('@mastra/'),
    );

    if (!hasMastraExternals) {
      logger.error('next.config.js is missing Mastra packages in serverExternalPackages');
      logger.error('Please add the following to your next.config.js:');
      logger.error('  serverExternalPackages: ["@mastra/*"],');
      return false;
    }

    logger.info('Next.js config is properly configured for Mastra packages');
    return true;
  },
};
