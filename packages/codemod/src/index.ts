#! /usr/bin/env node

import debug from 'debug';
import { Command } from 'commander';
import { transform } from './lib/transform';

const log = debug('codemod');
const error = debug('codemod:error');
debug.enable('codemod:*');

const program = new Command();

program
  .name('codemod')
  .description('CLI for running Mastra codemods')
  .argument('<codemod>', 'Codemod to run')
  .argument('<source>', 'Path to source files or directory')
  .option('-d, --dry', 'Dry run (no changes are made to files)')
  .option('-p, --print', 'Print transformed files to stdout')
  .option('--verbose', 'Show more information about the transform process')
  .option('-j, --jscodeshift <options>', 'Pass options directly to jscodeshift')
  .action((codemod, source, options) => {
    try {
      transform(codemod, source, options);
    } catch (err: any) {
      error(`Error transforming: ${err}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
