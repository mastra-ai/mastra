#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const passthrough = process.argv.slice(2).filter(arg => arg !== '--');
const groups = [
  ['unit:packages/*'],
  ['unit:auth/*'],
  ['unit:deployers/*'],
  ['unit:observability/*'],
  ['unit:client-sdks/*'],
  ['unit:server-adapters/*'],
  ['unit:stores/*'],
  ['unit:integrations/*'],
  ['unit:channels/*'],
  ['e2e:browser/*'],
];

function pnpmCommand(commandArgs) {
  const npmExecPath = process.env.npm_execpath;
  return npmExecPath
    ? { command: process.execPath, args: [npmExecPath, ...commandArgs] }
    : { command: 'pnpm', args: commandArgs };
}

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

console.log(
  '[source-mode] Running curated source-safe project groups; external-service/API-key/infra lanes are explicit.',
);

for (const [groupIndex, projects] of groups.entries()) {
  const args = ['vitest', 'run'];
  for (const project of projects) args.push('--project', project);
  args.push('--passWithNoTests', ...argsForGroup(groupIndex));

  console.log(`\n[source-mode] pnpm ${args.join(' ')}`);
  const { command, args: commandArgs } = pnpmCommand(args);
  const result = spawnSync(command, commandArgs, { stdio: 'inherit', env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
