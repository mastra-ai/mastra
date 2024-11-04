'use server';

import fs from 'fs';
import path from 'path';

import { config } from '@/lib/framework-utils';

import { PackageService } from '@/service/service.package';

export async function isPackageInstalled({ packageName }: { packageName: string }) {
  const packageJsonPath = path.join(process.env.APP_DIR || process.cwd(), 'package.json');
  const packageService = new PackageService(packageJsonPath);
  return packageService.isPackageInstalled(packageName);
}

const findLockFile = (dir: string) => {
  const lockFiles = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'];
  for (const file of lockFiles) {
    if (fs.existsSync(path.join(dir, file))) {
      return file;
    }
  }
  const parentDir = path.resolve(dir, '..');
  if (parentDir !== dir) {
    return findLockFile(parentDir);
  }
  return null;
};

export async function getPackageManager() {
  const lockFile = findLockFile(process.env.APP_DIR || process.cwd());
  switch (lockFile) {
    case 'pnpm-lock.yaml':
      return 'pnpm';
    case 'package-lock.json':
      return 'npm';
    case 'yarn.lock':
      return 'yarn';
    default: // we will use npm if we can't figure it out
      return config?.packageManager || 'npm';
  }
}

export async function installPackage({ packageName }: { packageName: string }) {
  const packageJsonPath = path.join(process.env.APP_DIR || process.cwd(), 'package.json');
  const packageManager = await getPackageManager();
  const packageService = new PackageService(packageJsonPath);
  const res = await packageService.installPackage({
    packageName,
    packageManager,
    isNotPublished: process.cwd().includes('/cli/admin'),
  });
  return res;
}
