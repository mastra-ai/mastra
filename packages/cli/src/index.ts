#! /usr/bin/env node
import { Command } from 'commander';
import color from 'picocolors';

import { PosthogAnalytics } from './analytics/index.js';
import { build } from './commands/build.js';
import { create } from './commands/create/create.js';
import { deploy } from './commands/deploy/index.js';
import { dev } from './commands/dev.js';
import { add } from './commands/engine/add.js';
import { down } from './commands/engine/down.js';
import { generate } from './commands/engine/generate.js';
import { migrate } from './commands/engine/migrate.js';
import { up } from './commands/engine/up.js';
import { init } from './commands/init/init.js';
import { checkAndInstallCoreDeps, checkPkgJson, interactivePrompt } from './commands/init/utils.js';
import { DepsService } from './services/service.deps.js';
import { findApiKeys } from './utils/find-api-keys.js';
import { getEnv } from './utils/get-env.js';
import { logger } from './utils/logger.js';

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
        }
        await create({
          components: args.components,
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
          init({
            directory: 'src/',
            components: ['agents', 'tools', 'workflows'],
            llmProvider: 'openai',
            addExample: false,
          });
          return;
        }

        const componentsArr = args.components ? args.components.split(',') : [];
        init({
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
  .option('-e, --env <env>', 'Environment File to use (defaults to .env.development)')
  .option('-t, --tools <toolsDirs>', 'Comma-separated list of paths to tool files to include')
  .option('-p, --port <port>', 'Port number for the development server (defaults to 4111)')
  .action(args => {
    analytics.trackCommand({
      command: 'dev',
    });
    const apiKeys = findApiKeys();
    dev({ port: args?.port ? parseInt(args.port) : 4111, env: apiKeys, dir: args?.dir, toolsDirs: args?.tools });
  });

const engine = program.command('engine').description('Manage the mastra engine');

engine
  .command('add')
  .description('Add the mastra engine to your application')
  .action(async () => {
    await analytics.trackCommandExecution({
      command: 'engine add',
      args: {},
      execution: async () => {
        await add();
      },
    });
  });

engine
  .command('generate')
  .description('Generate types and drizzle client')
  .action(async () => {
    await analytics.trackCommandExecution({
      command: 'engine generate',
      args: {},
      execution: async () => {
        await generate(process.env.DB_URL!);
      },
    });
  });

engine
  .command('up')
  .description('Runs docker-compose up to start docker containers')
  .option('-f, --file <path>', 'Path to docker-compose file')
  .action(async args => {
    await analytics.trackCommandExecution({
      command: 'engine up',
      args,
      execution: async () => {
        await up(args.file);
      },
    });
  });

engine
  .command('down')
  .description('Runs docker-compose down to shut down docker containers')
  .option('-f, --file <path>', 'Path to docker-compose file')
  .action(async args => {
    await analytics.trackCommandExecution({
      command: 'engine down',
      args: {},
      execution: async () => {
        await down(args.file);
      },
    });
  });

engine
  .command('migrate')
  .description('Migrate the Mastra database forward')
  .action(async () => {
    await analytics.trackCommandExecution({
      command: 'engine migrate',
      args: {},
      execution: async () => {
        const dbUrl = getEnv();
        if (dbUrl) {
          await migrate(dbUrl);
        } else {
          logger.log('Please add DB_URL to your .env.development file');
          logger.log(
            `Run ${color.blueBright('mastra engine add')} to get started with a Postgres DB in a docker container`,
          );
        }
      },
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
        await deploy({ dir: args.dir, token: args.token });
      },
    });
  });

program.parse(process.argv);

export { create } from './commands/create/create.js';
export { PosthogAnalytics } from './analytics/index.js';
