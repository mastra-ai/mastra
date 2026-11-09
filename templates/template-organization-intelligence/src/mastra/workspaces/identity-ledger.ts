import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { z } from 'zod';

import type { CatalogSource } from './catalog.js';
import { sourceIdentity } from './catalog.js';

type LedgerEntry = { provider: CatalogSource['provider']; root: string };
const ledgerSchema = z.object({
  version: z.literal(1),
  sources: z.record(z.string(), z.object({ provider: z.enum(['local', 'google-drive', 's3']), root: z.string() })),
});
type Ledger = z.infer<typeof ledgerSchema>;

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
    const parsed = ledgerSchema.safeParse(JSON.parse(await readFile(ledgerPath, 'utf8')));
    if (parsed.success) return parsed.data;
    throw new SourceIdentityError('The source identity ledger is invalid. Remove only derived state before retrying.');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, sources: {} };
    if (error instanceof SyntaxError)
      throw new SourceIdentityError(
        'The source identity ledger is invalid. Remove only derived state before retrying.',
      );
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
