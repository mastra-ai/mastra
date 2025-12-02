import { i as parseState, r as generateState } from "./utils-DBbaShi0.mjs";
import { O as handleOAuthUserInfo } from "./api-q2sbQ7PT.mjs";
import { c as setSessionCookie } from "./cookies-D_dksn7B.mjs";
import { u as sessionMiddleware } from "./session-CgfX4vv1.mjs";
import { BASE_ERROR_CODES } from "@better-auth/core/error";
import { createAuthorizationURL, refreshAccessToken, validateAuthorizationCode } from "@better-auth/core/oauth2";
import { defineErrorCodes } from "@better-auth/core/utils";
import { APIError } from "better-call";
import * as z from "zod";
import { decodeJwt } from "jose";
import { createAuthEndpoint } from "@better-auth/core/api";
import { betterFetch } from "@better-fetch/fetch";

//#region src/plugins/generic-oauth/error-codes.ts
const GENERIC_OAUTH_ERROR_CODES = defineErrorCodes({
	INVALID_OAUTH_CONFIGURATION: "Invalid OAuth configuration",
	TOKEN_URL_NOT_FOUND: "Invalid OAuth configuration. Token URL not found.",
	PROVIDER_CONFIG_NOT_FOUND: "No config found for provider",
	PROVIDER_ID_REQUIRED: "Provider ID is required",
	INVALID_OAUTH_CONFIG: "Invalid OAuth configuration.",
	SESSION_REQUIRED: "Session is required"
});

