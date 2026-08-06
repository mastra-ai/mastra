#!/usr/bin/env node
import { Command } from 'commander';
import {
  configureFactoryInitCommand,
  runFactoryInitCommand,
  type FactoryInitOptions,
} from 'mastra/commands/factory';
import { PosthogAnalytics } from 'mastra/dist/analytics/index.js';
import pkgJson from '../package.json' with { type: 'json' };
import { redactError } from './utils/redact.js';

const analytics = new PosthogAnalytics({
  apiKey: 'phc_SBLpZVAB6jmHOct9CABq3PF0Yn5FU3G2FgT4xUr2XrT',
  host: 'https://us.posthog.com',
  version: pkgJson.version,
});

const program = configureFactoryInitCommand(new Command().name('create-factory').version(pkgJson.version));

program.action(async (projectName: string | undefined, options: FactoryInitOptions) => {
  const validRegion = options.region === 'eu' || options.region === 'us' ? options.region : undefined;
  let rawError: unknown;

  try {
    await analytics.trackCommandExecution({
      command: 'create-factory',
      args: {
        default_template: options.template === 'https://github.com/mastra-ai/softwarefactory-template',
        no_platform: !options.platform,
        has_org: Boolean(options.org),
        region: validRegion ?? (options.region ? 'invalid' : undefined),
      },
      execution: async () => {
        try {
          await runFactoryInitCommand(projectName, options, analytics);
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
} finally {
  await analytics.shutdown(1000);
}
