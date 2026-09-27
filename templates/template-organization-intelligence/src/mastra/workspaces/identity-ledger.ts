import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { CatalogSource } from './catalog.js';
import { sourceIdentity } from './catalog.js';

type LedgerEntry = { provider: CatalogSource['provider']; root: string };
type Ledger = { version: 1; sources: Record<string, LedgerEntry> };

export class SourceIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceIdentityError';
  }
}

function identityFor(source: CatalogSource): LedgerEntry {
  return { provider: source.provider, root: sourceIdentity(source) };
}

async function readLedger(ledgerPath: string): Promise<Ledger> {
  try {
    const parsed: unknown = JSON.parse(await readFile(ledgerPath, 'utf8'));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as { version?: unknown }).version === 1 &&
      typeof (parsed as { sources?: unknown }).sources === 'object'
    ) {
      return parsed as Ledger;
    }
    throw new SourceIdentityError('The source identity ledger is invalid. Remove only derived state before retrying.');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, sources: {} };
    throw error;
  }
}

export async function validateAndPersistSourceIdentity(ledgerPath: string, sources: CatalogSource[]): Promise<void> {
  const ledger = await readLedger(ledgerPath);
  for (const source of sources) {
    const existing = Object.hasOwn(ledger.sources, source.id) ? ledger.sources[source.id] : undefined;
    const next = identityFor(source);
    if (existing && (existing.provider !== next.provider || existing.root !== next.root)) {
      throw new SourceIdentityError(
        `Source ${source.id} changed provider or root. Use a new source id or rebuild derived state before activation.`,
      );
    }
    ledger.sources[source.id] = next;
  }

  await mkdir(dirname(ledgerPath), { recursive: true });
  const temporaryPath = `${ledgerPath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(ledger, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, ledgerPath);
}
