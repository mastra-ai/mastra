import { AsyncLocalStorage } from 'node:async_hooks';

import type { AnySpan } from './types';
import { setCurrentSpanResolver, setExecuteWithContext, setExecuteWithContextSync } from './utils';

/**
 * Ambient storage for the current span. Populated by executeWithContext/executeWithContextSync
 * so that infrastructure code (e.g. DualLogger) can resolve the active span without
 * being passed it explicitly.
 */
const spanContextStorage = new AsyncLocalStorage<AnySpan>();

/**
 * Returns the current span from AsyncLocalStorage, if one is active.
 * Used by DualLogger to forward logs to a span-correlated loggerVNext.
 */
export function getCurrentSpan(): AnySpan | undefined {
  return spanContextStorage.getStore();
}

let initialized = false;

/**
 * Registers the AsyncLocalStorage-backed context resolvers with the browser-safe
 * utils module. Must be called once at startup (e.g. from the Mastra constructor).
 *
 * This is an explicit initialization function rather than a top-level side-effect
 * because the package declares `"sideEffects": false` and tsup's tree-shaking
 * (`preset: 'smallest'`) strips bare side-effect imports.
 */
export function initContextStorage(): void {
  if (initialized) return;
  initialized = true;
  setCurrentSpanResolver(getCurrentSpan);
  setExecuteWithContext(executeWithContext);
  setExecuteWithContextSync(executeWithContextSync);
}

/**
 * Execute an async function within the span's tracing context if available.
 * Falls back to direct execution if no span exists.
 *
 * When a bridge is configured, this enables auto-instrumented operations
 * (HTTP requests, database queries, etc.) to be properly nested under the
 * current span in the external tracing system.
 *
 * @param span - The span to use as context (or undefined to execute without context)
 * @param fn - The async function to execute
 * @returns The result of the function execution
 *
 * @example
 * ```typescript
 * const result = await executeWithContext(llmSpan, async () =>
 *   model.generateText(args)
 * );
 * ```
 */
export async function executeWithContext<T>(params: { span?: AnySpan; fn: () => Promise<T> }): Promise<T> {
  const { span, fn } = params;

  // Wrap fn so the span is available via getCurrentSpan() inside the async context.
  const wrappedFn = span ? () => spanContextStorage.run(span, fn) : fn;

  if (span?.executeInContext) {
    return span.executeInContext(wrappedFn);
  }

  return wrappedFn();
}

/**
 * Execute a synchronous function within the span's tracing context if available.
 * Falls back to direct execution if no span exists.
 *
 * When a bridge is configured, this enables auto-instrumented operations
 * (HTTP requests, database queries, etc.) to be properly nested under the
 * current span in the external tracing system.
 *
 * @param span - The span to use as context (or undefined to execute without context)
 * @param fn - The synchronous function to execute
 * @returns The result of the function execution
 *
 * @example
 * ```typescript
 * const result = executeWithContextSync(llmSpan, () =>
 *   model.streamText(args)
 * );
 * ```
 */
export function executeWithContextSync<T>(params: { span?: AnySpan; fn: () => T }): T {
  const { span, fn } = params;

  // Wrap fn so the span is available via getCurrentSpan() inside the sync context.
  const wrappedFn = span ? () => spanContextStorage.run(span, fn) : fn;

  if (span?.executeInContextSync) {
    return span.executeInContextSync(wrappedFn);
  }

  return wrappedFn();
}
