#!/usr/bin/env node
import { existsSync, rmSync } from 'node:fs';

import {
  confirm,
  findModifiedFiles,
  isDirectExecution,
  providerDir,
  readManifest,
  updateProviderIndex,
  validateProviderId,
} from './provider-utils.js';

interface RemoveProviderOptions {
  localId: string;
  yes: boolean;
}

function usage(): never {
  throw new Error('Usage: pnpm remove-provider <localId> [--yes]');
}

function parseArguments(argv: string[]): RemoveProviderOptions {
  const localId = argv[0];
  if (!localId) usage();
  let yes = false;

  for (const argument of argv.slice(1)) {
    if (argument === '--yes' || argument === '-y') yes = true;
    else usage();
  }

  validateProviderId(localId, 'Local ID');
  return { localId, yes };
}

export async function removeProvider({ localId, yes }: RemoveProviderOptions): Promise<boolean> {
  const destination = providerDir(localId);
  if (!existsSync(destination)) {
    throw new Error(`Provider '${localId}' is not installed.`);
  }

  const manifest = readManifest(localId);
  const modifiedFiles = manifest ? findModifiedFiles(localId, manifest) : [];
  const message = manifest
    ? modifiedFiles.length > 0
      ? `Provider '${localId}' has ${modifiedFiles.length} modified generated file${modifiedFiles.length === 1 ? '' : 's'} (${modifiedFiles.join(', ')}). Delete it anyway?`
      : `Remove provider '${localId}' generated from '${manifest.providerId}'?`
    : `Provider '${localId}' has no generator manifest. Delete the entire directory anyway?`;

  if (!(await confirm(message, yes))) {
    console.log('Cancelled; no files changed.');
    return false;
  }

  rmSync(destination, { recursive: true, force: true });
  updateProviderIndex();
  console.log(`✓ Removed provider '${localId}'.`);
  return true;
}

async function main(): Promise<void> {
  try {
    await removeProvider(parseArguments(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (isDirectExecution(import.meta.url)) {
  void main();
}
