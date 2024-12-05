#! /usr/bin/env node
import * as p from '@clack/prompts';
import { Command } from 'commander';
import { retro } from 'gradient-string';
import color from 'picocolors';

import { setTimeout as sleep } from 'timers/promises';

import { createNewAgent } from './commands/agents/createNewAgent.js';
import { listAgents } from './commands/agents/listAgents.js';
import { updateAgentIndexFile } from './commands/agents/updateAgentFile.js';
import { cloudflareDeploy, netlifyDeploy, vercelDeploy } from './commands/deploy/index.js';
import { generate } from './commands/generate.js';
import { init } from './commands/init/init.js';
import { installEngineDeps } from './commands/installEngineDeps.js';
import { migrate } from './commands/migrate.js';
import { provision } from './commands/provision.js';
import { serve } from './commands/serve.js';
import { findApiKeys, getCurrentVersion } from './utils.js';
import { getEnv } from './utils/getEnv.js';
import { logger } from './utils/logger.js';
import { setupEnvFile } from './utils/setupEnvFile.js';

const program = new Command();

const version = await getCurrentVersion();
const mastraText = retro(`
███╗   ███╗ █████╗ ███████╗████████╗██████╗  █████╗ 
████╗ ████║██╔══██╗██╔════╝╚══██╔══╝██╔══██╗██╔══██╗
██╔████╔██║███████║███████╗   ██║   ██████╔╝███████║
██║╚██╔╝██║██╔══██║╚════██║   ██║   ██╔══██╗██╔══██║
██║ ╚═╝ ██║██║  ██║███████║   ██║   ██║  ██║██║  ██║
╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝
`);

program
  .version(`${version}`)
  .description(`Mastra CLI ${version}`)
  .action(() => {
    logger.log(mastraText);
  });

async function interactivePrompt() {
  console.clear();

  p.intro(color.inverse('mastra cli'));

  const mastraProject = await p.group(
    {
      directory: () =>
        p.text({
          message: 'Where should we create the Mastra files? (default: src/)',
          placeholder: 'src/',
          defaultValue: 'src/',
        }),
      components: () =>
        p.multiselect({
          message: 'Choose components to install:',
          options: [
            { value: 'agents', label: 'Agents', hint: 'recommended' },
            {
              value: 'tools',
              label: 'Tools',
            },
            {
              value: 'workflows',
              label: 'Workflows',
            },
          ],
        }),
      llmProvider: () =>
        p.select({
          message: 'Select default provider:',
          options: [
            { value: 'openai', label: 'OpenAI', hint: 'recommended' },
            { value: 'anthropic', label: 'Anthropic' },
            { value: 'groq', label: 'Groq' },
          ],
        }),
      addExample: () =>
        p.confirm({
          message: 'Add example',
          initialValue: false,
        }),
    },
    {
      onCancel: () => {
        p.cancel('Operation cancelled.');
        process.exit(0);
      },
    },
  );

  const s = p.spinner();

  s.start('Initializing Mastra');

  await sleep(500);

  try {
    await init(mastraProject);

    s.stop('Mastra initialized successfully');
    p.note('You are all set!');

    p.outro(`Problems? ${color.underline(color.cyan('https://github.com/mastra-ai/mastra'))}`);
  } catch (err) {
    s.stop('Could not initialize Mastra');
    logger.error(err as string);
  }
}

program
  .command('init')
  .description('Initialize a new Mastra project')
  .option('--default', 'Quick start with defaults(src, OpenAI, no examples)')
  .option('-d, --dir <directory>', 'Directory for Mastra files to (defaults to src/)')
  .option('-c, --components <components>', 'Comma-separated list of components (agents, tools, workflows)')
  .option('-l, --llm <model-provider>', 'Default model provider (openai, anthropic, or groq))')
  .option('-e, --example', 'Include example code')
  .option('-ne, --no-example', 'Skip example code')
  .action(args => {
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
    //TODO: validate args
    const componentsArr = args.components ? args.components.split(',') : [];
    init({
      directory: args.dir,
      components: componentsArr,
      llmProvider: args.llm,
      addExample: args.example,
      showSpinner: true,
    });
    return;
  });

program
  .command('serve')
  .description('Start mastra server')
  .option('-d, --dir <dir>', 'Path to your mastra folder')
  .option('-e, --env <env>', 'Environment File to use (defaults to .env.development)')
  .action((args) => {
    const apiKeys = findApiKeys();
    serve({ port: 4111, env: apiKeys, dir: args?.dir });
  });

const engine = program.command('engine').description('Manage the mastra engine');

engine
  .command('add')
  .description('Add the mastra engine to your application')
  .action(() => {
    installEngineDeps();
  });

engine
  .command('generate')
  .description('Generate types and drizzle client')
  .action(() => {
    generate(process.env.DB_URL!);
  });

engine
  .command('up')
  .description('Runs docker-compose up to start docker containers')
  .action(async () => {
    const { dbUrl } = await provision();
    await setupEnvFile({ dbUrl });
  });

engine
  .command('migrate')
  .description('Migrate the Mastra database forward')
  .action(() => {
    const dbUrl = getEnv();
    if (dbUrl) {
      void migrate(dbUrl);
    } else {
      logger.error('Please add DB_URL to your .env.development file');
      logger.info(`Run ${color.blueBright('Mastra engine up')} to get started with a pg db`);
    }
  });

const agent = program.command('agent').description('Manage Mastra agents');

agent
  .command('new')
  .description('Create a new agent')
  .option('-d, --dir <dir>', 'Path to your mastra folder')
  .action(async (args) => {
    const result = await createNewAgent({ dir: args?.dir });
    if (!result) return;
    await updateAgentIndexFile({ newAgentName: result, dir: args?.dir });
  });

agent
  .command('list')
  .description('List all agents')
  .option('-d, --dir <dir>', 'Path to your mastra folder')
  .action(async (args) => {
    const agents = await listAgents({ dir: args?.dir });
    logger.break();
    p.intro(color.bgCyan(color.black(' Agent List ')));

    logger.break();
    agents.forEach((agent, index) => {
      logger.log(`${index + 1}. ${color.blue(agent)}`);
    });
  });

const deploy = program.command('deploy').description('Deploy your Mastra project');

deploy
  .command('vercel')
  .description('Deploy your Mastra project to Vercel')
  .option('-d, --dir <dir>', 'Path to your mastra folder')
  .action(vercelDeploy);

deploy
  .command('cloudflare')
  .description('Deploy your Mastra project to Cloudflare')
  .option('-d, --dir <dir>', 'Path to your mastra folder')
  .action(cloudflareDeploy);

deploy
  .command('netlify')
  .description('Deploy your Mastra project to Netlify')
  .option('-d, --dir <dir>', 'Path to your mastra folder')
  .action(netlifyDeploy);

program.parse(process.argv);
