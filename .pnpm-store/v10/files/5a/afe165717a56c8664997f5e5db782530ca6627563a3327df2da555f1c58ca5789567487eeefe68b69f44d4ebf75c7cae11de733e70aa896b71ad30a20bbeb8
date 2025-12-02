#!/usr/bin/env node
import { createReadStream, createWriteStream } from "fs";
import { parse as parse$1, format, basename } from "path";
import { parse } from "./es/index.mjs";
const version = "2.0.2";
const args = parseArgs();
if (args.version) {
  console.log(`v${version}`);
} else if (args.help) {
  printUsage();
} else {
  processInput(args);
}
function parseArgs() {
  const args2 = {
    defaults: []
  };
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    switch (arg) {
      case "--convert":
      case "-c":
        args2.convert = true;
        break;
      case "--space":
      case "-s":
        args2.space = process.argv[++i];
        break;
      case "--validate":
      case "-v":
        args2.validate = true;
        break;
      case "--out-file":
      case "-o":
        args2.outFile = process.argv[++i];
        break;
      case "--version":
      case "-V":
        args2.version = true;
        break;
      case "--help":
      case "-h":
        args2.help = true;
        break;
      default:
        args2.file = arg;
        break;
    }
  }
  return args2;
}
function processInput(args2) {
  const inputStream = args2.file ? createReadStream(args2.file) : process.stdin;
  let json11 = "";
  inputStream.on("data", (data) => {
    json11 += data.toString();
  });
  inputStream.on("end", () => {
    let space;
    if (args2.space === "t" || args2.space === "tab") {
      space = "	";
    } else {
      space = Number(args2.space);
    }
    try {
      const value = parse(json11);
      if (!args2.validate) {
        const json = JSON.stringify(value, null, space);
        const outputStream = getOutputStream(args2);
        outputStream.write(json);
      }
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  });
}
function getOutputStream(args2) {
  if (args2.convert && args2.file && !args2.outFile) {
    const parsedFilename = parse$1(args2.file);
    const outFilename = format({
      ...parsedFilename,
      base: basename(parsedFilename.base, parsedFilename.ext) + ".json"
    });
    return createWriteStream(outFilename);
  } else if (args2.outFile) {
    return createWriteStream(args2.outFile);
  } else {
    return process.stdout;
  }
}
function printUsage() {
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
