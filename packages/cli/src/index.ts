#! /usr/bin/env node
import { Command } from 'commander';
import color from 'picocolors';

import { PosthogAnalytics } from './analytics/index';
import { build } from './commands/build/build';
import { create } from './commands/create/create';
import { deploy } from './commands/deploy/index';
import { dev } from './commands/dev/dev';
import { init } from './commands/init/init';
import { checkAndInstallCoreDeps, checkPkgJson, interactivePrompt } from './commands/init/utils';
import { DepsService } from './services/service.deps';
import { logger } from './utils/logger';

const depsService = new DepsService();
const version = await depsService.getPackageVersion();

const analytics = new PosthogAnalytics({
  apiKey: 'phc_SBLpZVAB6jmHOct9CABq3PF0Yn5FU3G2FgT4xUr2XrT',
  host: 'https://us.posthog.com',
  version: version!,
});

const program = new Command();

program
  .version(`${version}`, '-v, --version')
  .description(`Mastra CLI ${version}`)
  .action(() => {
    try {
      analytics.trackCommand({
        command: 'version',
      });
      console.log(`Mastra CLI: ${version}`);
    } catch (e) {}
  });

program
  .command('create')
  .description('Create a new Mastra project')
  .option('--default', 'Quick start with defaults(src, OpenAI, no examples)')
  .option('-c, --components <components>', 'Comma-separated list of components (agents, tools, workflows)')
  .option('-l, --llm <model-provider>', 'Default model provider (openai, anthropic, or groq))')
  .option('-k, --llm-api-key <api-key>', 'API key for the model provider')
  .option('-e, --example', 'Include example code')
  .action(async args => {
    await analytics.trackCommandExecution({
      command: 'create',
      args,
      execution: async () => {
        if (args.default) {
          await create({
            components: ['agents', 'tools', 'workflows'],
            llmProvider: 'openai',
            addExample: false,
          });
          return;
        }
        await create({
          components: args.components ? args.components.split(',') : [],
          llmProvider: args.llm,
          addExample: args.example,
          llmApiKey: args['llm-api-key'],
        });
      },
    });
  });

program
  .command('init')
  .description('Initialize Mastra in your project')
  .option('--default', 'Quick start with defaults(src, OpenAI, no examples)')
  .option('-d, --dir <directory>', 'Directory for Mastra files to (defaults to src/)')
  .option('-c, --components <components>', 'Comma-separated list of components (agents, tools, workflows)')
  .option('-l, --llm <model-provider>', 'Default model provider (openai, anthropic, or groq))')
  .option('-k, --llm-api-key <api-key>', 'API key for the model provider')
  .option('-e, --example', 'Include example code')
  .action(async args => {
    await analytics.trackCommandExecution({
      command: 'init',
      args,
      execution: async () => {
        await checkPkgJson();
        await checkAndInstallCoreDeps();

        if (!Object.keys(args).length) {
          const result = await interactivePrompt();
          await init({
            ...result,
            llmApiKey: result?.llmApiKey as string,
          });
          return;
        }

        if (args?.default) {
          await init({
            directory: 'src/',
            components: ['agents', 'tools', 'workflows'],
            llmProvider: 'openai',
            addExample: false,
          });
          return;
        }

        const componentsArr = args.components ? args.components.split(',') : [];
        await init({
          directory: args.dir,
          components: componentsArr,
          llmProvider: args.llm,
          addExample: args.example,
          llmApiKey: args['llm-api-key'],
        });
        return;
      },
    });
  });

program
  .command('dev')
  .description('Start mastra server')
  .option('-d, --dir <dir>', 'Path to your mastra folder')
  .option('-r, --root <root>', 'Path to your root folder')
  .option('-e, --env <env>', 'Environment File to use (defaults to .env.development)')
  .option('-t, --tools <toolsDirs>', 'Comma-separated list of paths to tool files to include')
  .option('-p, --port <port>', 'Port number for the development server (defaults to 4111)')
  .action(args => {
    analytics.trackCommand({
      command: 'dev',
    });
    dev({
      port: args?.port ? parseInt(args.port) : 4111,
      dir: args?.dir,
      root: args?.root,
    }).catch(err => {
      logger.error(err.message);
    });
  });

program
  .command('build')
  .description('Build your Mastra project')
  .option('-d, --dir <path>', 'Path to directory')
  .action(async args => {
    await analytics.trackCommandExecution({
      command: 'mastra build',
      args,
      execution: async () => {
        await build({ dir: args.dir });
      },
    });
  });

program
  .command('deploy')
  .description('Deploy your Mastra project')
  .option('-d, --dir <path>', 'Path to directory')
  .action(async args => {
    await analytics.trackCommandExecution({
      command: 'mastra deploy',
      args,
      execution: async () => {
        await deploy({ dir: args.dir });
      },
    });
  });

program.parse(process.argv);

export { create } from './commands/create/create';
export { PosthogAnalytics } from './analytics/index';
