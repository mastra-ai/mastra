#! /usr/bin/env node
import { Command } from 'commander';

import { build, dev } from './commands/dev.js';
import { generate } from './commands/generate.js';
import { init } from './commands/init.js';
import { migrate } from './commands/migrate.js';
import { validateNextJsRoot } from './utils.js';

const program = new Command();

program
  .version('0.1.46')
  .description('CLI for Mastra')
  .action(() => {
    validateNextJsRoot();
  });

program
  .command('init')
  .description('Initialize a new Mastra project')
  .action(() => {
    validateNextJsRoot();
    init();
  });

program
  .command('dev')
  .description('Start the development server')
  .option('-i, --integration-dev', 'Run in integration dev mode')
  .option('-e, --env <env>', 'Environment File to use (defaults to .env.development)')
  .action(opts => {
    if (!opts?.integrationDev) {
      validateNextJsRoot();
    }
    dev({ integration: opts?.integrationDev, env: opts?.env });
  });

program
  .command('build')
  .description('Build the admin server')
  .action(opts => {
    if (!opts?.integrationDev) {
      validateNextJsRoot();
    }
    build();
  });

program
  .command('generate')
  .description('Generate types and prisma client')
  .action(() => {
    validateNextJsRoot();
    generate(process.env.DB_URL!);
  });

program
  .command('migrate')
  .description('Migrate the Mastra database forward')
  .action(() => {
    validateNextJsRoot();
    void migrate(false, process.env.DB_URL!);
  });

program.parse(process.argv);

const options = program.opts();
