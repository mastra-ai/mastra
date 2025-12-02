import type { KeyLike, JWSHeaderParameters, FlattenedJWSInput, JSONWebKeySet } from '../types';
/**
 * This is an experimental feature, it is not subject to semantic versioning rules. Non-backward
 * compatible changes or removal may occur in any future release.
 *
 * DANGER ZONE - This option has security implications that must be understood, assessed for
 * applicability, and accepted before use. It is critical that the JSON Web Key Set cache only be
 * writable by your own code.
 *
 * This option is intended for cloud computing runtimes that cannot keep an in memory cache between
 * their code's invocations. Use in runtimes where an in memory cache between requests is available
 * is not desirable.
 *
 * When passed to {@link jwks/remote.createRemoteJWKSet createRemoteJWKSet} this allows the passed in
 * object to:
 *
 * - Serve as an initial value for the JSON Web Key Set that the module would otherwise need to
 *   trigger an HTTP request for
 * - Have the JSON Web Key Set the function optionally ended up triggering an HTTP request for
 *   assigned to it as properties
 *
 * The intended use pattern is:
 *
 * - Before verifying with {@link jwks/remote.createRemoteJWKSet createRemoteJWKSet} you pull the
 *   previously cached object from a low-latency key-value store offered by the cloud computing
 *   runtime it is executed on;
 * - Default to an empty object `{}` instead when there's no previously cached value;
 * - Pass it in as {@link RemoteJWKSetOptions[experimental_jwksCache]};
 * - Afterwards, update the key-value storage if the {@link ExportedJWKSCache.uat `uat`} property of
 *   the object has changed.
 *
 * import * as jose from 'jose'
 *
 * // Prerequisites
 * let url!: URL
 * let jwt!: string
 *
 * // Load JSON Web Key Set cache
 * const jwksCache: jose.JWKSCacheInput = (await getPreviouslyCachedJWKS()) || {}
 * const { uat } = jwksCache
 *
 * const JWKS = jose.createRemoteJWKSet(url, {
 *   [jose.experimental_jwksCache]: jwksCache,
 * })
 *
 * // Use JSON Web Key Set cache
 * await jose.jwtVerify(jwt, JWKS)
 *
 * if (uat !== jwksCache.uat) {
 *   // Update JSON Web Key Set cache
 *   await storeNewJWKScache(jwksCache)
 * }
 * ```
 */
export declare const experimental_jwksCache: unique symbol;
/** Options for the remote JSON Web Key Set. */
export interface RemoteJWKSetOptions {
    /**
     * Timeout (in milliseconds) for the HTTP request. When reached the request will be aborted and
     * the verification will fail. Default is 5000 (5 seconds).
     */
    timeoutDuration?: number;
    /**
     * Duration (in milliseconds) for which no more HTTP requests will be triggered after a previous
     * successful fetch. Default is 30000 (30 seconds).
     */
    cooldownDuration?: number;
    /**
     * Maximum time (in milliseconds) between successful HTTP requests. Default is 600000 (10
     * minutes).
     */
    cacheMaxAge?: number | typeof Infinity;
    /**
     * An instance of {@link https://nodejs.org/api/http.html#class-httpagent http.Agent} or
     * {@link https://nodejs.org/api/https.html#class-httpsagent https.Agent} to pass to the
     * {@link https://nodejs.org/api/http.html#httpgetoptions-callback http.get} or
     * {@link https://nodejs.org/api/https.html#httpsgetoptions-callback https.get} method's options.
     * Use when behind an http(s) proxy. This is a Node.js runtime specific option, it is ignored when
     * used outside of Node.js runtime.
     */
    agent?: any;
    /**
     * Headers to be sent with the HTTP request. Default is that `User-Agent: jose/v${version}` header
     * is added unless the runtime is a browser in which adding an explicit headers fetch
     * configuration would cause an unnecessary CORS preflight request.
     */
    headers?: Record<string, string>;
    /** See {@link experimental_jwksCache}. */
    [experimental_jwksCache]?: JWKSCacheInput;
}
export interface ExportedJWKSCache {
    jwks: JSONWebKeySet;
    uat: number;
}
export type JWKSCacheInput = ExportedJWKSCache | Record<string, never>;
/**
 * Returns a function that resolves a JWS JOSE Header to a public key object downloaded from a
 * remote endpoint returning a JSON Web Key Set, that is, for example, an OAuth 2.0 or OIDC
 * jwks_uri. The JSON Web Key Set is fetched when no key matches the selection process but only as
 * frequently as the `cooldownDuration` option allows to prevent abuse.
 *
 * It uses the "alg" (JWS Algorithm) Header Parameter to determine the right JWK "kty" (Key Type),
 * then proceeds to match the JWK "kid" (Key ID) with one found in the JWS Header Parameters (if
 * there is one) while also respecting the JWK "use" (Public Key Use) and JWK "key_ops" (Key
 * Operations) Parameters (if they are present on the JWK).
 *
 * Only a single public key must match the selection process. As shown in the example below when
 * multiple keys get matched it is possible to opt-in to iterate over the matched keys and attempt
 * verification in an iterative manner.
 *
 * Note: The function's purpose is to resolve public keys used for verifying signatures and will not
 * work for public encryption keys.
 *
 * @param url URL to fetch the JSON Web Key Set from.
 * @param options Options for the remote JSON Web Key Set.
 */
export declare function createRemoteJWKSet<KeyLikeType extends KeyLike = KeyLike>(url: URL, options?: RemoteJWKSetOptions): {
    (protectedHeader?: JWSHeaderParameters, token?: FlattenedJWSInput): Promise<KeyLikeType>;
    /** @ignore */
    coolingDown: boolean;
    /** @ignore */
    fresh: boolean;
    /** @ignore */
    reloading: boolean;
    /** @ignore */
    reload: () => Promise<void>;
    /** @ignore */
    jwks: () => JSONWebKeySet | undefined;
};
