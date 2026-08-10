#!/usr/bin/env node
import { Command } from 'commander';
import pkgJson from '../package.json' with { type: 'json' };
import { noopFactoryAnalytics } from './analytics.js';
import { configureFactoryCreateCommand, runFactoryCreateCommand, type FactoryCreateOptions } from './command.js';
import { redactError } from './utils/redact.js';

const program = configureFactoryCreateCommand(new Command().name('create-factory').version(pkgJson.version));

program.action(async (projectName: string | undefined, options: FactoryCreateOptions) => {
  const validRegion = options.region === 'eu' || options.region === 'us' ? options.region : undefined;
  let rawError: unknown;

  try {
    await noopFactoryAnalytics.trackCommandExecution({
      command: 'create-factory',
      args: {
        scaffold_source: options.template ? 'custom_template' : 'built_in',
        no_platform: !options.platform,
        has_org: Boolean(options.org),
        region: validRegion ?? (options.region ? 'invalid' : undefined),
      },
      execution: async () => {
        try {
          await runFactoryCreateCommand(projectName, options, noopFactoryAnalytics);
        } catch (error) {
          rawError = error;
          throw redactError(error, [
            options.template,
            options.org,
            validRegion ? undefined : options.region,
            projectName,
          ]);
        }
      },
    });
  } catch (error) {
    throw rawError ?? error;
  }
});

try {
  await program.parseAsync(process.argv);
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
