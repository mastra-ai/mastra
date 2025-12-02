/**
 *
 * Loads a local PEM key usually from process.env and transform it to JsonWebKey format.
 * The result is also cached on the module level to avoid unnecessary computations in subsequent invocations.
 *
 * @param {string} localKey
 * @returns {JsonWebKey} key
 */
export declare function loadClerkJWKFromLocal(localKey?: string): JsonWebKey;
/**
 * @internal
 */
export type LoadClerkJWKFromRemoteOptions = {
    /**
     * @internal
     */
    kid: string;
    /**
     * @deprecated This cache TTL will be removed in the next major version. Specifying a cache TTL is a no-op.
     */
    jwksCacheTtlInMs?: number;
    /**
     * A flag to ignore the JWKS cache and always fetch JWKS before each JWT verification.
     */
    skipJwksCache?: boolean;
    /**
     * The Clerk Secret Key from the [**API keys**](https://dashboard.clerk.com/last-active?path=api-keys) page in the Clerk Dashboard.
     */
    secretKey?: string;
    /**
     * The [Clerk Backend API](https://clerk.com/docs/reference/backend-api){{ target: '_blank' }} endpoint.
     * @default 'https://api.clerk.com'
     */
    apiUrl?: string;
    /**
     * The version passed to the Clerk API.
     * @default 'v1'
     */
    apiVersion?: string;
};
/**
 *
 * Loads a key from JWKS retrieved from the well-known Frontend API endpoint of the issuer.
 * The result is also cached on the module level to avoid network requests in subsequent invocations.
 * The cache lasts up to 5 minutes.
 *
 * @param {Object} options
 * @param {string} options.kid - The id of the key that the JWT was signed with
 * @param {string} options.alg - The algorithm of the JWT
 * @returns {JsonWebKey} key
 */
export declare function loadClerkJWKFromRemote({ secretKey, apiUrl, apiVersion, kid, skipJwksCache, }: LoadClerkJWKFromRemoteOptions): Promise<JsonWebKey>;
//# sourceMappingURL=keys.d.ts.map