'use server';

import path from 'path';

import { config } from '@/lib/framework-utils';

import { PackageService } from '@/service/service.package';

export async function isPackageInstalled({ packageName }: { packageName: string }) {
  const packageJsonPath = path.join(process.env.APP_DIR || process.cwd(), 'package.json');
  const packageService = new PackageService(packageJsonPath);
  return packageService.isPackageInstalled(packageName);
}

export async function getPackageManager() {
  return config?.packageManager || 'npm';
}

export async function installPackage({ packageName }: { packageName: string }) {
  const packageJsonPath = path.join(process.env.APP_DIR || process.cwd(), 'package.json');
  const packageManager = config?.packageManager || 'pnpm';
  const packageService = new PackageService(packageJsonPath);
  const res = await packageService.installPackage({ packageName, packageManager, isNotPublished: true });
  return res;
}
