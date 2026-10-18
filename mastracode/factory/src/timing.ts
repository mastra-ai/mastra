/**
 * Lightweight phase timing for factory boot and hot request paths.
 *
 * Deliberately not a metrics framework: structured stderr lines that can be
 * grepped (`[factory:timing]`) and diffed across runs to localize slow boot
 * phases and slow per-request dependencies.
 */

import type { Context } from 'hono';

/**
 * Verbose per-operation timing (HTTP requests, storage calls, sandbox
 * commands). Off by default; enable per deployment with `FACTORY_TIMING=1`.
 */
export const factoryTimingEnabled = /^(1|true|yes)$/i.test(process.env.FACTORY_TIMING ?? '');

function logTiming(line: string): void {
  process.stderr.write(`[factory:timing] ${line}\n`);
}

/** Run `fn`, logging its duration only when `FACTORY_TIMING` is enabled. */
export async function timed<T>(phase: string, fn: () => Promise<T>): Promise<T> {
  if (!factoryTimingEnabled) return fn();
  const start = performance.now();
  try {
    return await fn();
  } finally {
    logTiming(`${phase} ${Math.round(performance.now() - start)}ms`);
  }
}

/** Hono middleware logging method, path, status, and duration of each request. */
export function createRequestTimingMiddleware() {
  return async (c: Context, next: () => Promise<void>): Promise<void> => {
    const start = performance.now();
    try {
      await next();
    } finally {
      logTiming(`http ${c.req.method} ${c.req.path} ${c.res.status} ${Math.round(performance.now() - start)}ms`);
    }
  };
}

/**
 * Patch `methods` on `target` in place so each call logs `<label>.<method>`
 * duration. In-place (not a Proxy) so object identity is preserved.
 */
export function instrumentMethods<T extends object>(target: T, label: string, methods: readonly string[]): T {
  if (!factoryTimingEnabled) return target;
  const record = target as Record<string, unknown>;
  for (const name of methods) {
    const original = record[name];
    if (typeof original !== 'function') continue;
    record[name] = (...args: unknown[]) => {
      const start = performance.now();
      const result = original.apply(target, args);
      if (result instanceof Promise) {
        return result.finally(() => logTiming(`${label}.${name} ${Math.round(performance.now() - start)}ms`));
      }
      return result;
    };
  }
  return target;
}

/**
 * Wrap every async method on `target` (and on the domains returned by a
 * `getDomain` method) so each call logs `<label>.<method>` duration. Returns
 * `target` unchanged when timing is disabled.
 */
export function instrumentAsyncMethods<T extends object>(target: T, label: string): T {
  if (!factoryTimingEnabled) return target;
  const wrapped = new Map<PropertyKey, unknown>();
  return new Proxy(target, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver);
      if (typeof value !== 'function' || typeof prop === 'symbol' || prop === 'constructor') return value;
      const cached = wrapped.get(prop);
      if (cached) return cached;
      const fn = (...args: unknown[]) => {
        const start = performance.now();
        const result = value.apply(obj, args);
        if (prop === 'getDomain' && result && typeof result === 'object' && !(result instanceof Promise)) {
          return instrumentAsyncMethods(result, `${label}.${String(args[0])}`);
        }
        if (result instanceof Promise) {
          return result.finally(() => logTiming(`${label}.${prop} ${Math.round(performance.now() - start)}ms`));
        }
        return result;
      };
      wrapped.set(prop, fn);
      return fn;
    },
  });
}

/** Run `fn`, always logging its duration under `phase`. Boot-phase use. */
export async function timedPhase<T>(phase: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    process.stderr.write(`[factory:timing] ${phase} ${Math.round(performance.now() - start)}ms\n`);
  }
}

/**
 * Run `fn`, logging only when it exceeds `thresholdMs`. Request-path use,
 * where per-request logging would be noise but slow outliers must surface.
 */
export async function timedAboveThreshold<T>(phase: string, thresholdMs: number, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const elapsed = performance.now() - start;
    if (elapsed > thresholdMs) {
      process.stderr.write(`[factory:timing] slow ${phase} ${Math.round(elapsed)}ms\n`);
    }
  }
}
