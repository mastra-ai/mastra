import { HUB_URL } from "../consts";
import { createApiError } from "../error";

export interface OAuthResult {
	accessToken: string;
	accessTokenExpiresAt: Date;
	userInfo: {
		id: string;
		name: string;
		fullname: string;
		email?: string;
		emailVerified?: boolean;
		avatarUrl: string;
		websiteUrl?: string;
		isPro: boolean;
		canPay?: boolean;
		orgs: Array<{
			id: string;
			name: string;
			isEnterprise: boolean;
			canPay?: boolean;
			avatarUrl: string;
			roleInOrg?: string;
		}>;
	};
	/**
	 * State passed to the OAuth provider in the original request to the OAuth provider.
	 */
	state?: string;
	/**
	 * Granted scope
	 */
	scope: string;
}

/**
 * To call after the OAuth provider redirects back to the app.
 *
 * There is also a helper function {@link oauthHandleRedirectIfPresent}, which will call `oauthHandleRedirect` if the URL contains an oauth code
 * in the query parameters and return `false` otherwise.
 */
export async function oauthHandleRedirect(opts?: { hubUrl?: string }): Promise<OAuthResult> {
	if (typeof window === "undefined") {
		throw new Error("oauthHandleRedirect is only available in the browser");
	}

	const searchParams = new URLSearchParams(window.location.search);

	const [error, errorDescription] = [searchParams.get("error"), searchParams.get("error_description")];

	if (error) {
		throw new Error(`${error}: ${errorDescription}`);
	}

	const code = searchParams.get("code");
	const nonce = localStorage.getItem("huggingface.co:oauth:nonce");

	if (!code) {
		throw new Error("Missing oauth code from query parameters in redirected URL");
	}

	if (!nonce) {
		throw new Error("Missing oauth nonce from localStorage");
	}

	const codeVerifier = localStorage.getItem("huggingface.co:oauth:code_verifier");

	if (!codeVerifier) {
		throw new Error("Missing oauth code_verifier from localStorage");
	}

	const state = searchParams.get("state");

	if (!state) {
		throw new Error("Missing oauth state from query parameters in redirected URL");
	}

	let parsedState: { nonce: string; redirectUri: string; state?: string };

	try {
		parsedState = JSON.parse(state);
	} catch {
		throw new Error("Invalid oauth state in redirected URL, unable to parse JSON: " + state);
	}

	if (parsedState.nonce !== nonce) {
		throw new Error("Invalid oauth state in redirected URL");
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

	const tokenRes = await fetch(opendidConfig.token_endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			grant_type: "authorization_code",
			code,
			redirect_uri: parsedState.redirectUri,
			code_verifier: codeVerifier,
		}).toString(),
	});

	localStorage.removeItem("huggingface.co:oauth:code_verifier");
	localStorage.removeItem("huggingface.co:oauth:nonce");

	if (!tokenRes.ok) {
		throw await createApiError(tokenRes);
	}

	const token: {
		access_token: string;
		expires_in: number;
		id_token: string;
		// refresh_token: string;
		scope: string;
		token_type: string;
	} = await tokenRes.json();

	const accessTokenExpiresAt = new Date(Date.now() + token.expires_in * 1000);

	const userInfoRes = await fetch(opendidConfig.userinfo_endpoint, {
		headers: {
			Authorization: `Bearer ${token.access_token}`,
		},
	});

	if (!userInfoRes.ok) {
		throw await createApiError(userInfoRes);
	}

	const userInfo: {
		sub: string;
		name: string;
		preferred_username: string;
		email_verified?: boolean;
		email?: string;
		picture: string;
		website?: string;
		isPro: boolean;
		canPay?: boolean;
		orgs?: Array<{
			sub: string;
			name: string;
			picture: string;
			isEnterprise: boolean;
			canPay?: boolean;
			roleInOrg?: string;
		}>;
	} = await userInfoRes.json();

	return {
		accessToken: token.access_token,
		accessTokenExpiresAt,
		userInfo: {
			id: userInfo.sub,
			name: userInfo.name,
			fullname: userInfo.preferred_username,
			email: userInfo.email,
			emailVerified: userInfo.email_verified,
			avatarUrl: userInfo.picture,
			websiteUrl: userInfo.website,
			isPro: userInfo.isPro,
			orgs:
				userInfo.orgs?.map((org) => ({
					id: org.sub,
					name: org.name,
					fullname: org.name,
					isEnterprise: org.isEnterprise,
					canPay: org.canPay,
					avatarUrl: org.picture,
					roleInOrg: org.roleInOrg,
				})) ?? [],
		},
		state: parsedState.state,
		scope: token.scope,
	};
}

// if (code && !nonce) {
//   console.warn("Missing oauth nonce from localStorage");
// }

/**
 * To call after the OAuth provider redirects back to the app.
 *
 * It returns false if the URL does not contain an oauth code in the query parameters, otherwise
 * it calls {@link oauthHandleRedirect}.
 *
 * Depending on your app, you may want to call {@link oauthHandleRedirect} directly instead.
 */
export async function oauthHandleRedirectIfPresent(opts?: { hubUrl?: string }): Promise<OAuthResult | false> {
	if (typeof window === "undefined") {
		throw new Error("oauthHandleRedirect is only available in the browser");
	}

	const searchParams = new URLSearchParams(window.location.search);

	if (searchParams.has("error")) {
		return oauthHandleRedirect(opts);
	}

	if (searchParams.has("code")) {
		if (!localStorage.getItem("huggingface.co:oauth:nonce")) {
			console.warn(
				"Missing oauth nonce from localStorage. This can happen when the user refreshes the page after logging in, without changing the URL."
			);
			return false;
		}

		return oauthHandleRedirect(opts);
	}

	return false;
}
