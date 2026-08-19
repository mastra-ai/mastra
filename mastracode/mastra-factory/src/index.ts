#! /usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';

import { PosthogAnalytics, setAnalytics } from 'mastra/dist/analytics/index.js';

import { create } from './create.js';
import { redactError } from './utils/redact.js';

const pkg = JSON.parse(
  readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'),
) as { version: string };

const analytics = new PosthogAnalytics({
  apiKey: 'phc_SBLpZVAB6jmHOct9CABq3PF0Yn5FU3G2FgT4xUr2XrT',
  host: 'https://us.posthog.com',
  version: pkg.version,
});
setAnalytics(analytics);

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
    const region = args.region ? String(args.region) : undefined;
    const validRegion = region === 'eu' || region === 'us' ? region : undefined;
    const customTemplate = args.template === DEFAULT_TEMPLATE_REPO ? undefined : args.template;
    // Values that must never reach analytics if a failure message echoes them.
    // (redactError also covers derived variants, e.g. degit's prefix-stripped repo.)
    const sensitiveValues = [
      customTemplate,
      args.org ? String(args.org) : undefined,
      // Valid regions are already reported in args; only an invalid (arbitrary)
      // value is sensitive.
      validRegion ? undefined : region,
      projectNameArg,
    ];

    let rawError: unknown;
    try {
      await analytics.trackCommandExecution({
        command: 'create-factory',
        args: {
          // Only report whether the default template was used — a custom
          // template URL could identify a private repo, so never send it.
          default_template: args.template === DEFAULT_TEMPLATE_REPO,
          no_platform: args.platform === false,
          has_org: Boolean(args.org),
          region: validRegion ?? (region ? 'invalid' : undefined),
        },
        execution: async () => {
          try {
            await create({
              projectName: projectNameArg,
              template: args.template,
              // commander's `--no-platform` flips `platform` to false when present, true by default.
              noPlatform: args.platform === false,
              org: args.org ? String(args.org) : undefined,
              region,
              analytics,
            });
          } catch (err) {
            rawError = err;
            // Failure telemetry reports `error.message` — hand analytics a
            // redacted copy instead of the raw error.
            throw redactError(err, sensitiveValues);
          }
        },
      });
    } catch (err) {
      // Re-throw the original error so the user-facing output keeps the full
      // message (retry hints, org list, etc.).
      throw rawError ?? err;
    }
  });

try {
  await program.parseAsync(process.argv);
} catch (err) {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
} finally {
  await analytics.shutdown(1000);
}
