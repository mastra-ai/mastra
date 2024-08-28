import { Command } from 'commander';

import { dev } from './commands/dev.js';
import { generate } from './commands/generate.js';
import { init } from './commands/init.js';
import { migrate } from './commands/migrate.js';
import { validateNextJsRoot } from './utils.js';

//add the following line
const program = new Command();

program
  .version('1.0.0')
  .description('An example CLI for managing a directory')
  .option('-l, --ls  [value]', 'List directory contents')
  .option('-m, --mkdir <value>', 'Create a directory')
  .option('-t, --touch <value>', 'Create a file')
  .action(() => {
    validateNextJsRoot();
  });

program
  .command('init')
  .description('Initialize a new project')
  .action(() => {
    validateNextJsRoot();
    init()
  });

program
  .command('dev')
  .description('Start the development server')
  .option('-i, --integration-dev', 'Run in integration dev mode')
  .action((opts) => {
    if (!opts?.integrationDev) {
      validateNextJsRoot();
    }
    dev({ integration: opts?.integrationDev })
  });

program
  .command('generate')
  .description('Generate types')
  .action(() => {
    validateNextJsRoot();
    generate()
  });

program
  .command('migrate')
  .description('Migrate the arkw database forward')
  .action(() => {
    validateNextJsRoot();
    void migrate(false, process.env.DB_URL!);
  });

program.parse(process.argv);

const options = program.opts();
