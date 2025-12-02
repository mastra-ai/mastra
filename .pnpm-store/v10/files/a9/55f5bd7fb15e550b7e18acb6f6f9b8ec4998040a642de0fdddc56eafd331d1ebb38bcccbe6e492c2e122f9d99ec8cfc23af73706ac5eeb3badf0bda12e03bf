/**
 * @module
 * Trailing Slash Middleware for Hono.
 */
import type { MiddlewareHandler } from '../../types';
/**
 * Trailing Slash Middleware for Hono.
 *
 * @see {@link https://hono.dev/docs/middleware/builtin/trailing-slash}
 *
 * @returns {MiddlewareHandler} The middleware handler function.
 *
 * @example
 * ```ts
 * const app = new Hono()
 *
 * app.use(trimTrailingSlash())
 * app.get('/about/me/', (c) => c.text('With Trailing Slash'))
 * ```
 */
export declare const trimTrailingSlash: () => MiddlewareHandler;
/**
 * Append trailing slash middleware for Hono.
 * Append a trailing slash to the URL if it doesn't have one. For example, `/path/to/page` will be redirected to `/path/to/page/`.
 *
 * @see {@link https://hono.dev/docs/middleware/builtin/trailing-slash}
 *
 * @returns {MiddlewareHandler} The middleware handler function.
 *
 * @example
 * ```ts
 * const app = new Hono()
 *
 * app.use(appendTrailingSlash())
 * ```
 */
export declare const appendTrailingSlash: () => MiddlewareHandler;
