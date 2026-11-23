#!/usr/bin/env node
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  isDirectExecution,
  listInstalledProviderIds,
  readManifest,
  templateProviderIds,
  templatesDir,
} from './provider-utils.js';

interface ListProviderOptions {
  installedOnly: boolean;
  search?: string;
}

function usage(): never {
  throw new Error('Usage: pnpm list-providers [--installed] [--search <term>]');
}

function parseArguments(argv: string[]): ListProviderOptions {
  let installedOnly = false;
  let search: string | undefined;

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--installed') {
      installedOnly = true;
    } else if (argument === '--search') {
      search = argv[++index] ?? usage();
    } else {
      usage();
    }
  }

  return { installedOnly, search };
}

function actionCount(providerId: string): number {
  const actionDir = resolve(templatesDir, providerId, 'actions');
  if (!existsSync(actionDir)) return 0;
  return readdirSync(actionDir).filter(filename => filename.endsWith('.ts')).length;
}

export function listProviders({ installedOnly, search }: ListProviderOptions): string[] {
  const installedIds = listInstalledProviderIds();
  const installed = installedIds.map(localId => ({ localId, manifest: readManifest(localId) }));
  const query = search?.toLowerCase();

  if (installedOnly) {
    return installed
      .filter(
        entry =>
          !query ||
          entry.localId.toLowerCase().includes(query) ||
          entry.manifest?.providerId.toLowerCase().includes(query),
      )
      .map(entry => {
        if (!entry.manifest) return `${entry.localId} (installed, no generator manifest)`;
        const alias = entry.manifest.providerId === entry.localId ? '' : ` <- ${entry.manifest.providerId}`;
        return `${entry.localId}${alias} (${entry.manifest.toolCount} tools, ${entry.manifest.skippedActions.length} skipped)`;
      });
  }

  const installedByProvider = new Map<string, string[]>();
  for (const entry of installed) {
    const providerId = entry.manifest?.providerId ?? entry.localId;
    const aliases = installedByProvider.get(providerId) ?? [];
    aliases.push(entry.localId);
    installedByProvider.set(providerId, aliases);
  }

  return templateProviderIds()
    .filter(providerId => {
      if (!query) return true;
      const localIds = installedByProvider.get(providerId) ?? [];
      return (
        providerId.toLowerCase().includes(query) || localIds.some(localId => localId.toLowerCase().includes(query))
      );
    })
    .map(providerId => {
      const localIds = installedByProvider.get(providerId) ?? [];
      const installedLabel = localIds.length > 0 ? ` [installed as ${localIds.join(', ')}]` : '';
      return `${providerId} (${actionCount(providerId)} action templates)${installedLabel}`;
    });
}

function main(): void {
  try {
    const rows = listProviders(parseArguments(process.argv.slice(2)));
    if (rows.length === 0) {
      console.log('No providers found.');
      return;
    }
    for (const row of rows) console.log(row);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (isDirectExecution(import.meta.url)) {
  main();
}
