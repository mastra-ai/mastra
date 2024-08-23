import { Command } from 'commander';

import { dev } from './commands/dev.js';
import { generate } from './commands/generate.js';
import { init } from './commands/init.js';

//add the following line
const program = new Command();

program
  .version('1.0.0')
  .description('An example CLI for managing a directory')
  .option('-l, --ls  [value]', 'List directory contents')
  .option('-m, --mkdir <value>', 'Create a directory')
  .option('-t, --touch <value>', 'Create a file');

program
  .command('init')
  .description('Initialize a new project')
  .action(() => init());

program
  .command('dev')
  .description('Start the development server')
  .action(() => dev());

program
  .command('generate')
  .description('Generate types')
  .action(() => generate());

program.parse(process.argv);

const options = program.opts();
