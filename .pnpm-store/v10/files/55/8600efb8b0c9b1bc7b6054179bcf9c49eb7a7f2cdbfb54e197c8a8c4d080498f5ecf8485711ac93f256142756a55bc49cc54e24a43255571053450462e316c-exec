#!/usr/bin/env node

/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

const Runner = require('../src/Runner.js');

const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');

const { DEFAULT_EXTENSIONS } = require('@babel/core');
const defaultExtensions = DEFAULT_EXTENSIONS.concat(['ts', 'tsx']).map(
  (ext) => (ext.startsWith('.') ? ext.substring(1) : ext)
).sort().join(',');

const parser = require('../src/argsParser')
  .options({
    transform: {
      display_index: 15,
      abbr: 't',
      default: './transform.js',
      help: 'path to the transform file. Can be either a local path or url',
      metavar: 'FILE',
      required: true
    },
    cpus: {
      display_index: 1,
      abbr: 'c',
      help: 'start at most N child processes to process source files',
      defaultHelp: 'max(all - 1, 1)',
      metavar: 'N',
      process: Number,
    },
    verbose: {
      display_index: 16,
      abbr: 'v',
      choices: [0, 1, 2],
      default: 0,
      help: 'show more information about the transform process',
      metavar: 'N',
      process: Number,
    },
    dry: {
      display_index: 2,
      abbr: 'd',
      flag: true,
      default: false,
      help: 'dry run (no changes are made to files)'
    },
    print: {
      display_index: 11,
      abbr: 'p',
      flag: true,
      default: false,
      help: 'print transformed files to stdout, useful for development'
    },
    babel: {
      display_index: 0,
      flag: true,
      default: true,
      help: 'apply babeljs to the transform file'
    },
    extensions: {
      display_index: 3,
      default: defaultExtensions,
      help: 'transform files with these file extensions (comma separated list)',
      metavar: 'EXT',
    },
    ignorePattern: {
      display_index: 7,
      full: 'ignore-pattern',
      list: true,
      help: 'ignore files that match a provided glob expression',
      metavar: 'GLOB',
    },
    ignoreConfig: {
      display_index: 6,
      full: 'ignore-config',
      list: true,
      help: 'ignore files if they match patterns sourced from a configuration file (e.g. a .gitignore)',
      metavar: 'FILE'
    },
    gitignore: {
      display_index: 8,
      flag: true,
      default: false,
      help: 'adds entries the current directory\'s .gitignore file',
    },
    runInBand: {
      display_index: 12,
      flag: true,
      default: false,
      full: 'run-in-band',
      help: 'run serially in the current process'
    },
    silent: {
      display_index: 13,
      abbr: 's',
      flag: true,
      default: false,
      help: 'do not write to stdout or stderr'
    },
    parser: {
      display_index: 9,
      choices: ['babel', 'babylon', 'flow', 'ts', 'tsx'],
      default: 'babel',
      help: 'the parser to use for parsing the source files'
    },
    parserConfig: {
      display_index: 10,
      full: 'parser-config',
      help: 'path to a JSON file containing a custom parser configuration for flow or babylon',
      metavar: 'FILE',
      process: file => JSON.parse(fs.readFileSync(file)),
    },
    failOnError: {
      display_index: 4,
      flag: true,
      help: 'Return a non-zero code when there are errors',
      full: 'fail-on-error',
      default: false,
    },
    version: {
      display_index: 17,
      help: 'print version and exit',
      callback: function() {
        const requirePackage = require('../utils/requirePackage');
        return [
          `jscodeshift: ${pkg.version}`,
          ` - babel: ${require('@babel/core').version}`,
          ` - babylon: ${requirePackage('@babel/parser').version}`,
          ` - flow: ${requirePackage('flow-parser').version}`,
          ` - recast: ${requirePackage('recast').version}\n`,
        ].join('\n');
      },
    },
    stdin: {
      display_index: 14,
      help: 'read file/directory list from stdin',
      flag: true,
      default: false,
    },
  });

let options, positionalArguments;
try {
  ({options, positionalArguments} = parser.parse());
  if (positionalArguments.length === 0 && !options.stdin) {
    process.stderr.write(
      'Error: You have to provide at least one file/directory to transform.' +
      '\n\n---\n\n' +
      parser.getHelpText()
    );
    process.exit(1);
  }
} catch(e) {
  const exitCode = e.exitCode === undefined ? 1 : e.exitCode;
  (exitCode ? process.stderr : process.stdout).write(e.message);
  process.exit(exitCode);
}
function run(paths, options) {
  Runner.run(
    /^https?/.test(options.transform) ? options.transform : path.resolve(options.transform),
    paths,
    options
  );
}

if (options.stdin) {
  let buffer = '';
  process.stdin.on('data', data => buffer += data);
  process.stdin.on('end', () => run(buffer.split('\n'), options));
} else {
  run(positionalArguments, options);
}
