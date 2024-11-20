#! /usr/bin/env node
import chalk from 'chalk';
import { Command } from 'commander';
import figlet from 'figlet';

import { build, dev } from './commands/dev.js';
import { generate } from './commands/generate.js';
import { init } from './commands/init.js';
import { migrate } from './commands/migrate.js';
import { up } from './commands/up.js';

const program = new Command();
const version = '0.1.57-alpha.0';

program
  .version(`${version}`)
  .description(`Mastra CLI ${version}`)
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

program
  .command('generate')
  .description('Generate types and drizzle client')
  .action(() => {
    generate(process.env.DB_URL!);
  });

program
  .command('migrate')
  .description('Migrate the Mastra database forward')
  .action(() => {
    void migrate(false, process.env.DB_URL!);
  });

program
  .command('up')
  .description('Runs docker-compose up to start docker containers')
  .action(() => {
    up();
  });

program.parse(process.argv);

const options = program.opts();
