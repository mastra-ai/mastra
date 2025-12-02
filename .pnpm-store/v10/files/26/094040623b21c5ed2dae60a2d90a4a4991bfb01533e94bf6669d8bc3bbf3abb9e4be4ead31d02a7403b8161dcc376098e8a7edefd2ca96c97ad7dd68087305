import z from "zod/v3";
import { Result } from "../types/fp.js";
declare const CreateSHA256CodeChallengeRequestSchema: z.ZodObject<{
    /**
     * If not provided, a random code verifier will be generated.
     * If provided, must be 43-128 characters and contain only unreserved
     * characters [A-Za-z0-9-._~] per RFC 7636.
     */
    codeVerifier: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    codeVerifier?: string | undefined;
}, {
    codeVerifier?: string | undefined;
}>;
export type CreateSHA256CodeChallengeRequest = z.infer<typeof CreateSHA256CodeChallengeRequestSchema>;
export type CreateSHA256CodeChallengeResponse = {
    codeChallenge: string;
    codeVerifier: string;
};
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
export declare function oAuthCreateSHA256CodeChallenge(params?: CreateSHA256CodeChallengeRequest): Promise<Result<CreateSHA256CodeChallengeResponse>>;
export {};
//# sourceMappingURL=oAuthCreateSHA256CodeChallenge.d.ts.map