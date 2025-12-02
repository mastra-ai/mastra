import z from "zod/v3";
const CreateSHA256CodeChallengeRequestSchema = z.object({
    /**
     * If not provided, a random code verifier will be generated.
     * If provided, must be 43-128 characters and contain only unreserved
     * characters [A-Za-z0-9-._~] per RFC 7636.
     */
    codeVerifier: z
        .string()
        .min(43, "Code verifier must be at least 43 characters")
        .max(128, "Code verifier must be at most 128 characters")
        .regex(/^[A-Za-z0-9\-._~]+$/, "Code verifier must only contain unreserved characters: [A-Za-z0-9-._~]")
        .optional(),
});
/**
 * Convert a Uint8Array to base64url encoding (RFC 4648)
 */
function arrayBufferToBase64Url(buffer) {
    let binary = "";
    for (let i = 0; i < buffer.length; i++) {
        binary += String.fromCharCode(buffer[i]);
    }
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}
/**
 * Generate a cryptographically random code verifier per RFC 7636
 */
function generateCodeVerifier() {
    // RFC 7636 recommends 32 octets of random data, base64url encoded = 43 chars
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    return arrayBufferToBase64Url(randomBytes);
}
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
export async function oAuthCreateSHA256CodeChallenge(params = {}) {
    const parsedParams = CreateSHA256CodeChallengeRequestSchema.safeParse(params);
    if (!parsedParams.success)
        return { ok: false, error: parsedParams.error };
    const { codeVerifier = generateCodeVerifier() } = parsedParams.data;
    // Generate SHA-256 hash
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const hash = await crypto.subtle.digest("SHA-256", data);
    // Convert hash to base64url
    const hashArray = new Uint8Array(hash);
    const codeChallenge = arrayBufferToBase64Url(hashArray);
    return {
        ok: true,
        value: {
            codeChallenge,
            codeVerifier,
        },
    };
}
//# sourceMappingURL=oAuthCreateSHA256CodeChallenge.js.map