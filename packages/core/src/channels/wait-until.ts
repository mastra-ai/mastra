import type { Context } from 'hono';

/**
 * A platform-provided callback that keeps the current serverless invocation alive
 * until the given promise settles. Without it, serverless runtimes freeze the
 * invocation as soon as the handler returns, killing any in-flight background work.
 */
export type WaitUntilFn = (promise: Promise<unknown>) => void;

/**
 * Function that takes the request's Hono `Context` and returns a `waitUntil` for
 * the current request, or undefined.
 *
 * Use this when the runtime exposes `waitUntil` through the request context and
 * Mastra's default resolver doesn't cover it (Cloudflare Workers and Netlify are
 * handled automatically; this is the escape hatch for custom adapters).
 */
export type WaitUntilResolver = (c: Context) => WaitUntilFn | undefined;

/**
 * Resolve `waitUntil` from the Hono context using runtime-specific conventions.
 *
 * Lookup order:
 *  1. Cloudflare Workers — `c.executionCtx.waitUntil` (Hono populates this when
 *     the runtime hands `app.fetch(req, env, ctx)` the third arg).
 *  2. Netlify Functions — `c.env.context.waitUntil` (`hono/netlify` adapter
 *     forwards Netlify's per-request `context` as Hono's `env`).
 *
 * Vercel's `waitUntil` lives in `@vercel/functions` and uses AsyncLocalStorage,
 * not the request context — users on Vercel must pass `waitUntil` explicitly via
 * the channel option.
 *
 * Hono's `executionCtx` getter throws in Node.js when no ExecutionContext exists,
 * so the access must be guarded by try/catch.
 *
 * @returns A bound `waitUntil` function when the runtime provides one, otherwise undefined.
 */
export function resolveWaitUntil(c: Context): WaitUntilFn | undefined {
  // 1. Cloudflare Workers (and anything else that bridges executionCtx through Hono)
  let execCtx: { waitUntil?: WaitUntilFn } | undefined;
  try {
    execCtx = c.executionCtx as { waitUntil?: WaitUntilFn } | undefined;
  } catch {
    execCtx = undefined;
  }
  if (typeof execCtx?.waitUntil === 'function') {
    return execCtx.waitUntil.bind(execCtx);
  }

  // 2. Netlify Functions (hono/netlify forwards Netlify's per-request context as env)
  const netlifyCtx = (c.env as { context?: { waitUntil?: WaitUntilFn } } | undefined)?.context;
  if (typeof netlifyCtx?.waitUntil === 'function') {
    return netlifyCtx.waitUntil.bind(netlifyCtx);
  }

  return undefined;
}
