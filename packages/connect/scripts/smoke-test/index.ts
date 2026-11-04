#!/usr/bin/env tsx
/**
 * CLI entry: `pnpm --filter @mastra/connect smoke-test [--provider id]...`
 *
 * Reads auth from the environment (MASTRA_PLATFORM_SECRET_KEY and
 * MASTRA_PROJECT_ID), resolves the project toolset through the public
 * `tools()` resolver, dispatches to the per-provider scenarios registered
 * under `./scenarios/`, and prints a step-by-step report.
 *
 * Exits non-zero when any scenario fails or errors. Skipped scenarios
 * (no scenario registered, provider absent from the project toolset, or
 * scenario-level preflight guards) do not fail the run.
 */
import { parseArgs } from 'node:util';

import { printReport } from './report.js';
import { runSmokeTests } from './runner.js';
import { scenarios } from './scenarios/index.js';

interface CliOptions {
  providers: string[];
  projectId?: string;
}

function parse(argv: string[]): CliOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      provider: { type: 'string', multiple: true, short: 'p' },
      'project-id': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    printHelp();
    process.exit(0);
  }
  return {
    providers: (values.provider as string[] | undefined) ?? [],
    projectId: values['project-id'] as string | undefined,
  };
}

function printHelp(): void {
  const script = 'pnpm --filter @mastra/connect smoke-test';
  process.stdout.write(
    [
      `Usage: ${script} [--provider <id>]... [--project-id <id>]`,
      '',
      'Environment:',
      '  MASTRA_PLATFORM_SECRET_KEY   Platform access token (or MASTRA_PLATFORM_ACCESS_TOKEN)',
      '  MASTRA_PROJECT_ID            Platform project id to resolve against',
      '',
      'Flags:',
      '  --provider / -p    Run only the named provider scenario. Pass multiple times.',
      '  --project-id       Override MASTRA_PROJECT_ID for this run.',
      '  --help / -h        Show this help.',
      '',
      'The runner exits 0 when every scenario either passes or self-skips, 1 when',
      'any scenario fails or errors. Scenarios create, read, update, and delete',
      'their own records through the available tools; failed deletes are logged',
      'so an operator can clean up leaks by hand.',
      '',
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  const options = parse(process.argv.slice(2));
  // A typo'd --provider must not silently become a passing no-op run.
  const known = new Set(scenarios.map(s => s.integrationId));
  const unknown = options.providers.filter(p => !known.has(p));
  if (unknown.length > 0) {
    console.error(`Unknown provider id(s): ${unknown.join(', ')}`);
    console.error(`Registered scenarios: ${[...known].sort().join(', ')}`);
    process.exit(1);
  }
  const result = await runSmokeTests({
    providers: options.providers,
    projectId: options.projectId,
  });
  printReport(result);
  const anyFailed = result.outcomes.some(o => o.status === 'fail' || o.status === 'error');
  process.exit(anyFailed ? 1 : 0);
}

main().catch(error => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
});
