/**
 * Extends the lifetime of the request handler for the lifetime of the given {@link Promise}
 * @see https://developer.mozilla.org/en-US/docs/Web/API/ExtendableEvent/waitUntil
 *
 * @param promise The promise to wait for.
 * @example
 *
 * ```js
 * import { waitUntil } from '@vercel/functions';
 *
 * export function GET(request) {
 *   waitUntil(fetch('https://vercel.com'));
 *   return new Response('OK');
 * }
 * ```
 */
export declare const waitUntil: (promise: Promise<unknown>) => void | undefined;
