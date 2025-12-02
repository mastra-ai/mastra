import type { JwtPayload } from '@clerk/types';
import { TokenVerificationError } from '../errors';
import type { VerifyJwtOptions } from '../jwt';
import type { JwtReturnType } from '../jwt/types';
import type { LoadClerkJWKFromRemoteOptions } from './keys';
/**
 * @interface
 */
export type VerifyTokenOptions = Omit<VerifyJwtOptions, 'key'> & Omit<LoadClerkJWKFromRemoteOptions, 'kid'> & {
    /**
     * Used to verify the session token in a networkless manner. Supply the PEM public key from the **[**API keys**](https://dashboard.clerk.com/last-active?path=api-keys) page -> Show JWT public key -> PEM Public Key** section in the Clerk Dashboard. **It's recommended to use [the environment variable](https://clerk.com/docs/deployments/clerk-environment-variables) instead.** For more information, refer to [Manual JWT verification](https://clerk.com/docs/backend-requests/manual-jwt).
     */
    jwtKey?: string;
};
/**
 * > [!WARNING]
 * > This is a lower-level method intended for more advanced use-cases. It's recommended to use [`authenticateRequest()`](https://clerk.com/docs/references/backend/authenticate-request), which fully authenticates a token passed from the `request` object.
 *
 * Verifies a Clerk-generated token signature. Networkless if the `jwtKey` is provided. Otherwise, performs a network call to retrieve the JWKS from the [Backend API](https://clerk.com/docs/reference/backend-api/tag/JWKS#operation/GetJWKS){{ target: '_blank' }}.
 *
 * @param token - The token to verify.
 * @param options - Options for verifying the token.
 *
 * @example
 *
 * The following example demonstrates how to use the [JavaScript Backend SDK](https://clerk.com/docs/references/backend/overview) to verify the token signature.
 *
 * In the following example:
 *
 * 1. The **JWKS Public Key** from the Clerk Dashboard is set in the environment variable `CLERK_JWT_KEY`.
 * 1. The session token is retrieved from the `__session` cookie or the Authorization header.
 * 1. The token is verified in a networkless manner by passing the `jwtKey` prop.
 * 1. The `authorizedParties` prop is passed to verify that the session token is generated from the expected frontend application.
 * 1. If the token is valid, the response contains the verified token.
 *
 * ```ts
 * import { verifyToken } from '@clerk/backend'
 * import { cookies } from 'next/headers'
 *
 * export async function GET(request: Request) {
 *   const cookieStore = cookies()
 *   const sessToken = cookieStore.get('__session')?.value
 *   const bearerToken = request.headers.get('Authorization')?.replace('Bearer ', '')
 *   const token = sessToken || bearerToken
 *
 *   if (!token) {
 *     return Response.json({ error: 'Token not found. User must sign in.' }, { status: 401 })
 *   }
 *
 *   try {
 *     const verifiedToken = await verifyToken(token, {
 *       jwtKey: process.env.CLERK_JWT_KEY,
 *       authorizedParties: ['http://localhost:3001', 'api.example.com'], // Replace with your authorized parties
 *     })
 *
 *     return Response.json({ verifiedToken })
 *   } catch (error) {
 *     return Response.json({ error: 'Token not verified.' }, { status: 401 })
 *   }
 * }
 * ```
 *
 * If the token is valid, the response will contain a JSON object that looks something like this:
 *
 * ```json
 * {
 *   "verifiedToken": {
 *     "azp": "http://localhost:3000",
 *     "exp": 1687906422,
 *     "iat": 1687906362,
 *     "iss": "https://magical-marmoset-51.clerk.accounts.dev",
 *     "nbf": 1687906352,
 *     "sid": "sess_2Ro7e2IxrffdqBboq8KfB6eGbIy",
 *     "sub": "user_2RfWKJREkjKbHZy0Wqa5qrHeAnb"
 *   }
 * }
 * ```
 */
export declare function verifyToken(token: string, options: VerifyTokenOptions): Promise<JwtReturnType<JwtPayload, TokenVerificationError>>;
//# sourceMappingURL=verify.d.ts.map