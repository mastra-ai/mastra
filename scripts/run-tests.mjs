#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2).filter(arg => arg !== '--');
const sourceMode =
  process.env.MASTRA_SOURCE_MODE === '1' || ['1', 'true'].includes(process.env.MASTRA_REPO_RUN_FROM_SOURCE ?? '');

function pnpmCommand(commandArgs) {
  const npmExecPath = process.env.npm_execpath;
  return npmExecPath
    ? { command: process.execPath, args: [npmExecPath, ...commandArgs] }
    : { command: 'pnpm', args: commandArgs };
}

if (sourceMode) {
  console.log(
    '[source-mode] Running curated source-safe local test groups. External-service/API-key/infra lanes remain explicit.',
  );
  const result = spawnSync(process.execPath, ['scripts/run-source-mode-tests.mjs', ...args], {
    stdio: 'inherit',
    env: process.env,
  });
  process.exit(result.status ?? 1);
}

const { command, args: commandArgs } = pnpmCommand(['vitest', 'run', ...args]);
const result = spawnSync(command, commandArgs, { stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
