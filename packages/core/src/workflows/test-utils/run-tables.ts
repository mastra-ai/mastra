/**
 * Copies of a `MockStore`'s workflow run tables, for tests that crash a run by copying what
 * storage holds at one moment and restarting from that copy in fresh storage. The copy is of the
 * tables, so it works for both storage versions.
 */

import { vi } from 'vitest';
import { cloneRunData } from '../../storage/domains/workflows/inmemory';
import type { MockStore } from '../../storage/mock';

const RUN_TABLES = ['workflows', 'workflowRunHeaders', 'workflowRunEntries'] as const;

/** Every workflows-store method that writes, across both storage versions. */
export const WRITE_METHODS = [
  'persistWorkflowSnapshot',
  'updateWorkflowResults',
  'updateWorkflowState',
  'updateWorkflowRunHeader',
  'writeWorkflowRunCheckpoint',
  'appendWorkflowRunEntries',
  'appendWorkflowRunStateDraft',
  'deleteWorkflowRunById',
] as const;

export type RunTables = Record<(typeof RUN_TABLES)[number], Map<string, any>>;

export async function runTablesOf(storage: InstanceType<typeof MockStore>): Promise<RunTables> {
  return ((await storage.getStore('workflows')) as any).db;
}

export function copyRunTables(tables: RunTables): RunTables {
  return Object.fromEntries(RUN_TABLES.map(table => [table, cloneRunData(tables[table])])) as RunTables;
}

/** Makes `tables` hold exactly what `copy` holds. */
export function restoreRunTables(tables: RunTables, copy: RunTables) {
  for (const table of RUN_TABLES) {
    tables[table].clear();
    for (const [key, value] of copy[table]) tables[table].set(key, value);
  }
}

/** Replaces every workflows-store write with `intercept`, which makes the write by calling `write`. */
export function interceptWrites(
  store: any,
  intercept: (args: any, write: (args: any) => Promise<unknown>) => Promise<unknown>,
) {
  for (const method of WRITE_METHODS) {
    const write = store[method].bind(store);
    vi.spyOn(store, method).mockImplementation((args: any) => intercept(args, write));
  }
}
