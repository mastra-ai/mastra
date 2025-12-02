import z from "zod/v3";
import { OpenRouterCore } from "../core.js";
import { Result } from "../types/fp.js";
declare const CreateAuthorizationurlParamsSchema: z.ZodUnion<[z.ZodObject<{
    callbackUrl: z.ZodUnion<[z.ZodString, z.ZodType<URL, z.ZodTypeDef, URL>]>;
    limit: z.ZodOptional<z.ZodNumber>;
} & {
    codeChallengeMethod: z.ZodEnum<["S256", "plain"]>;
    codeChallenge: z.ZodString;
}, "strip", z.ZodTypeAny, {
    callbackUrl: string | URL;
    codeChallenge: string;
    codeChallengeMethod: "S256" | "plain";
    limit?: number | undefined;
}, {
    callbackUrl: string | URL;
    codeChallenge: string;
    codeChallengeMethod: "S256" | "plain";
    limit?: number | undefined;
}>, z.ZodObject<{
    callbackUrl: z.ZodUnion<[z.ZodString, z.ZodType<URL, z.ZodTypeDef, URL>]>;
    limit: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    callbackUrl: string | URL;
    limit?: number | undefined;
}, {
    callbackUrl: string | URL;
    limit?: number | undefined;
}>]>;
export type CreateAuthorizationUrlRequest = z.infer<typeof CreateAuthorizationurlParamsSchema>;
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
export declare function oAuthCreateAuthorizationUrl(client: OpenRouterCore, params: CreateAuthorizationUrlRequest): Result<string>;
export {};
//# sourceMappingURL=oAuthCreateAuthorizationUrl.d.ts.map