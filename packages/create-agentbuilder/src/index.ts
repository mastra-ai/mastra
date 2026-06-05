#! /usr/bin/env node
import { Command } from 'commander';

import { PosthogAnalytics, setAnalytics } from 'mastra/dist/analytics/index.js';
import { create } from 'mastra/dist/commands/create/create.js';

import { getPackageVersion, getCreateVersionTag } from './utils.js';

const version = await getPackageVersion();
const createVersionTag = await getCreateVersionTag();

const analytics = new PosthogAnalytics({
  apiKey: 'phc_SBLpZVAB6jmHOct9CABq3PF0Yn5FU3G2FgT4xUr2XrT',
  host: 'https://us.posthog.com',
  version: version!,
});
setAnalytics(analytics);

const program = new Command();

program
  .version(`${version}`, '-v, --version')
  .description(`create-agentbuilder ${version}`)
  .action(async () => {
    try {
      analytics.trackCommand({
        command: 'version',
      });
      console.info(`create-agentbuilder ${version}`);
    } catch {
      // ignore
    }
  });

program
  .name('create-agentbuilder')
  .description('Create a new Mastra project with Agent Builder pre-configured')
  .argument('[project-name]', 'Directory name of the project')
  .option(
    '-p, --project-name <string>',
    'Project name that will be used in package.json and as the project directory name.',
  )
  .option('-k, --llm-api-key <api-key>', 'API key for OpenAI (required for the Builder agent)')
  .option('-t, --timeout [timeout]', 'Configurable timeout for package installation, defaults to 60000 ms')
  .option('--observe', 'Enable Mastra Observability (writes tokens to .env)')
  .option('--no-observe', 'Do not enable Mastra Observability')
  .action(async (projectNameArg, args) =>
    analytics.trackCommandExecution({
      command: 'create-agentbuilder',
      args: {
        projectName: projectNameArg || args.projectName,
        observability: args.observe,
      },
      execution: async () => {
        const projectName = projectNameArg || args.projectName;
        const timeout = args?.timeout ? (args?.timeout === true ? 60000 : parseInt(args?.timeout, 10)) : undefined;

        await create({
          projectName,
          components: ['agents', 'tools'],
          llmProvider: 'openai',
          llmApiKey: args.llmApiKey,
          addExample: false,
          createVersionTag,
          timeout,
          directory: 'src/',
          observability: args.observe,
          agentBuilder: true,
          analytics,
        });
      },
    }),
  );

try {
  await program.parseAsync(process.argv);
} catch (err) {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
} finally {
  await analytics.shutdown(1000);
}
