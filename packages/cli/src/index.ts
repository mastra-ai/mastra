#! /usr/bin/env node
import chalk from 'chalk';
import { Command } from 'commander';
import figlet from 'figlet';

import { createNewAgent } from './commands/agents/createNewAgent.js';
import { listAgents } from './commands/agents/listAgents.js';
import { updateAgentIndexFile } from './commands/agents/updateAgentFile.js';
import { build, dev } from './commands/dev.js';
import { generate } from './commands/generate.js';
import { init } from './commands/init.js';
import { installEngineDeps } from './commands/installEngineDeps.js';
import { migrate } from './commands/migrate.js';
import { provision } from './commands/provision.js';
import { getEnv } from './utils/getEnv.js';
import { setupEnvFile } from './utils/setupEnvFile.js';

const program = new Command();
const version = '0.1.57-alpha.4';

program
  .version(`${version}`)
  .description(`mastra CLI ${version}`)
  .action(() => {
    console.log(chalk.bold(figlet.textSync('Mastra')));
  });

program
  .command('init')
  .description('Initialize a new Mastra project')
  .action(() => {
    init();
  });

program
  .command('dev')
  .description('Start the development server')
  .option('-i, --integration-dev', 'Run in integration dev mode')
  .option('-e, --env <env>', 'Environment File to use (defaults to .env.development)')
  .action(opts => {
    dev({ integration: opts?.integrationDev, env: opts?.env });
  });

program
  .command('build')
  .description('Build the admin server')
  .action(opts => {
    build();
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
      void migrate(false, dbUrl);
    } else {
      console.error('Please add DB_URL to your .env file');
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
