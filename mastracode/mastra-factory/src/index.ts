#!/usr/bin/env node
import { Command } from 'commander';
import { PosthogAnalytics, setAnalytics } from 'mastra/dist/analytics/index.js';
import {
  configureFactoryCreateCommand,
  getFactoryCreateCommandAnalyticsArgs,
  runFactoryCreateCommand,
} from 'mastra/dist/commands/factory/command.js';
import type { FactoryCreateOptions } from 'mastra/dist/commands/factory/command.js';

import pkgJson from '../package.json' with { type: 'json' };

const analytics = new PosthogAnalytics({
  apiKey: 'phc_SBLpZVAB6jmHOct9CABq3PF0Yn5FU3G2FgT4xUr2XrT',
  host: 'https://us.posthog.com',
  version: pkgJson.version,
});
setAnalytics(analytics);

const program = configureFactoryCreateCommand(new Command().name('create-factory').version(pkgJson.version));

program.action(async (projectName: string | undefined, options: FactoryCreateOptions) => {
  await analytics.trackCommandExecution({
    command: 'create-factory',
    args: getFactoryCreateCommandAnalyticsArgs(options),
    execution: () => runFactoryCreateCommand(projectName, options, analytics),
  });
});

try {
  await program.parseAsync(process.argv);
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await analytics.shutdown(1000);
}
