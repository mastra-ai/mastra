import type { Command } from 'commander';
import type { FactoryAnalytics } from './analytics.js';
import { create } from './create.js';

export interface FactoryCreateOptions {
  template?: string;
  platform: boolean;
  region?: string;
  org?: string;
}

export function configureFactoryCreateCommand(command: Command) {
  return command
    .description('Create a new Mastra Factory project')
    .argument('[project-name]', 'Name of the project directory')
    .option('--template <url>', 'Git repository URL to use as a custom template')
    .option('--no-platform', 'Skip Mastra platform provisioning')
    .option('--region <region>', 'Platform project region (eu or us)')
    .option('--org <id-or-name>', 'Mastra organization ID or name');
}

export function getFactoryCreateCommandAnalyticsArgs(options: FactoryCreateOptions): Record<string, unknown> {
  const validRegion = options.region === 'eu' || options.region === 'us' ? options.region : undefined;
  return {
    scaffold_source: options.template ? 'custom_template' : 'built_in',
    no_platform: !options.platform,
    has_org: Boolean(options.org),
    region: validRegion ?? (options.region ? 'invalid' : undefined),
  };
}

export async function runFactoryCreateCommand(
  projectName: string | undefined,
  options: FactoryCreateOptions,
  analytics: FactoryAnalytics,
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
