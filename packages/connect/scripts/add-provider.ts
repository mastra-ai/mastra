#!/usr/bin/env node
import { existsSync } from 'node:fs';

import { generateProvider } from './generate-provider.js';
import {
  confirm,
  findModifiedFiles,
  isDirectExecution,
  providerDir,
  readManifest,
  templateProviderIds,
  updateProviderIndex,
  validateProviderId,
} from './provider-utils.js';

export interface AddProviderOptions {
  providerId: string;
  localId: string;
  yes: boolean;
  expectedTemplateSha?: string;
}

function usage(): never {
  throw new Error('Usage: pnpm add-provider <providerId> [--as <localId>] [--yes]');
}

function parseArguments(argv: string[]): AddProviderOptions {
  const providerId = argv[0];
  if (!providerId) usage();
  let localId = providerId;
  let yes = false;

  for (let index = 1; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--as') {
      localId = argv[++index] ?? usage();
    } else if (argument === '--yes' || argument === '-y') {
      yes = true;
    } else {
      usage();
    }
  }

  validateProviderId(providerId, 'Provider ID');
  validateProviderId(localId, 'Local ID');
  return { providerId, localId, yes };
}

export async function addProvider(options: AddProviderOptions): Promise<boolean> {
  const availableProviders = templateProviderIds();
  if (availableProviders.length === 0) {
    throw new Error('Template checkout is missing. Run `pnpm sync-templates` first.');
  }
  if (!availableProviders.includes(options.providerId)) {
    throw new Error(
      `Unknown template provider '${options.providerId}'. Run \`pnpm list-providers --search ${options.providerId}\`.`,
    );
  }

  const destination = providerDir(options.localId);
  if (existsSync(destination)) {
    const manifest = readManifest(options.localId);
    if (!manifest) {
      throw new Error(
        `Local ID '${options.localId}' already exists without a generator manifest. Refusing to overwrite an unmanaged provider directory.`,
      );
    }
    if (manifest.providerId !== options.providerId) {
      throw new Error(
        `Local ID '${options.localId}' is already assigned to template provider '${manifest.providerId}'. Choose another --as value.`,
      );
    }

    const modifiedFiles = findModifiedFiles(options.localId, manifest);
    const message =
      modifiedFiles.length > 0
        ? `You've modified ${modifiedFiles.length} generated file${modifiedFiles.length === 1 ? '' : 's'} in '${options.localId}' (${modifiedFiles.join(', ')}). Overwrite anyway?`
        : `Provider '${options.localId}' is already installed. Regenerate and overwrite it?`;

    if (!(await confirm(message, options.yes))) {
      console.log('Cancelled; no files changed.');
      return false;
    }
  }

  const result = await generateProvider({
    providerId: options.providerId,
    localId: options.localId,
    expectedTemplateSha: options.expectedTemplateSha,
  });
  updateProviderIndex();
  console.log(
    `✓ Added ${result.providerId} as ${result.localId}: ${result.toolCount} tools generated, ${result.skippedActions.length} skipped.`,
  );
  for (const skipped of result.skippedActions) {
    console.log(`  - ${skipped.action}: ${skipped.reason}`);
  }
  return true;
}

async function main(): Promise<void> {
  try {
    await addProvider(parseArguments(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (isDirectExecution(import.meta.url)) {
  void main();
}
