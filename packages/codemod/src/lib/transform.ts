import child_process from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import util from 'node:util';
import debug from 'debug';

const exec = util.promisify(child_process.exec);

interface TransformOptions {
  dry?: boolean;
  print?: boolean;
  verbose?: boolean;
  jscodeshift?: string;
}

const log = debug('codemod:transform');
const error = debug('codemod:transform:error');
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getJscodeshift(): string {
  const localJscodeshift = path.resolve(__dirname, '../node_modules/.bin/jscodeshift');
  return fs.existsSync(localJscodeshift) ? localJscodeshift : 'jscodeshift';
}

function buildCommand(codemodPath: string, targetPath: string, jscodeshift: string, options: TransformOptions): string {
  // Ignoring everything under `.*/` covers `.mastra/` along with any other
  // framework build related or otherwise intended-to-be-hidden directories.
  let command = `${jscodeshift} -t ${codemodPath} ${targetPath} \
    --parser tsx \
    --ignore-pattern="**/node_modules/**" \
    --ignore-pattern="**/.*/**" \
    --ignore-pattern="**/dist/**" \
    --ignore-pattern="**/build/**" \
    --ignore-pattern="**/*.min.js" \
    --ignore-pattern="**/*.bundle.js"`;

  if (options.dry) {
    command += ' --dry';
  }

  if (options.print) {
    command += ' --print';
  }

  if (options.verbose) {
    command += ' --verbose';
  }

  if (options.jscodeshift) {
    command += ` ${options.jscodeshift}`;
  }

  return command;
}

export type TransformErrors = {
  transform: string;
  filename: string;
  summary: string;
}[];

function parseErrors(transform: string, output: string): TransformErrors {
  const errors: TransformErrors = [];
  const errorRegex = /ERR (.+) Transformation error/g;
  const syntaxErrorRegex = /SyntaxError: .+/g;

  let match;
  while ((match = errorRegex.exec(output)) !== null) {
    const filename = match[1]!;
    const syntaxErrorMatch = syntaxErrorRegex.exec(output);
    if (syntaxErrorMatch) {
      const summary = syntaxErrorMatch[0];
      errors.push({ transform, filename, summary });
    }
  }

  return errors;
}

function parseNotImplementedErrors(transform: string, output: string): TransformErrors {
  const notImplementedErrors: TransformErrors = [];
  const notImplementedRegex = /Not Implemented (.+): (.+)/g;

  let match;
  while ((match = notImplementedRegex.exec(output)) !== null) {
    const filename = match[1]!;
    const summary = match[2]!;
    notImplementedErrors.push({ transform, filename, summary });
  }

  return notImplementedErrors;
}

export async function transform(
  codemod: string,
  source: string,
  transformOptions: TransformOptions,
  options: { logStatus: boolean } = { logStatus: true },
): Promise<{ errors: TransformErrors; notImplementedErrors: TransformErrors }> {
  if (options.logStatus) {
    log(`Applying codemod '${codemod}': ${source}`);
  }
  const codemodPath = path.resolve(__dirname, `./codemods/${codemod}.js`);
  const targetPath = path.resolve(source);
  const jscodeshift = getJscodeshift();
  const command = buildCommand(codemodPath, targetPath, jscodeshift, transformOptions);
  const { stdout } = await exec(command, { encoding: 'utf8' });
  const errors = parseErrors(codemod, stdout);
  const notImplementedErrors = parseNotImplementedErrors(codemod, stdout);
  if (options.logStatus) {
    if (errors.length > 0) {
      errors.forEach(({ transform, filename, summary }) => {
        error(`Error applying codemod [codemod=${transform}, path=${filename}, summary=${summary}]`);
      });
    }

    if (notImplementedErrors.length > 0) {
      log(
        `Some files require manual changes. Please search your codebase for \`FIXME(mastra): \` comments and follow the instructions to complete the upgrade.`,
      );
      notImplementedErrors.forEach(({ transform, filename, summary }) => {
        log(`Not Implemented [codemod=${transform}, path=${filename}, summary=${summary}]`);
      });
    }
  }

  return { errors, notImplementedErrors };
}
