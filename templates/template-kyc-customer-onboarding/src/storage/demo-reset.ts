import { homedir, tmpdir } from 'node:os';
import { relative, resolve, sep } from 'node:path';
import { lstat, rm } from 'node:fs/promises';

import type { AppConfig } from '../config/load-config.js';

export const resetConfirmation = 'RESET_LOCAL_DEMO_DATA';
const workspaceRoot = resolve(import.meta.dirname, '../..');

const pathFromFileUrl = (url: string): string => {
  if (!url.startsWith('file:')) throw new Error('Reset supports only file-backed local stores');
  return resolve(url.slice('file:'.length));
};

const assertNotSymlink = async (path: string): Promise<void> => {
  try {
    if ((await lstat(path)).isSymbolicLink()) throw new Error('Reset refused a symbolic-link path');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
};

const assertContainedTarget = async (dataRoot: string, target: string): Promise<void> => {
  const nested = relative(dataRoot, target);
  if (nested === '' || nested === '..' || nested.startsWith(`..${sep}`)) {
    throw new Error('Reset target is outside the configured demo data root');
  }
  await assertNotSymlink(dataRoot);
  let current = dataRoot;
  for (const segment of nested.split(sep)) {
    current = resolve(current, segment);
    await assertNotSymlink(current);
  }
};

export const demoResetTargets = (config: AppConfig): readonly string[] => {
  const operational = pathFromFileUrl(config.storage.operationalUrl);
  const mastra = pathFromFileUrl(config.storage.mastraUrl);
  const analytics = resolve(config.storage.analyticsPath);
  return Object.freeze([
    operational,
    `${operational}-shm`,
    `${operational}-wal`,
    mastra,
    `${mastra}-shm`,
    `${mastra}-wal`,
    analytics,
    `${analytics}.wal`,
    resolve(config.storage.documentPath),
  ]);
};

export const resetDemoData = async (
  config: AppConfig,
  confirmation?: string,
): Promise<Readonly<{ dryRun: boolean; targets: readonly string[] }>> => {
  if (!['test', 'demo-default', 'demo-strict'].includes(config.environment)) {
    throw new Error('Reset is available only in test and demo environments');
  }
  const dataRoot = resolve(config.storage.demoDataRoot);
  if (
    new Set([
      '/',
      resolve(homedir()),
      workspaceRoot,
      resolve(workspaceRoot, '..'),
      resolve(tmpdir()),
      resolve('/tmp'),
      resolve('/private/tmp'),
    ]).has(dataRoot)
  ) {
    throw new Error('Reset refused an unsafe broad data root');
  }
  const targets = demoResetTargets(config);
  const uniqueTargets = [...new Set(targets.map(target => resolve(target)))];
  if (uniqueTargets.length !== targets.length) throw new Error('Reset refused overlapping targets');
  for (const [index, target] of uniqueTargets.entries()) {
    await assertContainedTarget(dataRoot, target);
    for (const [otherIndex, other] of uniqueTargets.entries()) {
      if (index === otherIndex) continue;
      const nested = relative(target, other);
      if (nested !== '' && nested !== '..' && !nested.startsWith(`..${sep}`)) {
        throw new Error('Reset refused overlapping targets');
      }
    }
  }
  if (confirmation !== resetConfirmation) return { dryRun: true, targets };
  await Promise.all(targets.map(target => rm(target, { recursive: true, force: true })));
  return { dryRun: false, targets };
};
