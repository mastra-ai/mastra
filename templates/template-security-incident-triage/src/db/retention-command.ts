import { createLibSqlOperationalStore } from './libsql-operational-store.js';
import { migrateOperationalStore } from './migrate.js';
import type { OperationalStore } from './operational-store.js';
import { sweepRetention, validateRetentionTenantId } from './retention-operations.js';

export type RetentionCommand = Readonly<{
  tenantId: string;
  limit: number;
  dryRun: boolean;
}>;

/** Parses a deliberately tenant-scoped, dry-run-first maintenance command. */
export function parseRetentionCommand(argv: readonly string[]): RetentionCommand {
  let tenantId: string | undefined;
  let limit: number | undefined;
  let dryRun = true;
  const seen = new Set<string>();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument || seen.has(argument)) throw new Error('RETENTION_COMMAND_INVALID');
    seen.add(argument);
    if (argument === '--tenant') {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error('RETENTION_COMMAND_INVALID');
      tenantId = value;
      continue;
    }
    if (argument === '--limit') {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error('RETENTION_COMMAND_INVALID');
      limit = Number(value);
      continue;
    }
    if (argument === '--dry-run') {
      if (seen.has('--apply')) throw new Error('RETENTION_COMMAND_INVALID');
      dryRun = true;
      continue;
    }
    if (argument === '--apply') {
      if (seen.has('--dry-run')) throw new Error('RETENTION_COMMAND_INVALID');
      dryRun = false;
      continue;
    }
    throw new Error('RETENTION_COMMAND_INVALID');
  }
  try {
    validateRetentionTenantId(tenantId);
  } catch {
    throw new Error('RETENTION_COMMAND_INVALID');
  }
  if (!Number.isInteger(limit) || !limit || limit < 1 || limit > 1_024) throw new Error('RETENTION_COMMAND_INVALID');
  return Object.freeze({ tenantId: tenantId!, limit, dryRun });
}

export async function runRetentionCommand(
  argv: readonly string[],
  dependencies: Readonly<{
    store?: OperationalStore;
    now?: () => Date;
  }> = {},
) {
  const command = parseRetentionCommand(argv);
  const store = dependencies.store ?? createLibSqlOperationalStore();
  try {
    await migrateOperationalStore(store);
    return await sweepRetention(store, {
      now: (dependencies.now ?? (() => new Date()))(),
      limit: command.limit,
      tenantId: command.tenantId,
      dryRun: command.dryRun,
    });
  } finally {
    if (!dependencies.store) store.close();
  }
}
