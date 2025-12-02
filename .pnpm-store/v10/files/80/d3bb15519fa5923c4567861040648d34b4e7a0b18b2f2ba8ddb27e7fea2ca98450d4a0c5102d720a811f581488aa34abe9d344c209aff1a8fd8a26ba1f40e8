export interface ModifiedRequest {
    /**
     * If set, overwrites the incoming headers to the origin request.
     *
     * This is useful when you want to pass data between a Middleware and a
     * Serverless or Edge Function.
     *
     * @example
     * <caption>Add a `x-user-id` header and remove the `Authorization` header</caption>
     *
     * ```ts
     * import { rewrite } from '@vercel/edge';
     * export default async function middleware(request: Request): Promise<Response> {
     *   const newHeaders = new Headers(request.headers);
     *   newHeaders.set('x-user-id', 'user_123');
     *   newHeaders.delete('authorization');
     *   return rewrite(request.url, {
     *     request: { headers: newHeaders }
     *   })
     * }
     * ```
     */
    headers?: Headers;
}
export interface ExtraResponseInit extends Omit<ResponseInit, 'headers'> {
    /**
     * These headers will be sent to the user response
     * along with the response headers from the origin.
     */
    headers?: HeadersInit;
    /**
     * Fields to rewrite for the upstream request.
     */
    request?: ModifiedRequest;
}
/**
 * Returns a response that rewrites the request to a different URL.
 *
 * @param destination new URL to rewrite the request to
 * @param init Additional options for the response
 *
 *
 * @example
 * <caption>Rewrite all feature-flagged requests from `/:path*` to `/experimental/:path*`</caption>
 *
 * ```ts
 * import { rewrite, next } from '@vercel/edge';
 *
 * export default async function middleware(req: Request) {
 *   const flagged = await getFlag(req, 'isExperimental');
 *   if (flagged) {
 *     const url = new URL(req.url);
 *     url.pathname = `/experimental{url.pathname}`;
 *     return rewrite(url);
 *   }
 *
 *   return next();
 * }
 * ```
 *
 * @example
 * <caption>JWT authentication for `/api/:path*` requests</caption>
 *
 * ```ts
 * import { rewrite, next } from '@vercel/edge';
 *
 * export default function middleware(req: Request) {
 *   const auth = checkJwt(req.headers.get('Authorization'));
 *   if (!checkJwt) {
 *     return rewrite(new URL('/api/error-unauthorized', req.url));
 *   }
 *   const url = new URL(req.url);
 *   url.searchParams.set('_userId', auth.userId);
 *   return rewrite(url);
 * }
 *
 * export const config = { matcher: '/api/users/:path*' };
 * ```
 */
export declare function rewrite(destination: string | URL, init?: ExtraResponseInit): Response;
/**
 * Returns a Response that instructs the system to continue processing the request.
 *
 * @param init Additional options for the response
 *
 * @example
 * <caption>No-op middleware</caption>
 *
 * ```ts
 * import { next } from '@vercel/edge';
 *
 * export default function middleware(_req: Request) {
 *   return next();
 * }
 * ```
 *
 * @example
 * <caption>Add response headers to all requests</caption>
 *
 * ```ts
 * import { next } from '@vercel/edge';
 *
 * export default function middleware(_req: Request) {
 *   return next({
 *     headers: { 'x-from-middleware': 'true' },
 *   })
 * }
 * ```
 */
export declare function next(init?: ExtraResponseInit): Response;
