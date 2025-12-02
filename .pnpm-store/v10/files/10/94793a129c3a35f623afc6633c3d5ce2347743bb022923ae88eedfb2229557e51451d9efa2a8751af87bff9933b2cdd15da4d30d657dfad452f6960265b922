import type { JwtReturnType } from './types';
export interface SignJwtOptions {
    algorithm?: string;
    header?: Record<string, unknown>;
}
/**
 * Signs a JSON Web Token (JWT) with the given payload, key, and options.
 * This function is intended to be used *internally* by other Clerk packages and typically
 * should not be used directly.
 *
 * @internal
 * @param payload The payload to include in the JWT.
 * @param key The key to use for signing the JWT. Can be a string or a JsonWebKey.
 * @param options The options to use for signing the JWT.
 * @returns A Promise that resolves to the signed JWT string.
 * @throws An error if no algorithm is specified or if the specified algorithm is unsupported.
 * @throws An error if there is an issue with importing the key or signing the JWT.
 */
export declare function signJwt(payload: Record<string, unknown>, key: string | JsonWebKey, options: SignJwtOptions): Promise<JwtReturnType<string, Error>>;
//# sourceMappingURL=signJwt.d.ts.map