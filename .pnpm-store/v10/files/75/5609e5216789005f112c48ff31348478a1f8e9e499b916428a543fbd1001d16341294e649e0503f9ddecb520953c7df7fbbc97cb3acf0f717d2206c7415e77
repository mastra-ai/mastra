import z from "zod/v3";
import { serverURLFromOptions } from "../lib/config.js";
const CreateAuthorizationUrlBaseSchema = z.object({
    callbackUrl: z.union([z.string().url(), z.instanceof(URL)]),
    limit: z.number().optional(),
});
const CreateAuthorizationurlParamsSchema = z.union([
    CreateAuthorizationUrlBaseSchema.extend({
        codeChallengeMethod: z.enum(["S256", "plain"]),
        codeChallenge: z.string(),
    }),
    CreateAuthorizationUrlBaseSchema,
]);
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
export function oAuthCreateAuthorizationUrl(client, params) {
    const parsedParams = CreateAuthorizationurlParamsSchema.safeParse(params);
    if (!parsedParams.success)
        return { ok: false, error: parsedParams.error };
    const baseURL = serverURLFromOptions(client._options);
    if (!baseURL) {
        return { ok: false, error: new Error("No server URL configured") };
    }
    // Clone the URL to avoid mutating the original
    const authURL = new URL("/auth", baseURL);
    authURL.searchParams.set("callback_url", parsedParams.data.callbackUrl.toString());
    if ("codeChallengeMethod" in parsedParams.data) {
        authURL.searchParams.set("code_challenge", parsedParams.data.codeChallenge);
        authURL.searchParams.set("code_challenge_method", parsedParams.data.codeChallengeMethod);
    }
    if (parsedParams.data.limit !== undefined) {
        authURL.searchParams.set("limit", parsedParams.data.limit.toString());
    }
    return { ok: true, value: authURL.toString() };
}
//# sourceMappingURL=oAuthCreateAuthorizationUrl.js.map