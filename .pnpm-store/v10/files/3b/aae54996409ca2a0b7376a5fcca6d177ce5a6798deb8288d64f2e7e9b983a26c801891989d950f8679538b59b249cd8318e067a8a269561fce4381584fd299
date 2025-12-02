#!/usr/bin/env node

import { createReadStream, createWriteStream } from 'fs';
import { parse as parsePath, format, basename } from 'path';
import {  version } from '../package.json';
import { parse } from './index';

interface Args {
  convert?: boolean;
  space?: string | number;
  validate?: boolean;
  outFile?: string;
  version?: boolean;
  help?: boolean;
  file?: string;
  defaults: string[];
}

const args: Args = parseArgs();

if (args.version) {
  console.log(`v${version}`);
} else if (args.help) {
  printUsage();
} else {
  processInput(args);
}

function parseArgs(): Args {
  const args: Args = {
    defaults: [],
  };

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];

    switch (arg) {
      case '--convert':
      case '-c':
        args.convert = true;
        break;

      case '--space':
      case '-s':
        args.space = process.argv[++i];
        break;

      case '--validate':
      case '-v':
        args.validate = true;
        break;

      case '--out-file':
      case '-o':
        args.outFile = process.argv[++i];
        break;

      case '--version':
      case '-V':
        args.version = true;
        break;

      case '--help':
      case '-h':
        args.help = true;
        break;

      default:
        args.file = arg;
        break;
    }
  }

  return args;
}

function processInput(args: Args): void {
  const inputStream = args.file ? createReadStream(args.file) : process.stdin;

  let json11 = '';
  inputStream.on('data', (data: Buffer) => {
    json11 += data.toString();
  });

  inputStream.on('end', () => {
    let space: string | number;
    if (args.space === 't' || args.space === 'tab') {
      space = '\t';
    } else {
      space = Number(args.space);
    }

    try {
      const value = parse(json11);
      if (!args.validate) {
        const json = JSON.stringify(value, null, space);
        const outputStream = getOutputStream(args);
        outputStream.write(json);
      }
    } catch (err: any) {
      console.error(err.message);
      process.exit(1);
    }
  });
}

function getOutputStream(args: Args): NodeJS.WritableStream {
  if (args.convert && args.file && !args.outFile) {
    const parsedFilename = parsePath(args.file);
    const outFilename = format({
      ...parsedFilename,
      base: basename(parsedFilename.base, parsedFilename.ext) + '.json',
    });

    return createWriteStream(outFilename);
  } else if (args.outFile) {
    return createWriteStream(args.outFile);
  } else {
    return process.stdout;
  }
}

function printUsage(): void {
  console.log(`
  Usage: json11 [options] <file>

  If <file> is not provided, then STDIN is used.

  Options:

    -s, --space              The number of spaces to indent or 't' for tabs
    -o, --out-file [file]    Output to the specified file, otherwise STDOUT
    -v, --validate           Validate JSON11 but do not output JSON
    -V, --version            Output the version number
    -h, --help               Output usage information`);
}
