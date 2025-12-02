import { ClientSDK, RequestOptions } from "../lib/sdks.js";
import * as operations from "../models/operations/index.js";
import { CreateAuthorizationUrlRequest } from "../funcs/oAuthCreateAuthorizationUrl.js";
import { CreateSHA256CodeChallengeResponse } from "../funcs/oAuthCreateSHA256CodeChallenge.js";
export declare class OAuth extends ClientSDK {
    /**
     * Generate a OAuth2 authorization URL
     *
     * @remarks
     * Generates a URL to redirect users to for authorizing your application. The
     * URL includes the provided callback URL and, if applicable, the code
     * challenge parameters for PKCE.
     *
     * @see {@link https://openrouter.ai/docs/use-cases/oauth-pkce}
     */
    createAuthorizationUrl(request: CreateAuthorizationUrlRequest): Promise<string>;
    /**
     * Generate a SHA-256 code challenge for PKCE
     *
     * @remarks
     * Generates a SHA-256 code challenge and corresponding code verifier for use
     * in the PKCE extension to OAuth2. If no code verifier is provided, a random
     * one will be generated according to RFC 7636 (32 random bytes, base64url
     * encoded). If a code verifier is provided, it must be 43-128 characters and
     * contain only unreserved characters [A-Za-z0-9-._~].
     *
     * @see {@link https://openrouter.ai/docs/use-cases/oauth-pkce}
     * @see {@link https://datatracker.ietf.org/doc/html/rfc7636}
     */
    createSHA256CodeChallenge(): Promise<CreateSHA256CodeChallengeResponse>;
    /**
     * Exchange authorization code for API key
     *
     * @remarks
     * Exchange an authorization code from the PKCE flow for a user-controlled API key
     */
    exchangeAuthCodeForAPIKey(request: operations.ExchangeAuthCodeForAPIKeyRequest, options?: RequestOptions): Promise<operations.ExchangeAuthCodeForAPIKeyResponse>;
    /**
     * Create authorization code
     *
     * @remarks
     * Create an authorization code for the PKCE flow to generate a user-controlled API key
     */
    createAuthCode(request: operations.CreateAuthKeysCodeRequest, options?: RequestOptions): Promise<operations.CreateAuthKeysCodeResponse>;
}
//# sourceMappingURL=oauth.d.ts.map