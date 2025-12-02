/**
 * @module
 * Basic Auth Middleware for Hono.
 */
import type { Context } from '../../context';
import type { MiddlewareHandler } from '../../types';
type MessageFunction = (c: Context) => string | object | Promise<string | object>;
type BasicAuthOptions = {
    username: string;
    password: string;
    realm?: string;
    hashFunction?: Function;
    invalidUserMessage?: string | object | MessageFunction;
} | {
    verifyUser: (username: string, password: string, c: Context) => boolean | Promise<boolean>;
    realm?: string;
    hashFunction?: Function;
    invalidUserMessage?: string | object | MessageFunction;
};
/**
 * Basic Auth Middleware for Hono.
 *
 * @see {@link https://hono.dev/docs/middleware/builtin/basic-auth}
 *
 * @param {BasicAuthOptions} options - The options for the basic authentication middleware.
 * @param {string} options.username - The username for authentication.
 * @param {string} options.password - The password for authentication.
 * @param {string} [options.realm="Secure Area"] - The realm attribute for the WWW-Authenticate header.
 * @param {Function} [options.hashFunction] - The hash function used for secure comparison.
 * @param {Function} [options.verifyUser] - The function to verify user credentials.
 * @param {string | object | MessageFunction} [options.invalidUserMessage="Unauthorized"] - The invalid user message.
 * @returns {MiddlewareHandler} The middleware handler function.
 * @throws {HTTPException} If neither "username and password" nor "verifyUser" options are provided.
 *
 * @example
 * ```ts
 * const app = new Hono()
 *
 * app.use(
 *   '/auth/*',
 *   basicAuth({
 *     username: 'hono',
 *     password: 'ahotproject',
 *   })
 * )
 *
 * app.get('/auth/page', (c) => {
 *   return c.text('You are authorized')
 * })
 * ```
 */
export declare const basicAuth: (options: BasicAuthOptions, ...users: {
    username: string;
    password: string;
}[]) => MiddlewareHandler;
export {};