//#endregion
//#region src/plugins/generic-oauth/providers/auth0.ts
/**
* Auth0 OAuth provider helper
*
* @example
* ```ts
* import { genericOAuth, auth0 } from "better-auth/plugins/generic-oauth";
*
* export const auth = betterAuth({
*   plugins: [
*     genericOAuth({
*       config: [
*         auth0({
*           clientId: process.env.AUTH0_CLIENT_ID,
*           clientSecret: process.env.AUTH0_CLIENT_SECRET,
*           domain: process.env.AUTH0_DOMAIN,
*         }),
*       ],
*     }),
*   ],
* });
* ```
*/
function auth0(options) {
	const defaultScopes = [
		"openid",
		"profile",
		"email"
	];
	const domain = options.domain.replace(/^https?:\/\//, "");
	const discoveryUrl = `https://${domain}/.well-known/openid-configuration`;
	const getUserInfo$1 = async (tokens) => {
		const { data: profile, error } = await betterFetch(`https://${domain}/userinfo`, { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
		if (error || !profile) return null;
		return {
			id: profile.sub,
			name: profile.name ?? profile.nickname ?? void 0,
			email: profile.email ?? void 0,
			image: profile.picture,
			emailVerified: profile.email_verified ?? false
		};
	};
	return {
		providerId: "auth0",
		discoveryUrl,
		clientId: options.clientId,
		clientSecret: options.clientSecret,
		scopes: options.scopes ?? defaultScopes,
		redirectURI: options.redirectURI,
		pkce: options.pkce,
		disableImplicitSignUp: options.disableImplicitSignUp,
		disableSignUp: options.disableSignUp,
		overrideUserInfo: options.overrideUserInfo,
		getUserInfo: getUserInfo$1
	};
}

//#endregion
//#region src/plugins/generic-oauth/providers/hubspot.ts
/**
* HubSpot OAuth provider helper
*
* @example
* ```ts
* import { genericOAuth, hubspot } from "better-auth/plugins/generic-oauth";
*
* export const auth = betterAuth({
*   plugins: [
*     genericOAuth({
*       config: [
*         hubspot({
*           clientId: process.env.HUBSPOT_CLIENT_ID,
*           clientSecret: process.env.HUBSPOT_CLIENT_SECRET,
*           scopes: ["oauth", "contacts"],
*         }),
*       ],
*     }),
*   ],
* });
* ```
*/
function hubspot(options) {
	const defaultScopes = ["oauth"];
	const getUserInfo$1 = async (tokens) => {
		const { data: profile, error } = await betterFetch(`https://api.hubapi.com/oauth/v1/access-tokens/${tokens.accessToken}`, { headers: { "Content-Type": "application/json" } });
		if (error || !profile) return null;
		const id = profile.user_id ?? profile.signed_access_token?.userId;
		if (!id) return null;
		return {
			id,
			name: profile.user,
			email: profile.user,
			image: void 0,
			emailVerified: false
		};
	};
	return {
		providerId: "hubspot",
		authorizationUrl: "https://app.hubspot.com/oauth/authorize",
		tokenUrl: "https://api.hubapi.com/oauth/v1/token",
		clientId: options.clientId,
		clientSecret: options.clientSecret,
		scopes: options.scopes ?? defaultScopes,
		redirectURI: options.redirectURI,
		authentication: "post",
		pkce: options.pkce,
		disableImplicitSignUp: options.disableImplicitSignUp,
		disableSignUp: options.disableSignUp,
		overrideUserInfo: options.overrideUserInfo,
		getUserInfo: getUserInfo$1
	};
}

//#endregion
//#region src/plugins/generic-oauth/providers/keycloak.ts
/**
* Keycloak OAuth provider helper
*
* @example
* ```ts
* import { genericOAuth, keycloak } from "better-auth/plugins/generic-oauth";
*
* export const auth = betterAuth({
*   plugins: [
*     genericOAuth({
*       config: [
*         keycloak({
*           clientId: process.env.KEYCLOAK_CLIENT_ID,
*           clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
*           issuer: process.env.KEYCLOAK_ISSUER,
*         }),
*       ],
*     }),
*   ],
* });
* ```
*/
function keycloak(options) {
	const defaultScopes = [
		"openid",
		"profile",
		"email"
	];
	const issuer = options.issuer.replace(/\/$/, "");
	const discoveryUrl = `${issuer}/.well-known/openid-configuration`;
	const getUserInfo$1 = async (tokens) => {
		const { data: profile, error } = await betterFetch(`${issuer}/protocol/openid-connect/userinfo`, { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
		if (error || !profile) return null;
		return {
			id: profile.sub,
			name: profile.name ?? profile.preferred_username ?? void 0,
			email: profile.email ?? void 0,
			image: profile.picture,
			emailVerified: profile.email_verified ?? false
		};
	};
	return {
		providerId: "keycloak",
		discoveryUrl,
		clientId: options.clientId,
		clientSecret: options.clientSecret,
		scopes: options.scopes ?? defaultScopes,
		redirectURI: options.redirectURI,
		pkce: options.pkce,
		disableImplicitSignUp: options.disableImplicitSignUp,
		disableSignUp: options.disableSignUp,
		overrideUserInfo: options.overrideUserInfo,
		getUserInfo: getUserInfo$1
	};
}

//#endregion
//#region src/plugins/generic-oauth/providers/line.ts
/**
* LINE OAuth provider helper
*
* LINE requires separate channels for different countries (Japan, Thailand, Taiwan, etc.).
* Each channel has its own clientId and clientSecret. To support multiple countries,
* call this function multiple times with different providerIds and credentials.
*
* @example
* ```ts
* import { genericOAuth, line } from "better-auth/plugins/generic-oauth";
*
* export const auth = betterAuth({
*   plugins: [
*     genericOAuth({
*       config: [
*         // Japan channel
*         line({
*           providerId: "line-jp",
*           clientId: process.env.LINE_JP_CLIENT_ID,
*           clientSecret: process.env.LINE_JP_CLIENT_SECRET,
*         }),
*         // Thailand channel
*         line({
*           providerId: "line-th",
*           clientId: process.env.LINE_TH_CLIENT_ID,
*           clientSecret: process.env.LINE_TH_CLIENT_SECRET,
*         }),
*         // Taiwan channel
*         line({
*           providerId: "line-tw",
*           clientId: process.env.LINE_TW_CLIENT_ID,
*           clientSecret: process.env.LINE_TW_CLIENT_SECRET,
*         }),
*       ],
*     }),
*   ],
* });
* ```
*/
function line(options) {
	const defaultScopes = [
		"openid",
		"profile",
		"email"
	];
	const authorizationUrl = "https://access.line.me/oauth2/v2.1/authorize";
	const tokenUrl = "https://api.line.me/oauth2/v2.1/token";
	const userInfoUrl = "https://api.line.me/oauth2/v2.1/userinfo";
	const getUserInfo$1 = async (tokens) => {
		let profile = null;
		if (tokens.idToken) try {
			profile = decodeJwt(tokens.idToken);
		} catch {}
		if (!profile) {
			const { data, error } = await betterFetch(userInfoUrl, { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
			if (error || !data) return null;
			profile = data;
		}
		if (!profile) return null;
		return {
			id: profile.sub,
			name: profile.name,
			email: profile.email,
			image: profile.picture,
			emailVerified: false
		};
	};
	return {
		providerId: options.providerId ?? "line",
		authorizationUrl,
		tokenUrl,
		userInfoUrl,
		clientId: options.clientId,
		clientSecret: options.clientSecret,
		scopes: options.scopes ?? defaultScopes,
		redirectURI: options.redirectURI,
		pkce: options.pkce,
		disableImplicitSignUp: options.disableImplicitSignUp,
		disableSignUp: options.disableSignUp,
		overrideUserInfo: options.overrideUserInfo,
		getUserInfo: getUserInfo$1
	};
}

//#endregion
//#region src/plugins/generic-oauth/providers/microsoft-entra-id.ts
/**
* Microsoft Entra ID (Azure AD) OAuth provider helper
*
* @example
* ```ts
* import { genericOAuth, microsoftEntraId } from "better-auth/plugins/generic-oauth";
*
* export const auth = betterAuth({
*   plugins: [
*     genericOAuth({
*       config: [
*         microsoftEntraId({
*           clientId: process.env.MS_APP_ID,
*           clientSecret: process.env.MS_CLIENT_SECRET,
*           tenantId: process.env.MS_TENANT_ID,
*         }),
*       ],
*     }),
*   ],
* });
* ```
*/
function microsoftEntraId(options) {
	const defaultScopes = [
		"openid",
		"profile",
		"email"
	];
	const tenantId = options.tenantId;
	const authorizationUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`;
	const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
	const userInfoUrl = "https://graph.microsoft.com/oidc/userinfo";
	const getUserInfo$1 = async (tokens) => {
		const { data: profile, error } = await betterFetch(userInfoUrl, { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
		if (error || !profile) return null;
		return {
			id: profile.sub,
			name: profile.name ?? (`${profile.given_name ?? ""} ${profile.family_name ?? ""}`.trim() || void 0),
			email: profile.email ?? profile.preferred_username ?? void 0,
			image: profile.picture,
			emailVerified: profile.email_verified ?? false
		};
	};
	return {
		providerId: "microsoft-entra-id",
		authorizationUrl,
		tokenUrl,
		userInfoUrl,
		clientId: options.clientId,
		clientSecret: options.clientSecret,
		scopes: options.scopes ?? defaultScopes,
		redirectURI: options.redirectURI,
		pkce: options.pkce,
		disableImplicitSignUp: options.disableImplicitSignUp,
		disableSignUp: options.disableSignUp,
		overrideUserInfo: options.overrideUserInfo,
		getUserInfo: getUserInfo$1
	};
}

//#endregion
//#region src/plugins/generic-oauth/providers/okta.ts
/**
* Okta OAuth provider helper
*
* @example
* ```ts
* import { genericOAuth, okta } from "better-auth/plugins/generic-oauth";
*
* export const auth = betterAuth({
*   plugins: [
*     genericOAuth({
*       config: [
*         okta({
*           clientId: process.env.OKTA_CLIENT_ID,
*           clientSecret: process.env.OKTA_CLIENT_SECRET,
*           issuer: process.env.OKTA_ISSUER,
*         }),
*       ],
*     }),
*   ],
* });
* ```
*/
function okta(options) {
	const defaultScopes = [
		"openid",
		"profile",
		"email"
	];
	const issuer = options.issuer.replace(/\/$/, "");
	const discoveryUrl = `${issuer}/.well-known/openid-configuration`;
	const getUserInfo$1 = async (tokens) => {
		const { data: profile, error } = await betterFetch(`${issuer}/v1/userinfo`, { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
		if (error || !profile) return null;
		return {
			id: profile.sub,
			name: profile.name ?? profile.preferred_username ?? void 0,
			email: profile.email ?? void 0,
			image: profile.picture,
			emailVerified: profile.email_verified ?? false
		};
	};
	return {
		providerId: "okta",
		discoveryUrl,
		clientId: options.clientId,
		clientSecret: options.clientSecret,
		scopes: options.scopes ?? defaultScopes,
		redirectURI: options.redirectURI,
		pkce: options.pkce,
		disableImplicitSignUp: options.disableImplicitSignUp,
		disableSignUp: options.disableSignUp,
		overrideUserInfo: options.overrideUserInfo,
		getUserInfo: getUserInfo$1
	};
}

//#endregion
//#region src/plugins/generic-oauth/providers/slack.ts
/**
* Slack OAuth provider helper
*
* @example
* ```ts
* import { genericOAuth, slack } from "better-auth/plugins/generic-oauth";
*
* export const auth = betterAuth({
*   plugins: [
*     genericOAuth({
*       config: [
*         slack({
*           clientId: process.env.SLACK_CLIENT_ID,
*           clientSecret: process.env.SLACK_CLIENT_SECRET,
*         }),
*       ],
*     }),
*   ],
* });
* ```
*/
function slack(options) {
	const defaultScopes = [
		"openid",
		"profile",
		"email"
	];
	const getUserInfo$1 = async (tokens) => {
		const { data: profile, error } = await betterFetch("https://slack.com/api/openid.connect.userInfo", { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
		if (error || !profile) return null;
		return {
			id: profile["https://slack.com/user_id"] ?? profile.sub,
			name: profile.name,
			email: profile.email,
			image: profile.picture ?? profile["https://slack.com/user_image_512"],
			emailVerified: profile.email_verified ?? false
		};
	};
	return {
		providerId: "slack",
		authorizationUrl: "https://slack.com/openid/connect/authorize",
		tokenUrl: "https://slack.com/api/openid.connect.token",
		userInfoUrl: "https://slack.com/api/openid.connect.userInfo",
		clientId: options.clientId,
		clientSecret: options.clientSecret,
		scopes: options.scopes ?? defaultScopes,
		redirectURI: options.redirectURI,
		pkce: options.pkce,
		disableImplicitSignUp: options.disableImplicitSignUp,
		disableSignUp: options.disableSignUp,
		overrideUserInfo: options.overrideUserInfo,
		getUserInfo: getUserInfo$1
	};
}

//#endregion
//#region src/plugins/generic-oauth/index.ts
async function getUserInfo(tokens, finalUserInfoUrl) {
	if (tokens.idToken) {
		const decoded = decodeJwt(tokens.idToken);
		if (decoded) {
			if (decoded.sub && decoded.email) return {
				id: decoded.sub,
				emailVerified: decoded.email_verified,
				image: decoded.picture,
				...decoded
			};
		}
	}
	if (!finalUserInfoUrl) return null;
	const userInfo = await betterFetch(finalUserInfoUrl, {
		method: "GET",
		headers: { Authorization: `Bearer ${tokens.accessToken}` }
	});
	return {
		id: userInfo.data?.sub ?? "",
		emailVerified: userInfo.data?.email_verified ?? false,
		email: userInfo.data?.email,
		image: userInfo.data?.picture,
		name: userInfo.data?.name,
		...userInfo.data
	};
}
/**
* A generic OAuth plugin that can be used to add OAuth support to any provider
*/
const genericOAuth = (options) => {
	return {
		id: "generic-oauth",
		init: (ctx) => {
			return { context: { socialProviders: options.config.map((c) => {
				let finalUserInfoUrl = c.userInfoUrl;
				return {
					id: c.providerId,
					name: c.providerId,
					async createAuthorizationURL(data) {
						let finalAuthUrl = c.authorizationUrl;
						if (!finalAuthUrl && c.discoveryUrl) {
							const discovery = await betterFetch(c.discoveryUrl, {
								method: "GET",
								headers: c.discoveryHeaders
							});
							if (discovery.data) {
								finalAuthUrl = discovery.data.authorization_endpoint;
								finalUserInfoUrl = finalUserInfoUrl ?? discovery.data.userinfo_endpoint;
							}
						}
						if (!finalAuthUrl) throw new APIError("BAD_REQUEST", { message: GENERIC_OAUTH_ERROR_CODES.INVALID_OAUTH_CONFIGURATION });
						return createAuthorizationURL({
							id: c.providerId,
							options: {
								clientId: c.clientId,
								clientSecret: c.clientSecret,
								redirectURI: c.redirectURI
							},
							authorizationEndpoint: finalAuthUrl,
							state: data.state,
							codeVerifier: c.pkce ? data.codeVerifier : void 0,
							scopes: c.scopes || [],
							redirectURI: `${ctx.baseURL}/oauth2/callback/${c.providerId}`
						});
					},
					async validateAuthorizationCode(data) {
						if (c.getToken) return c.getToken(data);
						let finalTokenUrl = c.tokenUrl;
						if (c.discoveryUrl) {
							const discovery = await betterFetch(c.discoveryUrl, {
								method: "GET",
								headers: c.discoveryHeaders
							});
							if (discovery.data) {
								finalTokenUrl = discovery.data.token_endpoint;
								finalUserInfoUrl = discovery.data.userinfo_endpoint;
							}
						}
						if (!finalTokenUrl) throw new APIError("BAD_REQUEST", { message: GENERIC_OAUTH_ERROR_CODES.TOKEN_URL_NOT_FOUND });
						return validateAuthorizationCode({
							headers: c.authorizationHeaders,
							code: data.code,
							codeVerifier: data.codeVerifier,
							redirectURI: data.redirectURI,
							options: {
								clientId: c.clientId,
								clientSecret: c.clientSecret,
								redirectURI: c.redirectURI
							},
							tokenEndpoint: finalTokenUrl,
							authentication: c.authentication
						});
					},
					async refreshAccessToken(refreshToken) {
						let finalTokenUrl = c.tokenUrl;
						if (c.discoveryUrl) {
							const discovery = await betterFetch(c.discoveryUrl, {
								method: "GET",
								headers: c.discoveryHeaders
							});
							if (discovery.data) finalTokenUrl = discovery.data.token_endpoint;
						}
						if (!finalTokenUrl) throw new APIError("BAD_REQUEST", { message: GENERIC_OAUTH_ERROR_CODES.TOKEN_URL_NOT_FOUND });
						return refreshAccessToken({
							refreshToken,
							options: {
								clientId: c.clientId,
								clientSecret: c.clientSecret
							},
							authentication: c.authentication,
							tokenEndpoint: finalTokenUrl
						});
					},
					async getUserInfo(tokens) {
						const userInfo = c.getUserInfo ? await c.getUserInfo(tokens) : await getUserInfo(tokens, finalUserInfoUrl);
						if (!userInfo) return null;
						const userMap = await c.mapProfileToUser?.(userInfo);
						return {
							user: {
								id: userInfo?.id,
								email: userInfo?.email,
								emailVerified: userInfo?.emailVerified,
								image: userInfo?.image,
								name: userInfo?.name,
								...userMap
							},
							data: userInfo
						};
					},
					options: { overrideUserInfoOnSignIn: c.overrideUserInfo }
				};
			}).concat(ctx.socialProviders) } };
		},
		endpoints: {
			signInWithOAuth2: createAuthEndpoint("/sign-in/oauth2", {
				method: "POST",
				body: z.object({
					providerId: z.string().meta({ description: "The provider ID for the OAuth provider" }),
					callbackURL: z.string().meta({ description: "The URL to redirect to after sign in" }).optional(),
					errorCallbackURL: z.string().meta({ description: "The URL to redirect to if an error occurs" }).optional(),
					newUserCallbackURL: z.string().meta({ description: "The URL to redirect to after login if the user is new. Eg: \"/welcome\"" }).optional(),
					disableRedirect: z.boolean().meta({ description: "Disable redirect" }).optional(),
					scopes: z.array(z.string()).meta({ description: "Scopes to be passed to the provider authorization request." }).optional(),
					requestSignUp: z.boolean().meta({ description: "Explicitly request sign-up. Useful when disableImplicitSignUp is true for this provider. Eg: false" }).optional(),
					additionalData: z.record(z.string(), z.any()).optional()
				}),
				metadata: { openapi: {
					description: "Sign in with OAuth2",
					responses: { 200: {
						description: "Sign in with OAuth2",
						content: { "application/json": { schema: {
							type: "object",
							properties: {
								url: { type: "string" },
								redirect: { type: "boolean" }
							}
						} } }
					} }
				} }
			}, async (ctx) => {
				const { providerId } = ctx.body;
				const config = options.config.find((c) => c.providerId === providerId);
				if (!config) throw new APIError("BAD_REQUEST", { message: `${GENERIC_OAUTH_ERROR_CODES.PROVIDER_CONFIG_NOT_FOUND} ${providerId}` });
				const { discoveryUrl, authorizationUrl, tokenUrl, clientId, clientSecret, scopes, redirectURI, responseType, pkce, prompt, accessType, authorizationUrlParams, responseMode, authentication } = config;
				let finalAuthUrl = authorizationUrl;
				let finalTokenUrl = tokenUrl;
				if (discoveryUrl) {
					const discovery = await betterFetch(discoveryUrl, {
						method: "GET",
						headers: config.discoveryHeaders,
						onError(context) {
							ctx.context.logger.error(context.error.message, context.error, { discoveryUrl });
						}
					});
					if (discovery.data) {
						finalAuthUrl = discovery.data.authorization_endpoint;
						finalTokenUrl = discovery.data.token_endpoint;
					}
				}
				if (!finalAuthUrl || !finalTokenUrl) throw new APIError("BAD_REQUEST", { message: GENERIC_OAUTH_ERROR_CODES.INVALID_OAUTH_CONFIGURATION });
				if (authorizationUrlParams) {
					const withAdditionalParams = new URL(finalAuthUrl);
					for (const [paramName, paramValue] of Object.entries(authorizationUrlParams)) withAdditionalParams.searchParams.set(paramName, paramValue);
					finalAuthUrl = withAdditionalParams.toString();
				}
				const additionalParams = typeof authorizationUrlParams === "function" ? authorizationUrlParams(ctx) : authorizationUrlParams;
				const { state, codeVerifier } = await generateState(ctx, void 0, ctx.body.additionalData);
				const authUrl = await createAuthorizationURL({
					id: providerId,
					options: {
						clientId,
						clientSecret,
						redirectURI
					},
					authorizationEndpoint: finalAuthUrl,
					state,
					codeVerifier: pkce ? codeVerifier : void 0,
					scopes: ctx.body.scopes ? [...ctx.body.scopes, ...scopes || []] : scopes || [],
					redirectURI: `${ctx.context.baseURL}/oauth2/callback/${providerId}`,
					prompt,
					accessType,
					responseType,
					responseMode,
					additionalParams
				});
				return ctx.json({
					url: authUrl.toString(),
					redirect: !ctx.body.disableRedirect
				});
			}),
			oAuth2Callback: createAuthEndpoint("/oauth2/callback/:providerId", {
				method: "GET",
				query: z.object({
					code: z.string().meta({ description: "The OAuth2 code" }).optional(),
					error: z.string().meta({ description: "The error message, if any" }).optional(),
					error_description: z.string().meta({ description: "The error description, if any" }).optional(),
					state: z.string().meta({ description: "The state parameter from the OAuth2 request" }).optional()
				}),
				metadata: {
					client: false,
					allowedMediaTypes: ["application/x-www-form-urlencoded", "application/json"],
					openapi: {
						description: "OAuth2 callback",
						responses: { 200: {
							description: "OAuth2 callback",
							content: { "application/json": { schema: {
								type: "object",
								properties: { url: { type: "string" } }
							} } }
						} }
					}
				}
			}, async (ctx) => {
				const defaultErrorURL = ctx.context.options.onAPIError?.errorURL || `${ctx.context.baseURL}/error`;
				if (ctx.query.error || !ctx.query.code) throw ctx.redirect(`${defaultErrorURL}?error=${ctx.query.error || "oAuth_code_missing"}&error_description=${ctx.query.error_description}`);
				const providerId = ctx.params?.providerId;
				if (!providerId) throw new APIError("BAD_REQUEST", { message: GENERIC_OAUTH_ERROR_CODES.PROVIDER_ID_REQUIRED });
				const providerConfig = options.config.find((p) => p.providerId === providerId);
				if (!providerConfig) throw new APIError("BAD_REQUEST", { message: `${GENERIC_OAUTH_ERROR_CODES.PROVIDER_CONFIG_NOT_FOUND} ${providerId}` });
				let tokens = void 0;
				const { callbackURL, codeVerifier, errorURL, requestSignUp, newUserURL, link } = await parseState(ctx);
				const code = ctx.query.code;
				function redirectOnError(error) {
					const defaultErrorURL$1 = ctx.context.options.onAPIError?.errorURL || `${ctx.context.baseURL}/error`;
					let url = errorURL || defaultErrorURL$1;
					if (url.includes("?")) url = `${url}&error=${error}`;
					else url = `${url}?error=${error}`;
					throw ctx.redirect(url);
				}
				let finalTokenUrl = providerConfig.tokenUrl;
				let finalUserInfoUrl = providerConfig.userInfoUrl;
				if (providerConfig.discoveryUrl) {
					const discovery = await betterFetch(providerConfig.discoveryUrl, {
						method: "GET",
						headers: providerConfig.discoveryHeaders
					});
					if (discovery.data) {
						finalTokenUrl = discovery.data.token_endpoint;
						finalUserInfoUrl = discovery.data.userinfo_endpoint;
					}
				}
				try {
					if (providerConfig.getToken) tokens = await providerConfig.getToken({
						code,
						redirectURI: `${ctx.context.baseURL}/oauth2/callback/${providerConfig.providerId}`,
						codeVerifier: providerConfig.pkce ? codeVerifier : void 0
					});
					else {
						if (!finalTokenUrl) throw new APIError("BAD_REQUEST", { message: GENERIC_OAUTH_ERROR_CODES.INVALID_OAUTH_CONFIG });
						const additionalParams = typeof providerConfig.tokenUrlParams === "function" ? providerConfig.tokenUrlParams(ctx) : providerConfig.tokenUrlParams;
						tokens = await validateAuthorizationCode({
							headers: providerConfig.authorizationHeaders,
							code,
							codeVerifier: providerConfig.pkce ? codeVerifier : void 0,
							redirectURI: `${ctx.context.baseURL}/oauth2/callback/${providerConfig.providerId}`,
							options: {
								clientId: providerConfig.clientId,
								clientSecret: providerConfig.clientSecret,
								redirectURI: providerConfig.redirectURI
							},
							tokenEndpoint: finalTokenUrl,
							authentication: providerConfig.authentication,
							additionalParams
						});
					}
				} catch (e) {
					ctx.context.logger.error(e && typeof e === "object" && "name" in e ? e.name : "", e);
					throw redirectOnError("oauth_code_verification_failed");
				}
				if (!tokens) throw new APIError("BAD_REQUEST", { message: GENERIC_OAUTH_ERROR_CODES.INVALID_OAUTH_CONFIG });
				const userInfo = await (async function handleUserInfo() {
					const userInfo$1 = providerConfig.getUserInfo ? await providerConfig.getUserInfo(tokens) : await getUserInfo(tokens, finalUserInfoUrl);
					if (!userInfo$1) throw redirectOnError("user_info_is_missing");
					const mapUser = providerConfig.mapProfileToUser ? await providerConfig.mapProfileToUser(userInfo$1) : userInfo$1;
					const email = mapUser.email ? mapUser.email.toLowerCase() : userInfo$1.email?.toLowerCase();
					if (!email) {
						ctx.context.logger.error("Unable to get user info", userInfo$1);
						throw redirectOnError("email_is_missing");
					}
					const id = mapUser.id ? String(mapUser.id) : String(userInfo$1.id);
					const name = mapUser.name ? mapUser.name : userInfo$1.name;
					if (!name) {
						ctx.context.logger.error("Unable to get user info", userInfo$1);
						throw redirectOnError("name_is_missing");
					}
					return {
						...userInfo$1,
						...mapUser,
						email,
						id,
						name
					};
				})();
				if (link) {
					if (ctx.context.options.account?.accountLinking?.allowDifferentEmails !== true && link.email !== userInfo.email) return redirectOnError("email_doesn't_match");
					const existingAccount = await ctx.context.internalAdapter.findAccountByProviderId(String(userInfo.id), providerConfig.providerId);
					if (existingAccount) {
						if (existingAccount.userId !== link.userId) return redirectOnError("account_already_linked_to_different_user");
						const updateData = Object.fromEntries(Object.entries({
							accessToken: tokens.accessToken,
							idToken: tokens.idToken,
							refreshToken: tokens.refreshToken,
							accessTokenExpiresAt: tokens.accessTokenExpiresAt,
							refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
							scope: tokens.scopes?.join(",")
						}).filter(([_, value]) => value !== void 0));
						await ctx.context.internalAdapter.updateAccount(existingAccount.id, updateData);
					} else if (!await ctx.context.internalAdapter.createAccount({
						userId: link.userId,
						providerId: providerConfig.providerId,
						accountId: userInfo.id,
						accessToken: tokens.accessToken,
						accessTokenExpiresAt: tokens.accessTokenExpiresAt,
						refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
						scope: tokens.scopes?.join(","),
						refreshToken: tokens.refreshToken,
						idToken: tokens.idToken
					})) return redirectOnError("unable_to_link_account");
					let toRedirectTo$1;
					try {
						toRedirectTo$1 = callbackURL.toString();
					} catch {
						toRedirectTo$1 = callbackURL;
					}
					throw ctx.redirect(toRedirectTo$1);
				}
				const result = await handleOAuthUserInfo(ctx, {
					userInfo,
					account: {
						providerId: providerConfig.providerId,
						accountId: userInfo.id,
						...tokens,
						scope: tokens.scopes?.join(",")
					},
					callbackURL,
					disableSignUp: providerConfig.disableImplicitSignUp && !requestSignUp || providerConfig.disableSignUp,
					overrideUserInfo: providerConfig.overrideUserInfo
				});
				if (result.error) return redirectOnError(result.error.split(" ").join("_"));
				const { session, user } = result.data;
				await setSessionCookie(ctx, {
					session,
					user
				});
				let toRedirectTo;
				try {
					toRedirectTo = (result.isRegister ? newUserURL || callbackURL : callbackURL).toString();
				} catch {
					toRedirectTo = result.isRegister ? newUserURL || callbackURL : callbackURL;
				}
				throw ctx.redirect(toRedirectTo);
			}),
			oAuth2LinkAccount: createAuthEndpoint("/oauth2/link", {
				method: "POST",
				body: z.object({
					providerId: z.string(),
					callbackURL: z.string(),
					scopes: z.array(z.string()).meta({ description: "Additional scopes to request when linking the account" }).optional(),
					errorCallbackURL: z.string().meta({ description: "The URL to redirect to if there is an error during the link process" }).optional()
				}),
				use: [sessionMiddleware],
				metadata: { openapi: {
					description: "Link an OAuth2 account to the current user session",
					responses: { "200": {
						description: "Authorization URL generated successfully for linking an OAuth2 account",
						content: { "application/json": { schema: {
							type: "object",
							properties: {
								url: {
									type: "string",
									format: "uri",
									description: "The authorization URL to redirect the user to for linking the OAuth2 account"
								},
								redirect: {
									type: "boolean",
									description: "Indicates that the client should redirect to the provided URL",
									enum: [true]
								}
							},
							required: ["url", "redirect"]
						} } }
					} }
				} }
			}, async (c) => {
				const session = c.context.session;
				if (!session) throw new APIError("UNAUTHORIZED", { message: GENERIC_OAUTH_ERROR_CODES.SESSION_REQUIRED });
				const provider = options.config.find((p) => p.providerId === c.body.providerId);
				if (!provider) throw new APIError("NOT_FOUND", { message: BASE_ERROR_CODES.PROVIDER_NOT_FOUND });
				const { providerId, clientId, clientSecret, redirectURI, authorizationUrl, discoveryUrl, pkce, scopes, prompt, accessType, authorizationUrlParams } = provider;
				let finalAuthUrl = authorizationUrl;
				if (!finalAuthUrl) {
					if (!discoveryUrl) throw new APIError("BAD_REQUEST", { message: GENERIC_OAUTH_ERROR_CODES.INVALID_OAUTH_CONFIGURATION });
					const discovery = await betterFetch(discoveryUrl, {
						method: "GET",
						headers: provider.discoveryHeaders,
						onError(context) {
							c.context.logger.error(context.error.message, context.error, { discoveryUrl });
						}
					});
					if (discovery.data) finalAuthUrl = discovery.data.authorization_endpoint;
				}
				if (!finalAuthUrl) throw new APIError("BAD_REQUEST", { message: GENERIC_OAUTH_ERROR_CODES.INVALID_OAUTH_CONFIGURATION });
				const state = await generateState(c, {
					userId: session.user.id,
					email: session.user.email
				}, void 0);
				const additionalParams = typeof authorizationUrlParams === "function" ? authorizationUrlParams(c) : authorizationUrlParams;
				const url = await createAuthorizationURL({
					id: providerId,
					options: {
						clientId,
						clientSecret,
						redirectURI: redirectURI || `${c.context.baseURL}/oauth2/callback/${providerId}`
					},
					authorizationEndpoint: finalAuthUrl,
					state: state.state,
					codeVerifier: pkce ? state.codeVerifier : void 0,
					scopes: c.body.scopes || scopes || [],
					redirectURI: redirectURI || `${c.context.baseURL}/oauth2/callback/${providerId}`,
					prompt,
					accessType,
					additionalParams
				});
				return c.json({
					url: url.toString(),
					redirect: true
				});
			})
		},
		$ERROR_CODES: GENERIC_OAUTH_ERROR_CODES
	};
};

//#endregion
export { line as a, auth0 as c, microsoftEntraId as i, slack as n, keycloak as o, okta as r, hubspot as s, genericOAuth as t };