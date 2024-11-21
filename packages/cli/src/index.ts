#! /usr/bin/env node
import chalk from 'chalk';
import { Command } from 'commander';
import figlet from 'figlet';

import { build, dev } from './commands/dev.js';
import { generate } from './commands/generate.js';
import { init } from './commands/init.js';
import { installEngineDeps } from './commands/installEngineDeps.js';
import { migrate } from './commands/migrate.js';
import { provision } from './commands/provision.js';
import { getEnv } from './utils/getEnv.js';
import { setupEnvFile } from './utils/setupEnvFile.js';

const program = new Command();
const version = '0.1.57-alpha.3';

program
  .version(`${version}`)
  .description(`mastra CLI ${version}`)
  .action(() => {
    console.log(chalk.bold(figlet.textSync('Mastra')));
    console.log(`version: ${version}`);
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
    const env = getEnv();
    if (env) {
      void migrate(false, env);
    } else {
      console.error('Please add DB_URL to your .env file');
      console.info(`Run ${chalk.blueBright('Mastra engine up')} to get started with a pg db`);
    }
  });

program.parse(process.argv);
