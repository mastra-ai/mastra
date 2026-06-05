import type { Context } from 'hono';

/**
 * A platform-provided callback that keeps the current serverless invocation alive
 * until the given promise settles. Without it, serverless runtimes freeze the
 * invocation as soon as the handler returns, killing any in-flight background work.
 */
export type WaitUntilFn = (promise: Promise<unknown>) => void;

/**
 * User-supplied resolver that returns a `waitUntil` for the current request.
 *
 * Receives the request's Hono `Context` (optional — some resolvers don't need it,
 * e.g. `@vercel/functions`'s `waitUntil` uses AsyncLocalStorage). Channel providers
 * accept this on construction to support runtimes Hono doesn't bridge automatically
 * (Vercel, Netlify, custom platforms).
 *
 * @example
 * // Vercel
 * import { waitUntil } from '@vercel/functions';
 * new SlackProvider({ resolveWaitUntil: () => waitUntil });
 *
 * @example
 * // Cloudflare Workers (explicit; usually unneeded since core resolves this by default)
 * new SlackProvider({
 *   resolveWaitUntil: (c) => c?.executionCtx?.waitUntil?.bind(c.executionCtx),
 * });
 */
export type WaitUntilResolver = (c?: Context) => WaitUntilFn | undefined;

/**
 * Resolve `waitUntil` from a Hono context's `executionCtx`.
 *
 * Hono populates `c.executionCtx` only when the runtime hands it an ExecutionContext
 * (Cloudflare Workers' `app.fetch(req, env, ctx)` convention). Vercel and Netlify's
 * Hono adapters do NOT bridge the platform's `waitUntil` here — on those runtimes the
 * user should import `waitUntil` from `@vercel/functions` (or read it off the Netlify
 * `Context`) and pass it through a constructor option instead.
 *
 * Hono's `executionCtx` getter throws in Node.js when no ExecutionContext exists,
 * so the access must be guarded by try/catch.
 *
 * @returns A bound `waitUntil` function when the runtime provides one, otherwise undefined.
 */
export function resolveWaitUntil(c: Context): WaitUntilFn | undefined {
  let execCtx: { waitUntil?: WaitUntilFn } | undefined;
  try {
    execCtx = c.executionCtx as { waitUntil?: WaitUntilFn } | undefined;
  } catch {
    execCtx = undefined;
  }
  return execCtx?.waitUntil?.bind(execCtx);
}
