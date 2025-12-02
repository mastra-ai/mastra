import type { Jwt, JwtPayload } from '@clerk/types';
import { TokenVerificationError } from '../errors';
import type { JwtReturnType } from './types';
export declare function hasValidSignature(jwt: Jwt, key: JsonWebKey | string): Promise<JwtReturnType<boolean, Error>>;
export declare function decodeJwt(token: string): JwtReturnType<Jwt, TokenVerificationError>;
/**
 * @inline
 */
export type VerifyJwtOptions = {
    /**
     * A string or list of [audiences](https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.3). If passed, it is checked against the `aud` claim in the token.
     */
    audience?: string | string[];
    /**
     * An allowlist of origins to verify against, to protect your application from the subdomain cookie leaking attack.
     * @example
     * ```ts
     * ['http://localhost:3000', 'https://example.com']
     * ```
     */
    authorizedParties?: string[];
    /**
     * Specifies the allowed time difference (in milliseconds) between the Clerk server (which generates the token) and the clock of the user's application server when validating a token.
     * @default 5000
     */
    clockSkewInMs?: number;
    /**
     * @internal
     */
    key: JsonWebKey | string;
};
export declare function verifyJwt(token: string, options: VerifyJwtOptions): Promise<JwtReturnType<JwtPayload, TokenVerificationError>>;
//# sourceMappingURL=verifyJwt.d.ts.map