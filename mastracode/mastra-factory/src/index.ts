#! /usr/bin/env node
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
const DEFAULT_TEMPLATE_REPO = 'https://github.com/mastra-ai/softwarefactory-template';

type CreateArgs = {
  template: string;
  platform?: boolean;
  org?: string;
  region?: string;
};

program
  .name('create-factory')
  .description('Create a new Mastra Factory project')
  .argument('[project-name]', 'Directory name of the project')
  .option('--template <template-name>', 'Create a project from a template (public GitHub URL)', DEFAULT_TEMPLATE_REPO)
  .option('--no-platform', 'Skip Mastra platform sign-in, project, and Neon provisioning')
  .option('--org <org>', 'Mastra organization id or name — skips the interactive org picker')
  .option('--region <region>', 'Platform project region (eu or us); prompts when omitted')
  .version(pkg.version, '-v, --version')
  .action(async (projectNameArg: string | undefined, args: CreateArgs) => {
    await create({
      projectName: projectNameArg,
      template: args.template,
      // commander's `--no-platform` flips `platform` to false when present, true by default.
      noPlatform: args.platform === false,
      org: args.org ? String(args.org) : undefined,
      region: args.region ? String(args.region) : undefined,
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
