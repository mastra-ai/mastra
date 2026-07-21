import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';

import { Analytics } from './analytics.js';
import { create } from './create.js';

const pkg = JSON.parse(
  readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'),
) as { version: string };

const analytics = new Analytics(pkg.version);
const program = new Command();

program
  .name('create-factory')
  .description('Create a Mastra Software Factory project')
  .version(pkg.version, '-v, --version')
  .argument('[project-name]', 'Directory name of the project')
  .option('--default', 'Non-interactive: default name')
  .option('--template-ref <ref>', 'Pin a template repo tag/branch')
  .option('--template-dir <dir>', 'Use a local template directory instead of cloning (development)')
  .option('-t, --timeout [ms]', 'Timeout for dependency installation in ms')
  .action(async (projectNameArg: string | undefined, args: Record<string, unknown>) => {
    let timeout: number | undefined;
    if (args.timeout !== undefined) {
      timeout = args.timeout === true ? 60_000 : Number(args.timeout);
      if (!Number.isInteger(timeout) || timeout <= 0) {
        throw new Error(`--timeout must be a positive integer in milliseconds (got ${String(args.timeout)})`);
      }
    }
    await create({
      projectName: projectNameArg,
      useDefaults: Boolean(args.default),
      templateRef: args.templateRef ? String(args.templateRef) : undefined,
      templateDir: args.templateDir ? String(args.templateDir) : undefined,
      timeout,
      analytics,
    });
  });

try {
  await program.parseAsync(process.argv);
} catch (err) {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
} finally {
  await analytics.shutdown(1000);
}
