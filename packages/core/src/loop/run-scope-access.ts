/**
 * Helpers for step factories that read non-serializable runtime state from
 * either the per-run {@link RunScope} on `Mastra` (production) or a transient
 * `_internal` (`StreamInternal`) bag (back-compat for tests that construct
 * step factories directly without going through `loop()`).
 *
 * `loop.ts` hydrates the scope from `_internal` before any step runs, so in
 * production the scope is always authoritative. Tests that bypass `loop()` and
 * pass a partial `_internal` continue to work via the fallback path.
 *
 * Writes go to the scope when it exists *and* to `_internal` when present, so
 * legacy tests that observe mutations on the `_internal` object they passed in
 * keep observing them.
 */

import type { Mastra } from '../mastra';
import type { RunScope, RunScopeKey } from '../mastra/run-scope';
import type { StreamInternal } from './types';

export type RunScopeContext = {
  mastra?: Mastra;
  runId?: string;
  _internal?: StreamInternal;
};

/**
 * Resolve the {@link RunScope} for this run if one exists.
 * Returns `undefined` for the test path where no `mastra`/`runId` is supplied.
 */
export function getRunScope(ctx: RunScopeContext): RunScope | undefined {
  if (!ctx.mastra || !ctx.runId) return undefined;
  if (typeof ctx.mastra.__getRunScope !== 'function') return undefined;
  return ctx.mastra.__getRunScope(ctx.runId);
}

/**
 * Read a value, preferring the scope and falling back to the matching field on
 * `_internal`. Use this in step factories migrated to the scope so legacy tests
 * that pass `_internal` without populating the scope still work.
 */
export function readScoped<T>(
  ctx: RunScopeContext,
  key: RunScopeKey<T>,
  internalField: keyof StreamInternal,
): T | undefined {
  const scope = getRunScope(ctx);
  if (scope) {
    const v = scope.get(key);
    if (v !== undefined) return v;
  }
  return ctx._internal?.[internalField] as T | undefined;
}

/**
 * Write a value to the scope (when present) *and* mirror to `_internal` (when
 * present). Mirroring preserves the legacy "step mutates `_internal` for the
 * caller to read after" contract; the scope is the structural source of truth
 * for any future off-closure consumer.
 */
export function writeScoped<T>(
  ctx: RunScopeContext,
  key: RunScopeKey<T>,
  internalField: keyof StreamInternal,
  value: T,
): void {
  const scope = getRunScope(ctx);
  if (scope) scope.set(key, value);
  if (ctx._internal) {
    (ctx._internal as Record<string, unknown>)[internalField as string] = value;
  }
}
