import * as fs from 'fs';
import { join, resolve } from 'path';

import { MastraError } from '@mastra/core/error';
import { runWithExeca } from './execa.js';
import { logger } from './logger.js';

const MEMOIZED = new Map();

function findLockFile(dir: string): string | null {
  const lockFiles = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'bun.lock'];
  for (const file of lockFiles) {
    if (fs.existsSync(join(dir, file))) {
      return file;
    }
  }
  const parentDir = resolve(dir, '..');
  if (parentDir !== dir) {
    return findLockFile(parentDir);
  }
  return null;
}

export function detectPm({ path }: { path: string }): string {
  const cached = MEMOIZED.get(path);
  if (cached) {
    return cached;
  }

  const lockFile = findLockFile(path);
  let pm: string = 'npm';
  switch (lockFile) {
    case 'pnpm-lock.yaml':
      pm = 'pnpm';
      break;
    case 'package-lock.json':
      pm = 'npm';
      break;
    case 'yarn.lock':
      pm = 'yarn';
      break;
    case 'bun.lock':
      pm = 'bun';
      break;
    default:
      pm = 'npm';
  }

  MEMOIZED.set(path, pm);
  return pm;
}

export async function installNodeVersion({ path }: { path: string }) {
  let nvmrcExists = false;
  let nodeVersionExists = false;

  try {
    fs.accessSync(join(path, '.nvmrc'));
    nvmrcExists = true;
  } catch {
    // File does not exist
  }

  try {
    fs.accessSync(join(path, '.node-version'));
    nodeVersionExists = true;
  } catch {
    // File does not exist
  }

  if (nvmrcExists || nodeVersionExists) {
    logger.info('Node version file found, installing specified Node.js version...');
    const { success, error } = await runWithExeca({
      cmd: 'n',
      args: ['auto'],
      cwd: path,
    });
    if (!success) {
      throw new MastraError(
        {
          id: 'NODE_FAIL_INSTALL_SPECIFIED_VERSION',
          category: 'USER',
          domain: 'DEPLOYER',
        },
        error,
      );
    }
  }
}

export async function installDeps({ path, pm }: { path: string; pm?: string }) {
  pm = pm ?? detectPm({ path });
  logger.info(`Installing dependencies with ${pm} in ${path}`);
  const args = ['install'];
  const { success, error } = await runWithExeca({ cmd: pm, args, cwd: path });
  if (!success) {
    throw new MastraError(
      {
        id: 'FAIL_INSTALL_DEPS',
        category: 'USER',
        domain: 'DEPLOYER',
      },
      error,
    );
  }
}

export async function runInstallCommand({ path, installCommand }: { path: string; installCommand: string }) {
  logger.info(`Running install command ${installCommand} in workspace with ${path}`);
  const { success, error } = await runWithExeca({ cmd: 'sh', args: ['-c', installCommand], cwd: path });
  if (!success) {
    throw new MastraError(
      {
        id: 'FAIL_CUSTOM_INSTALL_COMMAND',
        category: 'USER',
        domain: 'DEPLOYER',
      },
      error,
    );
  }
}

export async function runScript({ scriptName, path, args }: { scriptName: string; path: string; args?: string[] }) {
  const pm = detectPm({ path });
  logger.info(`Running script ${scriptName} in workspace with ${pm}`);
  const { success, error } = await runWithExeca({
    cmd: pm,
    args: pm === 'npm' ? ['run', scriptName, ...(args ?? [])] : [scriptName, ...(args ?? [])],
    cwd: path,
  });
  if (!success) {
    throw new MastraError(
      {
        id: 'FAIL_BUILD_SCRIPT',
        category: 'USER',
        domain: 'DEPLOYER',
      },
      error,
    );
  }
}

export async function runBuildCommand({ command, path }: { command: string; path: string }) {
  logger.info(`Running build command ${command}`);
  const { success, error } = await runWithExeca({ cmd: 'sh', args: ['-c', command], cwd: path });
  if (!success) {
    throw new MastraError(
      {
        id: 'FAIL_BUILD_COMMAND',
        category: 'USER',
        domain: 'DEPLOYER',
      },
      error,
    );
  }
}
