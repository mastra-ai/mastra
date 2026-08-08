import type { Command } from 'commander';
import type { PosthogAnalytics } from '../../analytics/index.js';
import { create } from './create.js';

export const DEFAULT_FACTORY_TEMPLATE = 'https://github.com/mastra-ai/softwarefactory-template';

export interface FactoryInitOptions {
  template: string;
  platform: boolean;
  region?: string;
  org?: string;
}

export function configureFactoryInitCommand(command: Command) {
  return command
    .description('Create a new Mastra Factory project')
    .argument('[project-name]', 'Name of the project directory')
    .option('--template <url>', 'Git repository URL to use as template', DEFAULT_FACTORY_TEMPLATE)
    .option('--no-platform', 'Skip Mastra platform provisioning')
    .option('--region <region>', 'Platform project region (eu or us)')
    .option('--org <id-or-name>', 'Mastra organization ID or name');
}

export async function runFactoryInitCommand(
  projectName: string | undefined,
  options: FactoryInitOptions,
  analytics: PosthogAnalytics,
): Promise<void> {
  await create({
    projectName,
    template: options.template,
    noPlatform: !options.platform,
    region: options.region,
    org: options.org,
    analytics,
  });
}
