#! /usr/bin/env node
import chalk from 'chalk';
import { Command } from 'commander';
import figlet from 'figlet';

import { startServer } from './commands/dev.js';
import { generate } from './commands/generate.js';
import { init } from './commands/init.js';
import { migrate } from './commands/migrate.js';
import { up } from './commands/up.js';
import { getEnv } from './utils/getEnv.js';
import { serve } from './commands/serve.js';

const program = new Command();
const version = '0.1.57-alpha.3';

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
  .command('serve')
  .description('Start mastra server')
  .option('-e, --env <env>', 'Environment File to use (defaults to .env.development)')
  .action(() => {
    serve(4111);
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
    const env = getEnv();
    if (env) {
      void migrate(false, env);
    } else {
      console.error('Please add DB_URL to your .env file');
    }
  });

program
  .command('up')
  .description('Runs docker-compose up to start docker containers')
  .action(() => {
    up();
  });

program.parse(process.argv);

const options = program.opts();
