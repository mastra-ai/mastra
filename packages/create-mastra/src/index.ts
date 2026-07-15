#! /usr/bin/env node
import { Command } from 'commander';

import { PosthogAnalytics, setAnalytics } from 'mastra/dist/analytics/index.js';
import {
  configureCreateCommand,
  isCreateCancelledError,
  runCreateCommand,
} from 'mastra/dist/commands/create/create.js';
import type { CreateCommandOptions } from 'mastra/dist/commands/create/create.js';

import { getPackageVersion, getCreateVersionTag } from './utils.js';

const version = await getPackageVersion();
const analytics = new PosthogAnalytics({
  apiKey: 'phc_SBLpZVAB6jmHOct9CABq3PF0Yn5FU3G2FgT4xUr2XrT',
  host: 'https://us.posthog.com',
  version,
});
setAnalytics(analytics);

const program = configureCreateCommand(new Command().name('create-mastra').version(`${version}`, '-v, --version'));

program.action(async (projectName: string | undefined, args: CreateCommandOptions) => {
  try {
    await analytics.trackCommandExecution({
      command: 'create',
      args: {
        projectName,
        yes: args.yes ?? false,
        empty: args.empty ?? false,
        llmProvider: args.llm,
        skills: args.skills,
        git: args.git,
        template: args.template,
        timeout: args.timeout,
      },
      execution: () =>
        runCreateCommand(projectName, args, {
          analytics,
          resolveVersionTag: () => getCreateVersionTag(version),
        }),
    });
  } catch (error) {
    if (isCreateCancelledError(error)) return;
    throw error;
  }
});

try {
  await program.parseAsync(process.argv);
} catch (err) {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
} finally {
  await analytics.shutdown(1000);
}
