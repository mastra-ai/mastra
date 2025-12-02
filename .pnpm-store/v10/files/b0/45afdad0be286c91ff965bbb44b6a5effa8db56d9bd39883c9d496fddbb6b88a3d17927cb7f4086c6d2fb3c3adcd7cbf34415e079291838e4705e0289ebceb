/**
 * Returns the OIDC token from the request context or the environment variable.
 *
 * This function first checks if the OIDC token is available in the environment variable
 * `VERCEL_OIDC_TOKEN`. If it is not found there, it retrieves the token from the request
 * context headers.
 *
 * @returns {Promise<string>} A promise that resolves to the OIDC token.
 * @throws {Error} If the `x-vercel-oidc-token` header is missing from the request context and the environment variable `VERCEL_OIDC_TOKEN` is not set.
 *
 * @example
 *
 * ```js
 * // Using the OIDC token
 * getVercelOidcToken().then((token) => {
 *   console.log('OIDC Token:', token);
 * }).catch((error) => {
 *   console.error('Error:', error.message);
 * });
 * ```
 */
export declare function getVercelOidcToken(): Promise<string>;
