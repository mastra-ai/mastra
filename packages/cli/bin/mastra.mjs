#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const binDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = dirname(binDir);
const sourceEntry = join(packageRoot, 'src', 'index.ts');
const distEntry = join(packageRoot, 'dist', 'index.js');
const sourceMode = process.env.MASTRA_SOURCE_MODE === '1' || args.includes('--source-mode');

function withSourceModeCondition(value) {
  const condition = '--conditions=mastra-source';
  if (!value) return condition;
  return value.split(/\s+/).includes(condition) ? value : `${value} ${condition}`;
}

function run(command, commandArgs, env = process.env) {
  const child = spawn(command, commandArgs, {
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  child.on('error', error => {
    console.error(error);
    process.exit(1);
  });
}

if (sourceMode && existsSync(sourceEntry)) {
  const localTsxBin = join(packageRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
  const repoTsxBin = join(dirname(dirname(packageRoot)), 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
  const command = existsSync(localTsxBin) ? localTsxBin : existsSync(repoTsxBin) ? repoTsxBin : 'tsx';

  run(command, [sourceEntry, ...args], {
    ...process.env,
    MASTRA_SOURCE_MODE: '1',
    MASTRA_SOURCE_MODE_WORKSPACE_ROOT: dirname(dirname(packageRoot)),
    NODE_OPTIONS: withSourceModeCondition(process.env.NODE_OPTIONS),
  });
} else {
  if (!existsSync(distEntry)) {
    console.error('Mastra CLI build output was not found. Run `pnpm --filter mastra build:lib` first.');
    process.exit(1);
  }

  await import(distEntry);
}
