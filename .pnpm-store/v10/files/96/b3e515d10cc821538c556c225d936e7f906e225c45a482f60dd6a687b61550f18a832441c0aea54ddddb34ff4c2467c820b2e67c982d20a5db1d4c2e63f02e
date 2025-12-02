import { HUB_URL } from "../consts";
import { createApiError } from "../error";
import { base64FromBytes } from "../utils/base64FromBytes";

/**
 * Use "Sign in with Hub" to authenticate a user, and get oauth user info / access token.
 *
 * Returns an url to redirect to. After the user is redirected back to your app, call `oauthHandleRedirect` to get the oauth user info / access token.
 *
 * When called from inside a static Space with OAuth enabled, it will load the config from the space, otherwise you need to at least specify
 * the client ID of your OAuth App.
 *
 * @example
 * ```ts
 * import { oauthLoginUrl, oauthHandleRedirectIfPresent } from "@huggingface/hub";
 *
 * const oauthResult = await oauthHandleRedirectIfPresent();
 *
 * if (!oauthResult) {
 *   // If the user is not logged in, redirect to the login page
 *   window.location.href = await oauthLoginUrl();
 * }
 *
 * // You can use oauthResult.accessToken, oauthResult.accessTokenExpiresAt and oauthResult.userInfo
 * console.log(oauthResult);
 * ```
 *
 * (Theoretically, this function could be used to authenticate a user for any OAuth provider supporting PKCE and OpenID Connect by changing `hubUrl`,
 * but it is currently only tested with the Hugging Face Hub.)
 */
export async function oauthLoginUrl(opts?: {
	/**
	 * OAuth client ID.
	 *
	 * For static Spaces, you can omit this and it will be loaded from the Space config, as long as `hf_oauth: true` is present in the README.md's metadata.
	 * For other Spaces, it is available to the backend in the OAUTH_CLIENT_ID environment variable, as long as `hf_oauth: true` is present in the README.md's metadata.
	 *
	 * You can also create a Developer Application at https://huggingface.co/settings/connected-applications and use its client ID.
	 */
	clientId?: string;
	hubUrl?: string;
	/**
	 * OAuth scope, a list of space separate scopes.
	 *
	 * For static Spaces, you can omit this and it will be loaded from the Space config, as long as `hf_oauth: true` is present in the README.md's metadata.
	 * For other Spaces, it is available to the backend in the OAUTH_SCOPES environment variable, as long as `hf_oauth: true` is present in the README.md's metadata.
	 *
	 * Defaults to "openid profile".
	 *
	 * You can also create a Developer Application at https://huggingface.co/settings/connected-applications and use its scopes.
	 *
	 * See https://huggingface.co/docs/hub/oauth for a list of available scopes.
	 */
	scopes?: string;
	/**
	 * Redirect URI, defaults to the current URL.
	 *
	 * For Spaces, any URL within the Space is allowed.
	 *
	 * For Developer Applications, you can add any URL you want to the list of allowed redirect URIs at https://huggingface.co/settings/connected-applications.
	 */
	redirectUrl?: string;
	/**
	 * State to pass to the OAuth provider, which will be returned in the call to `oauthLogin` after the redirect.
	 */
	state?: string;
}): Promise<string> {
	if (typeof window === "undefined") {
		throw new Error("oauthLogin is only available in the browser");
	}

	const hubUrl = opts?.hubUrl || HUB_URL;
	const openidConfigUrl = `${new URL(hubUrl).origin}/.well-known/openid-configuration`;
	const openidConfigRes = await fetch(openidConfigUrl, {
		headers: {
			Accept: "application/json",
		},
	});

	if (!openidConfigRes.ok) {
		throw await createApiError(openidConfigRes);
	}

	const opendidConfig: {
		authorization_endpoint: string;
		token_endpoint: string;
		userinfo_endpoint: string;
	} = await openidConfigRes.json();

	const newNonce = globalThis.crypto.randomUUID();
	// Two random UUIDs concatenated together, because min length is 43 and max length is 128
	const newCodeVerifier = globalThis.crypto.randomUUID() + globalThis.crypto.randomUUID();

	localStorage.setItem("huggingface.co:oauth:nonce", newNonce);
	localStorage.setItem("huggingface.co:oauth:code_verifier", newCodeVerifier);

	const redirectUri = opts?.redirectUrl || window.location.href;
	const state = JSON.stringify({
		nonce: newNonce,
		redirectUri,
		state: opts?.state,
	});

	// @ts-expect-error window.huggingface is defined inside static Spaces.
	const variables: Record<string, string> | null = window?.huggingface?.variables ?? null;

	const clientId = opts?.clientId || variables?.OAUTH_CLIENT_ID;

	if (!clientId) {
		if (variables) {
			throw new Error("Missing clientId, please add hf_oauth: true to the README.md's metadata in your static Space");
		}
		throw new Error("Missing clientId");
	}

	const challenge = base64FromBytes(
		new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(newCodeVerifier)))
	)
		.replace(/[+]/g, "-")
		.replace(/[/]/g, "_")
		.replace(/=/g, "");

	return `${opendidConfig.authorization_endpoint}?${new URLSearchParams({
		client_id: clientId,
		scope: opts?.scopes || variables?.OAUTH_SCOPES || "openid profile",
		response_type: "code",
		redirect_uri: redirectUri,
		state,
		code_challenge: challenge,
		code_challenge_method: "S256",
	}).toString()}`;
}
