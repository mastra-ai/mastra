#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const passthrough = process.argv.slice(2).filter(arg => arg !== '--');
const groups = [
  ['unit:packages/*', 'typecheck:packages/*'],
  ['unit:stores/*', 'typecheck:stores/*'],
  ['unit:auth/*'],
  ['unit:deployers/*'],
  ['unit:observability/*'],
  ['unit:client-sdks/*'],
  ['unit:server-adapters/*'],
];

const env = {
  ...process.env,
  MASTRA_SOURCE_MODE: '1',
  NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --max-old-space-size=8192 --conditions=mastra-source`.trim(),
};

function argsForGroup(groupIndex) {
  return passthrough.map(arg => {
    if (arg.startsWith('--outputFile.blob=')) {
      const file = arg.slice('--outputFile.blob='.length);
      return `--outputFile.blob=${file.replace(/\.json$/, `-${groupIndex}.json`)}`;
    }
    return arg;
  });
}

for (const [groupIndex, projects] of groups.entries()) {
  const args = ['vitest', 'run'];
  for (const project of projects) args.push('--project', project);
  args.push('--passWithNoTests', ...argsForGroup(groupIndex));

  console.log(`\n[source-mode] pnpm ${args.join(' ')}`);
  const result = spawnSync('pnpm', args, { stdio: 'inherit', env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
