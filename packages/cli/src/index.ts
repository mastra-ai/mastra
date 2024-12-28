#! /usr/bin/env node
import * as p from '@clack/prompts';
import { Command } from 'commander';
import color from 'picocolors';

import { PosthogAnalytics } from './analytics/index.js';
import { createNewAgent } from './commands/agents/create-new-agent.js';
import { listAgents } from './commands/agents/list-agent.js';
import { updateAgentIndexFile } from './commands/agents/update-agent-file.js';
import { cloudflareDeploy, netlifyDeploy, vercelDeploy } from './commands/deploy/index.js';
import { dev } from './commands/dev.js';
import { add } from './commands/engine/add.js';
import { down } from './commands/engine/down.js';
import { generate } from './commands/engine/generate.js';
import { migrate } from './commands/engine/migrate.js';
import { up } from './commands/engine/up.js';
import { init } from './commands/init/init.js';
import { checkAndInstallCoreDeps, checkPkgJsonAndCreateStarter, interactivePrompt } from './commands/init/utils.js';
import { DepsService } from './services/service.deps.js';
import { findApiKeys } from './utils/find-api-keys.js';
import { getEnv } from './utils/get-env.js';
import { logger } from './utils/logger.js';

const depsService = new DepsService();
const version = await depsService.getPackageVersion();
const projectName = 'mastra-starter';

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
  .command('init')
  .description('Initialize a new Mastra project')
  .option('--default', 'Quick start with defaults(src, OpenAI, no examples)')
  .option('-d, --dir <directory>', 'Directory for Mastra files to (defaults to src/)')
  .option('-c, --components <components>', 'Comma-separated list of components (agents, tools, workflows)')
  .option('-l, --llm <model-provider>', 'Default model provider (openai, anthropic, or groq))')
  .option('-e, --example', 'Include example code')
  .option('-ne, --no-example', 'Skip example code')
  .action(async args => {
    await analytics.trackCommandExecution({
      command: 'init',
      args,
      execution: async () => {
        await checkPkgJsonAndCreateStarter();
        await checkAndInstallCoreDeps();

        if (!Object.keys(args).length) return interactivePrompt();

        if (args?.default) {
          init({
            directory: 'src/',
            components: ['agents', 'tools', 'workflows'],
            llmProvider: 'openai',
            addExample: false,
            showSpinner: true,
          });
          return;
        }

        const componentsArr = args.components ? args.components.split(',') : [];
        init({
          directory: args.dir,
          components: componentsArr,
          llmProvider: args.llm,
          addExample: args.example,
          showSpinner: true,
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
  .action(async () => {
    await analytics.trackCommandExecution({
      command: 'engine up',
      args: {},
      execution: async () => {
        await up();
      },
    });
  });

engine
  .command('down')
  .description('Runs docker-compose down to shut down docker containers')
  .action(async () => {
    await analytics.trackCommandExecution({
      command: 'engine down',
      args: {},
      execution: async () => {
        await down();
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

const agent = program.command('agent').description('Manage Mastra agents');

agent
  .command('new')
  .description('Create a new agent')
  .option('-d, --dir <dir>', 'Path to your mastra folder')
  .action(async args => {
    await analytics.trackCommandExecution({
      command: 'agent new',
      args: {},
      execution: async () => {
        const result = await createNewAgent({ dir: args?.dir });
        if (!result) return;
        await updateAgentIndexFile({ newAgentName: result, dir: args?.dir });
      },
    });
  });

agent
  .command('list')
  .description('List all agents')
  .option('-d, --dir <dir>', 'Path to your mastra folder')
  .action(async args => {
    await analytics.trackCommandExecution({
      command: 'agent list',
      args,
      execution: async () => {
        const agents = await listAgents({ dir: args?.dir });

        if (!agents.length) {
          p.note('No Agents...');
          return;
        }

        p.intro(color.bgCyan(color.black(' Agents List ')));

        agents.forEach((agent, index) => {
          logger.log(`${index + 1}. ${color.blue(agent)}`);
        });
      },
    });
  });

const deploy = program.command('deploy').description('Deploy your Mastra project');

deploy
  .command('vercel')
  .description('Deploy your Mastra project to Vercel')
  .option('-d, --dir <dir>', 'Path to your mastra folder')
  .option('-n, --name <name>', 'Name of the project')
  .action(async args => {
    await analytics.trackCommandExecution({
      command: 'deploy vercel',
      args,
      execution: async () => {
        await vercelDeploy({ dir: args?.dir, projectName: args?.name || projectName });
      },
    });
  });

deploy
  .command('cloudflare')
  .description('Deploy your Mastra project to Cloudflare')
  .option('-d, --dir <dir>', 'Path to your mastra folder')
  .action(async args => {
    await analytics.trackCommandExecution({
      command: 'deploy cloudflare',
      args,
      execution: async () => {
        await cloudflareDeploy({ dir: args?.dir });
      },
    });
  });

deploy
  .command('netlify')
  .description('Deploy your Mastra project to Netlify')
  .option('-d, --dir <dir>', 'Path to your mastra folder')
  .action(async args => {
    await analytics.trackCommandExecution({
      command: 'deploy netlify',
      args,
      execution: async () => {
        await netlifyDeploy({ dir: args?.dir });
      },
    });
  });

program.parse(process.argv);
