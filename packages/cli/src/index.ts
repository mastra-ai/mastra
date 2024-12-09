#! /usr/bin/env node
import * as p from '@clack/prompts';
import { Command } from 'commander';
import color from 'picocolors';

import { PosthogAnalytics } from './analytics/index.js';
import { createNewAgent } from './commands/agents/create-new-agent.js';
import { listAgents } from './commands/agents/list-agent.js';
import { updateAgentIndexFile } from './commands/agents/update-agent-file.js';
import { cloudflareDeploy, netlifyDeploy, vercelDeploy } from './commands/deploy/index.js';
import { generate } from './commands/generate.js';
import { init } from './commands/init/init.js';
import { checkPkgJsonAndCreateStarter, interactivePrompt } from './commands/init/utils.js';
import { installEngineDeps } from './commands/install-engine-deps.js';
import { migrate } from './commands/migrate.js';
import { provision } from './commands/provision.js';
import { serve } from './commands/serve.js';
import { findApiKeys } from './utils/find-api-keys.js';
import { getEnv } from './utils/get-env.js';
import { getPackageVersion } from './utils/get-package-version.js';
import { logger } from './utils/logger.js';
import { setupEnvFile } from './utils/setup-env-file.js';

const version = await getPackageVersion();

const analytics = new PosthogAnalytics({
  apiKey: 'phc_yfAcSuemwdkkLzl6F6q4uyRGeUkHSHMHq9W2ZaRicZw',
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
      analytics.shutdown();
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
  .command('serve')
  .description('Start mastra server')
  .option('-d, --dir <dir>', 'Path to your mastra folder')
  .option('-e, --env <env>', 'Environment File to use (defaults to .env.development)')
  .action(args => {
    analytics.trackCommand({
      command: 'serve',
    });
    const apiKeys = findApiKeys();
    serve({ port: 4111, env: apiKeys, dir: args?.dir });
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
        await installEngineDeps();
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
        const { dbUrl } = await provision();
        await setupEnvFile({ dbUrl });
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
          logger.log(`Run ${color.blueBright('mastra engine up')} to get started with a pg db`);
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
        logger.break();
        p.intro(color.bgCyan(color.black(' Agent List ')));

        logger.break();
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
  .action(async args => {
    await analytics.trackCommandExecution({
      command: 'deploy vercel',
      args,
      execution: async () => {
        await vercelDeploy({ dir: args?.dir });
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
