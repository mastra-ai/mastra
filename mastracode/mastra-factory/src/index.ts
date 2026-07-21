import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { Analytics } from './analytics';
import { create } from './create';

const pkg = JSON.parse(
  readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'),
) as { version: string };

const analytics = new Analytics(pkg.version);
const program = new Command();
const DEFAULT_TEMPLATE_REPO = 'https://github.com/mastra-ai/softwarefactory-template';

type CreateArgs = {
  template: string;
};

program
  .name('create-factory')
  .description('Create a new Mastra Software Factory project')
  .argument('[project-name]', 'Directory name of the project')
  .option('--template <template-name>', 'Create a project from a template (public GitHub URL)', DEFAULT_TEMPLATE_REPO)
  .version(pkg.version, '-v, --version')
  .action(async (projectNameArg: string | undefined, args: CreateArgs) => {
    await create({
      projectName: projectNameArg,
      template: args.template,
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
