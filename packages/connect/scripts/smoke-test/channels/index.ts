#!/usr/bin/env tsx
/**
 * CLI entry: `pnpm --filter @mastra/connect smoke-test:channels [--channel id]...`
 *
 * Reads auth from the environment (MASTRA_PLATFORM_SECRET_KEY and
 * MASTRA_PROJECT_ID), exercises the public `channels()` resolver contract
 * against the live platform, and for every channel integration with an
 * active connection verifies the end-to-end credential flow with read-only
 * vendor whoami calls. Prints the same step-by-step report as the tools
 * smoke suite.
 *
 * Exits non-zero when any check fails or errors. Channels without an active
 * connection are skipped, not failed.
 */
import { parseArgs } from 'node:util';

import { printReport } from '../report.js';
import { CHANNEL_IDS, runChannelSmokeTests } from './runner.js';

interface CliOptions {
  channels: string[];
  projectId?: string;
}

function parse(argv: string[]): CliOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      channel: { type: 'string', multiple: true, short: 'c' },
      'project-id': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    printHelp();
    process.exit(0);
  }
  return {
    channels: (values.channel as string[] | undefined) ?? [],
    projectId: values['project-id'] as string | undefined,
  };
}

function printHelp(): void {
  const script = 'pnpm --filter @mastra/connect smoke-test:channels';
  process.stdout.write(
    [
      `Usage: ${script} [--channel <id>]... [--project-id <id>]`,
      '',
      'Environment:',
      '  MASTRA_PLATFORM_SECRET_KEY   Platform access token (or MASTRA_PLATFORM_ACCESS_TOKEN)',
      '  MASTRA_PROJECT_ID            Platform project id to resolve against',
      '',
      'Flags:',
      `  --channel / -c     Run only the named channel (${CHANNEL_IDS.join(', ')}). Pass multiple times.`,
      '  --project-id       Override MASTRA_PROJECT_ID for this run.',
      '  --help / -h        Show this help.',
      '',
      'All checks are read-only: the suite resolves channel providers through',
      'the public channels() API and verifies each connected credential with a',
      'vendor whoami call. It never registers webhooks, installs agents, or',
      'sends messages.',
      '',
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  const options = parse(process.argv.slice(2));
  // A typo'd --channel must not silently become a passing no-op run.
  const known = new Set<string>(CHANNEL_IDS);
  const unknown = options.channels.filter(c => !known.has(c));
  if (unknown.length > 0) {
    console.error(`Unknown channel id(s): ${unknown.join(', ')}`);
    console.error(`Known channels: ${[...known].sort().join(', ')}`);
    process.exit(1);
  }
  const result = await runChannelSmokeTests({
    channels: options.channels,
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
