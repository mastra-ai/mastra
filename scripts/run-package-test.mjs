#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const [target, ...rest] = process.argv.slice(2);
if (!target) {
  console.error('Usage: node scripts/run-package-test.mjs <workspace-filter> [vitest args]');
  process.exit(1);
}

const args = rest.filter(arg => arg !== '--');
const sourceMode = ['1', 'true'].includes(process.env.MASTRA_SOURCE_MODE ?? '');
const env = {
  ...process.env,
  ...(sourceMode
    ? {
        MASTRA_SOURCE_MODE: '1',
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --conditions=mastra-source`.trim(),
      }
    : {}),
};

function pnpmCommand(commandArgs) {
  const npmExecPath = process.env.npm_execpath;
  return npmExecPath
    ? { command: process.execPath, args: [npmExecPath, ...commandArgs] }
    : { command: 'pnpm', args: commandArgs };
}

const { command, args: commandArgs } = pnpmCommand(['--filter', target, 'test', ...args]);
const result = spawnSync(command, commandArgs, { stdio: 'inherit', env });
process.exit(result.status ?? 1);
