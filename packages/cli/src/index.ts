#! /usr/bin/env node
import * as p from '@clack/prompts';
import chalk from 'chalk';
import { Command } from 'commander';
import { retro } from 'gradient-string';
import color from 'picocolors';

import { setTimeout as sleep } from 'timers/promises';

import { createNewAgent } from './commands/agents/createNewAgent.js';
import { listAgents } from './commands/agents/listAgents.js';
import { updateAgentIndexFile } from './commands/agents/updateAgentFile.js';
import { generate } from './commands/generate.js';
// import { init } from './commands/init.js';
import { installEngineDeps } from './commands/installEngineDeps.js';
import { migrate } from './commands/migrate.js';
import { provision } from './commands/provision.js';
import { serve } from './commands/serve.js';
import { getCurrentVersion } from './utils.js';
import { getEnv } from './utils/getEnv.js';
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
  .description(`mastra CLI ${version}`)
  .action(() => {
    console.log(mastraText);
  });

async function init() {
  console.clear();

  p.intro(color.inverse('mastra cli'));

  const mastraProject = await p.group(
    {
      directory: () =>
        p.text({
          message: 'Where should we create the Mastra files? (default: ./src)',
          placeholder: './src',
          defaultValue: './src',
          validate: value => {
            if (value[0] !== '.') return 'Please enter a relative path';
            return '';
          },
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
            { value: 'open-ai', label: 'OpenAI', hint: 'recommended' },
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

  s.start('Initializing Mastra...');

  await sleep(2000);

  s.stop('Mastra initialized successfully');

  p.note('You are all set!');

  p.outro(`Problems? ${color.underline(color.cyan('https://github.com/mastra-ai/mastra'))}`);

  await sleep(1000);

  mastraProject;
}

program
  .command('init')
  .description('Initialize a new Mastra project')
  .option('--default', 'Quick start with defaults(src, OpenAI, no examples)')
  .option('-d, --dir <directory>', 'Directory to add mastra related files to, defaults to src/mastra')
  .option('-c, --components <components>', 'Mastra components to setup')
  .option('-l, --llm <model-provider>', 'Default model provider to use, defaults to OpenAI')
  .option('-e, --example', 'Add example code')
  .option('-ne, --no-example')
  .action(args => {
    if (!Object.keys(args).length) return init();
    return console.log({ args });
  });

program
  .command('serve')
  .description('Start mastra server')
  .option('-e, --env <env>', 'Environment File to use (defaults to .env.development)')
  .action(() => {
    serve(4111);
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
      console.error('Please add DB_URL to your .env.development file');
      console.info(`Run ${chalk.blueBright('Mastra engine up')} to get started with a pg db`);
    }
  });

const agent = program.command('agent').description('Manage the mastra agent');

agent
  .command('new')
  .description('Create a new agent')
  .action(async () => {
    const result = await createNewAgent();
    if (!result) return;
    await updateAgentIndexFile(result);
  });

agent
  .command('list')
  .description('List all agents')
  .action(async () => {
    const agents = await listAgents();
    console.log('Agents:');
    agents.forEach((agent, index) => {
      console.log(`${index + 1}. ${chalk.blueBright(agent)}`);
    });
  });

program.parse(process.argv);
