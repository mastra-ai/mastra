import { basename, dirname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SERVER_DEFAULTS = {
  executionMode: 'local',
  localHost: '127.0.0.1',
  productionHost: '0.0.0.0',
} as const;

export const STORAGE_DEFAULTS = {
  // Framework LibSQL database URL; local durable workflow state is isolated from app evidence.
  mastraUrl: 'file:./.data/mastra.db',
  // Application-owned LibSQL database URL for immutable snapshots and pending evidence.
  monitorUrl: 'file:./.data/competitor-monitor.db',
} as const;

/** Resolve relative file URLs without changing absolute, remote, or in-memory database URLs. */
export function resolveDatabaseUrl(value: string, projectRoot: string) {
  if (!value.startsWith('file:') || value === 'file::memory:') return value;
  const base = pathToFileURL(`${resolve(projectRoot)}${sep}`);
  return value.startsWith('file://') ? new URL(value).href : new URL(value.slice('file:'.length), base).href;
}

/**
 * Mastra CLI 1.31.3's native dev launcher starts in `.mastra/output` and supplies the enclosing
 * `.mastra` directory as MASTRA_PROJECT_ROOT with MASTRA_DEV=true. Durable application state
 * belongs at the project root, one level above that disposable build directory. Keep every other
 * explicit root unchanged, including native start and direct operator overrides.
 */
export function resolveStorageRoot(environment: Readonly<Record<string, string | undefined>>, configuredRoot?: string) {
  if (!configuredRoot) return process.cwd();
  const resolvedRoot = resolve(configuredRoot);
  return environment.MASTRA_DEV === 'true' && basename(resolvedRoot) === '.mastra'
    ? dirname(resolvedRoot)
    : resolvedRoot;
}

export const OVERRIDE_BOUNDS = {
  // Smallest usable count for source/candidate work; fixed integer lower bound.
  minCount: 1,
} as const;
