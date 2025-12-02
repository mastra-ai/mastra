import { i as parseState, n as HIDE_METADATA, r as generateState, t as generateId } from "./utils-DBbaShi0.mjs";
import { n as symmetricEncrypt, r as generateRandomString, t as symmetricDecrypt } from "./crypto-BQxYXGGX.mjs";
import { t as signJWT } from "./jwt-DzuIBp7t.mjs";
import { c as parseUserInput, l as parseUserOutput, u as getDate } from "./schema-CSB7dlK0.mjs";
import { t as getIp } from "./get-request-ip-RYTz2Uba.mjs";
import { t as safeJSONParse } from "./json-_HMgPUVh.mjs";
import { i as getProtocol, n as getHost, r as getOrigin } from "./url-BLNRhCPO.mjs";
import { c as setSessionCookie, n as deleteSessionCookie } from "./cookies-D_dksn7B.mjs";
import { c as revokeSessions, i as listSessions, l as sensitiveSessionMiddleware, n as getSession, o as revokeOtherSessions, r as getSessionFromCtx, s as revokeSession, t as freshSessionMiddleware, u as sessionMiddleware } from "./session-CgfX4vv1.mjs";
import { hasRequestState, runWithEndpointContext, runWithRequestState, runWithTransaction } from "@better-auth/core/context";
import { isDevelopment, isProduction, logger, shouldPublishLog } from "@better-auth/core/env";
import { BASE_ERROR_CODES } from "@better-auth/core/error";
import { APIError, APIError as APIError$1, createRouter, toResponse } from "better-call";
import * as z from "zod";
import { jwtVerify } from "jose";
import { SocialProviderListEnum } from "@better-auth/core/social-providers";
import { createDefu } from "defu";
import { createAuthEndpoint, createAuthEndpoint as createAuthEndpoint$1, createAuthMiddleware, createAuthMiddleware as createAuthMiddleware$1, optionsMiddleware } from "@better-auth/core/api";
import { JWTExpired } from "jose/errors";

//#region src/utils/wildcard.ts
/**
* Escapes a character if it has a special meaning in regular expressions
* and returns the character as is if it doesn't
*/
function escapeRegExpChar(char) {
	if (char === "-" || char === "^" || char === "$" || char === "+" || char === "." || char === "(" || char === ")" || char === "|" || char === "[" || char === "]" || char === "{" || char === "}" || char === "*" || char === "?" || char === "\\") return `\\${char}`;
	else return char;
}
/**
* Escapes all characters in a given string that have a special meaning in regular expressions
*/
function escapeRegExpString(str) {
	let result = "";
	for (let i = 0; i < str.length; i++) result += escapeRegExpChar(str[i]);
	return result;
}
/**
* Transforms one or more glob patterns into a RegExp pattern
*/
function transform(pattern, separator = true) {
	if (Array.isArray(pattern)) return `(?:${pattern.map((p) => `^${transform(p, separator)}$`).join("|")})`;
	let separatorSplitter = "";
	let separatorMatcher = "";
	let wildcard = ".";
	if (separator === true) {
		separatorSplitter = "/";
		separatorMatcher = "[/\\\\]";
		wildcard = "[^/\\\\]";
	} else if (separator) {
		separatorSplitter = separator;
		separatorMatcher = escapeRegExpString(separatorSplitter);
		if (separatorMatcher.length > 1) {
			separatorMatcher = `(?:${separatorMatcher})`;
			wildcard = `((?!${separatorMatcher}).)`;
		} else wildcard = `[^${separatorMatcher}]`;
	}
	let requiredSeparator = separator ? `${separatorMatcher}+?` : "";
	let optionalSeparator = separator ? `${separatorMatcher}*?` : "";
	let segments = separator ? pattern.split(separatorSplitter) : [pattern];
	let result = "";
	for (let s = 0; s < segments.length; s++) {
		let segment = segments[s];
		let nextSegment = segments[s + 1];
		let currentSeparator = "";
		if (!segment && s > 0) continue;
		if (separator) if (s === segments.length - 1) currentSeparator = optionalSeparator;
		else if (nextSegment !== "**") currentSeparator = requiredSeparator;
		else currentSeparator = "";
		if (separator && segment === "**") {
			if (currentSeparator) {
				result += s === 0 ? "" : currentSeparator;
				result += `(?:${wildcard}*?${currentSeparator})*?`;
			}
			continue;
		}
		for (let c = 0; c < segment.length; c++) {
			let char = segment[c];
			if (char === "\\") {
				if (c < segment.length - 1) {
					result += escapeRegExpChar(segment[c + 1]);
					c++;
				}
			} else if (char === "?") result += wildcard;
			else if (char === "*") result += `${wildcard}*?`;
			else result += escapeRegExpChar(char);
		}
		result += currentSeparator;
	}
	return result;
}
function isMatch(regexp, sample) {
	if (typeof sample !== "string") throw new TypeError(`Sample must be a string, but ${typeof sample} given`);
	return regexp.test(sample);
}
/**
* Compiles one or more glob patterns into a RegExp and returns an isMatch function.
* The isMatch function takes a sample string as its only argument and returns `true`
* if the string matches the pattern(s).
*
* ```js
* wildcardMatch('src/*.js')('src/index.js') //=> true
* ```
*
* ```js
* const isMatch = wildcardMatch('*.example.com', '.')
* isMatch('foo.example.com') //=> true
* isMatch('foo.bar.com') //=> false
* ```
*/
function wildcardMatch(pattern, options) {
	if (typeof pattern !== "string" && !Array.isArray(pattern)) throw new TypeError(`The first argument must be a single pattern string or an array of patterns, but ${typeof pattern} given`);
	if (typeof options === "string" || typeof options === "boolean") options = { separator: options };
	if (arguments.length === 2 && !(typeof options === "undefined" || typeof options === "object" && options !== null && !Array.isArray(options))) throw new TypeError(`The second argument must be an options object or a string/boolean separator, but ${typeof options} given`);
	options = options || {};
	if (options.separator === "\\") throw new Error("\\ is not a valid separator because it is used for escaping. Try setting the separator to `true` instead");
	let regexpPattern = transform(pattern, options.separator);
	let regexp = new RegExp(`^${regexpPattern}$`, options.flags);
	let fn = isMatch.bind(null, regexp);
	fn.options = options;
	fn.pattern = pattern;
	fn.regexp = regexp;
	return fn;
}

//#endregion
//#region src/api/middlewares/origin-check.ts
/**
* A middleware to validate callbackURL and origin against
* trustedOrigins.
*/
const originCheckMiddleware = createAuthMiddleware(async (ctx) => {
	if (ctx.request?.method === "GET" || ctx.request?.method === "OPTIONS" || ctx.request?.method === "HEAD" || !ctx.request) return;
	const headers = ctx.request?.headers;
	const request = ctx.request;
	const { body, query, context } = ctx;
	const originHeader = headers?.get("origin") || headers?.get("referer") || "";
	const callbackURL = body?.callbackURL || query?.callbackURL;
	const redirectURL = body?.redirectTo;
	const errorCallbackURL = body?.errorCallbackURL;
	const newUserCallbackURL = body?.newUserCallbackURL;
	const trustedOrigins = Array.isArray(context.options.trustedOrigins) ? context.trustedOrigins : [...context.trustedOrigins, ...await context.options.trustedOrigins?.(request) || []];
	const useCookies = headers?.has("cookie");
	const matchesPattern = (url, pattern) => {
		if (url.startsWith("/")) return false;
		if (pattern.includes("*")) {
			if (pattern.includes("://")) return wildcardMatch(pattern)(getOrigin(url) || url);
			const host = getHost(url);
			if (!host) return false;
			return wildcardMatch(pattern)(host);
		}
		const protocol = getProtocol(url);
		return protocol === "http:" || protocol === "https:" || !protocol ? pattern === getOrigin(url) : url.startsWith(pattern);
	};
	const validateURL = (url, label) => {
		if (!url) return;
		if (!trustedOrigins.some((origin) => matchesPattern(url, origin) || url?.startsWith("/") && label !== "origin" && /^\/(?!\/|\\|%2f|%5c)[\w\-.\+/@]*(?:\?[\w\-.\+/=&%@]*)?$/.test(url))) {
			ctx.context.logger.error(`Invalid ${label}: ${url}`);
			ctx.context.logger.info(`If it's a valid URL, please add ${url} to trustedOrigins in your auth config\n`, `Current list of trustedOrigins: ${trustedOrigins}`);
			throw new APIError("FORBIDDEN", { message: `Invalid ${label}` });
		}
	};
	if (useCookies && !ctx.context.skipCSRFCheck && !ctx.context.skipOriginCheck) {
		if (!originHeader || originHeader === "null") throw new APIError("FORBIDDEN", { message: "Missing or null Origin" });
		validateURL(originHeader, "origin");
	}
	callbackURL && validateURL(callbackURL, "callbackURL");
	redirectURL && validateURL(redirectURL, "redirectURL");
	errorCallbackURL && validateURL(errorCallbackURL, "errorCallbackURL");
	newUserCallbackURL && validateURL(newUserCallbackURL, "newUserCallbackURL");
});
const originCheck = (getValue) => createAuthMiddleware(async (ctx) => {
	if (!ctx.request) return;
	const { context } = ctx;
	const callbackURL = getValue(ctx);
	const trustedOrigins = Array.isArray(context.options.trustedOrigins) ? context.trustedOrigins : [...context.trustedOrigins, ...await context.options.trustedOrigins?.(ctx.request) || []];
	const matchesPattern = (url, pattern) => {
		if (url.startsWith("/")) return false;
		if (pattern.includes("*")) {
			if (pattern.includes("://")) return wildcardMatch(pattern)(getOrigin(url) || url);
			const host = getHost(url);
			if (!host) return false;
			return wildcardMatch(pattern)(host);
		}
		const protocol = getProtocol(url);
		return protocol === "http:" || protocol === "https:" || !protocol ? pattern === getOrigin(url) : url.startsWith(pattern);
	};
	const validateURL = (url, label) => {
		if (!url) return;
		if (!trustedOrigins.some((origin) => matchesPattern(url, origin) || url?.startsWith("/") && label !== "origin" && /^\/(?!\/|\\|%2f|%5c)[\w\-.\+/@]*(?:\?[\w\-.\+/=&%@]*)?$/.test(url))) {
			ctx.context.logger.error(`Invalid ${label}: ${url}`);
			ctx.context.logger.info(`If it's a valid URL, please add ${url} to trustedOrigins in your auth config\n`, `Current list of trustedOrigins: ${trustedOrigins}`);
			throw new APIError("FORBIDDEN", { message: `Invalid ${label}` });
		}
	};
	const callbacks = Array.isArray(callbackURL) ? callbackURL : [callbackURL];
	for (const url of callbacks) validateURL(url, "callbackURL");
});

//#endregion
//#region src/api/rate-limiter/index.ts
function shouldRateLimit(max, window, rateLimitData) {
	const now = Date.now();
	const windowInMs = window * 1e3;
	return now - rateLimitData.lastRequest < windowInMs && rateLimitData.count >= max;
}
function rateLimitResponse(retryAfter) {
	return new Response(JSON.stringify({ message: "Too many requests. Please try again later." }), {
		status: 429,
		statusText: "Too Many Requests",
		headers: { "X-Retry-After": retryAfter.toString() }
	});
}
function getRetryAfter(lastRequest, window) {
	const now = Date.now();
	const windowInMs = window * 1e3;
	return Math.ceil((lastRequest + windowInMs - now) / 1e3);
}
function createDBStorage(ctx) {
	const model = "rateLimit";
	const db = ctx.adapter;
	return {
		get: async (key) => {
			const data = (await db.findMany({
				model,
				where: [{
					field: "key",
					value: key
				}]
			}))[0];
			if (typeof data?.lastRequest === "bigint") data.lastRequest = Number(data.lastRequest);
			return data;
		},
		set: async (key, value, _update) => {
			try {
				if (_update) await db.updateMany({
					model,
					where: [{
						field: "key",
						value: key
					}],
					update: {
						count: value.count,
						lastRequest: value.lastRequest
					}
				});
				else await db.create({
					model,
					data: {
						key,
						count: value.count,
						lastRequest: value.lastRequest
					}
				});
			} catch (e) {
				ctx.logger.error("Error setting rate limit", e);
			}
		}
	};
}
const memory = /* @__PURE__ */ new Map();
function getRateLimitStorage(ctx, rateLimitSettings) {
	if (ctx.options.rateLimit?.customStorage) return ctx.options.rateLimit.customStorage;
	const storage = ctx.rateLimit.storage;
	if (storage === "secondary-storage") return {
		get: async (key) => {
			const data = await ctx.options.secondaryStorage?.get(key);
			return data ? safeJSONParse(data) : void 0;
		},
		set: async (key, value, _update) => {
			const ttl = rateLimitSettings?.window ?? ctx.options.rateLimit?.window ?? 10;
			await ctx.options.secondaryStorage?.set?.(key, JSON.stringify(value), ttl);
		}
	};
	else if (storage === "memory") return {
		async get(key) {
			return memory.get(key);
		},
		async set(key, value, _update) {
			memory.set(key, value);
		}
	};
	return createDBStorage(ctx);
}
async function onRequestRateLimit(req, ctx) {
	if (!ctx.rateLimit.enabled) return;
	const path = new URL(req.url).pathname.replace(ctx.options.basePath || "/api/auth", "");
	let window = ctx.rateLimit.window;
	let max = ctx.rateLimit.max;
	const ip = getIp(req, ctx.options);
	if (!ip) return;
	const key = ip + path;
	const specialRule = getDefaultSpecialRules().find((rule) => rule.pathMatcher(path));
	if (specialRule) {
		window = specialRule.window;
		max = specialRule.max;
	}
	for (const plugin of ctx.options.plugins || []) if (plugin.rateLimit) {
		const matchedRule = plugin.rateLimit.find((rule) => rule.pathMatcher(path));
		if (matchedRule) {
			window = matchedRule.window;
			max = matchedRule.max;
			break;
		}
	}
	if (ctx.rateLimit.customRules) {
		const _path = Object.keys(ctx.rateLimit.customRules).find((p) => {
			if (p.includes("*")) return wildcardMatch(p)(path);
			return p === path;
		});
		if (_path) {
			const customRule = ctx.rateLimit.customRules[_path];
			const resolved = typeof customRule === "function" ? await customRule(req) : customRule;
			if (resolved) {
				window = resolved.window;
				max = resolved.max;
			}
			if (resolved === false) return;
		}
	}
	const storage = getRateLimitStorage(ctx, { window });
	const data = await storage.get(key);
	const now = Date.now();
	if (!data) await storage.set(key, {
		key,
		count: 1,
		lastRequest: now
	});
	else {
		const timeSinceLastRequest = now - data.lastRequest;
		if (shouldRateLimit(max, window, data)) return rateLimitResponse(getRetryAfter(data.lastRequest, window));
		else if (timeSinceLastRequest > window * 1e3) await storage.set(key, {
			...data,
			count: 1,
			lastRequest: now
		}, true);
		else await storage.set(key, {
			...data,
			count: data.count + 1,
			lastRequest: now
		}, true);
	}
}
function getDefaultSpecialRules() {
	return [{
		pathMatcher(path) {
			return path.startsWith("/sign-in") || path.startsWith("/sign-up") || path.startsWith("/change-password") || path.startsWith("/change-email");
		},
		window: 10,
		max: 3
	}];
}

//#endregion
//#region src/oauth2/utils.ts
function decryptOAuthToken(token, ctx) {
	if (!token) return token;
	if (ctx.options.account?.encryptOAuthTokens) return symmetricDecrypt({
		key: ctx.secret,
		data: token
	});
	return token;
}
function setTokenUtil(token, ctx) {
	if (ctx.options.account?.encryptOAuthTokens && token) return symmetricEncrypt({
		key: ctx.secret,
		data: token
	});
	return token;
}

//#endregion
//#region src/api/routes/account.ts
const listUserAccounts = createAuthEndpoint("/list-accounts", {
	method: "GET",
	use: [sessionMiddleware],
	metadata: { openapi: {
		operationId: "listUserAccounts",
		description: "List all accounts linked to the user",
		responses: { "200": {
			description: "Success",
			content: { "application/json": { schema: {
				type: "array",
				items: {
					type: "object",
					properties: {
						id: { type: "string" },
						providerId: { type: "string" },
						createdAt: {
							type: "string",
							format: "date-time"
						},
						updatedAt: {
							type: "string",
							format: "date-time"
						},
						accountId: { type: "string" },
						userId: { type: "string" },
						scopes: {
							type: "array",
							items: { type: "string" }
						}
					},
					required: [
						"id",
						"providerId",
						"createdAt",
						"updatedAt",
						"accountId",
						"userId",
						"scopes"
					]
				}
			} } }
		} }
	} }
}, async (c) => {
	const session = c.context.session;
	const accounts = await c.context.internalAdapter.findAccounts(session.user.id);
	return c.json(accounts.map((a) => ({
		id: a.id,
		providerId: a.providerId,
		createdAt: a.createdAt,
		updatedAt: a.updatedAt,
		accountId: a.accountId,
		userId: a.userId,
		scopes: a.scope?.split(",") || []
	})));
});
const linkSocialAccount = createAuthEndpoint("/link-social", {
	method: "POST",
	requireHeaders: true,
	body: z.object({
		callbackURL: z.string().meta({ description: "The URL to redirect to after the user has signed in" }).optional(),
		provider: SocialProviderListEnum,
		idToken: z.object({
			token: z.string(),
			nonce: z.string().optional(),
			accessToken: z.string().optional(),
			refreshToken: z.string().optional(),
			scopes: z.array(z.string()).optional()
		}).optional(),
		requestSignUp: z.boolean().optional(),
		scopes: z.array(z.string()).meta({ description: "Additional scopes to request from the provider" }).optional(),
		errorCallbackURL: z.string().meta({ description: "The URL to redirect to if there is an error during the link process" }).optional(),
		disableRedirect: z.boolean().meta({ description: "Disable automatic redirection to the provider. Useful for handling the redirection yourself" }).optional(),
		additionalData: z.record(z.string(), z.any()).optional()
	}),
	use: [sessionMiddleware],
	metadata: { openapi: {
		description: "Link a social account to the user",
		operationId: "linkSocialAccount",
		responses: { "200": {
			description: "Success",
			content: { "application/json": { schema: {
				type: "object",
				properties: {
					url: {
						type: "string",
						description: "The authorization URL to redirect the user to"
					},
					redirect: {
						type: "boolean",
						description: "Indicates if the user should be redirected to the authorization URL"
					},
					status: { type: "boolean" }
				},
				required: ["redirect"]
			} } }
		} }
	} }
}, async (c) => {
	const session = c.context.session;
	const provider = c.context.socialProviders.find((p) => p.id === c.body.provider);
	if (!provider) {
		c.context.logger.error("Provider not found. Make sure to add the provider in your auth config", { provider: c.body.provider });
		throw new APIError("NOT_FOUND", { message: BASE_ERROR_CODES.PROVIDER_NOT_FOUND });
	}
	if (c.body.idToken) {
		if (!provider.verifyIdToken) {
			c.context.logger.error("Provider does not support id token verification", { provider: c.body.provider });
			throw new APIError("NOT_FOUND", { message: BASE_ERROR_CODES.ID_TOKEN_NOT_SUPPORTED });
		}
		const { token, nonce } = c.body.idToken;
		if (!await provider.verifyIdToken(token, nonce)) {
			c.context.logger.error("Invalid id token", { provider: c.body.provider });
			throw new APIError("UNAUTHORIZED", { message: BASE_ERROR_CODES.INVALID_TOKEN });
		}
		const linkingUserInfo = await provider.getUserInfo({
			idToken: token,
			accessToken: c.body.idToken.accessToken,
			refreshToken: c.body.idToken.refreshToken
		});
		if (!linkingUserInfo || !linkingUserInfo?.user) {
			c.context.logger.error("Failed to get user info", { provider: c.body.provider });
			throw new APIError("UNAUTHORIZED", { message: BASE_ERROR_CODES.FAILED_TO_GET_USER_INFO });
		}
		const linkingUserId = String(linkingUserInfo.user.id);
		if (!linkingUserInfo.user.email) {
			c.context.logger.error("User email not found", { provider: c.body.provider });
			throw new APIError("UNAUTHORIZED", { message: BASE_ERROR_CODES.USER_EMAIL_NOT_FOUND });
		}
		if ((await c.context.internalAdapter.findAccounts(session.user.id)).find((a) => a.providerId === provider.id && a.accountId === linkingUserId)) return c.json({
			url: "",
			status: true,
			redirect: false
		});
		if (!(c.context.options.account?.accountLinking?.trustedProviders)?.includes(provider.id) && !linkingUserInfo.user.emailVerified || c.context.options.account?.accountLinking?.enabled === false) throw new APIError("UNAUTHORIZED", { message: "Account not linked - linking not allowed" });
		if (linkingUserInfo.user.email !== session.user.email && c.context.options.account?.accountLinking?.allowDifferentEmails !== true) throw new APIError("UNAUTHORIZED", { message: "Account not linked - different emails not allowed" });
		try {
			await c.context.internalAdapter.createAccount({
				userId: session.user.id,
				providerId: provider.id,
				accountId: linkingUserId,
				accessToken: c.body.idToken.accessToken,
				idToken: token,
				refreshToken: c.body.idToken.refreshToken,
				scope: c.body.idToken.scopes?.join(",")
			});
		} catch (e) {
			throw new APIError("EXPECTATION_FAILED", { message: "Account not linked - unable to create account" });
		}
		if (c.context.options.account?.accountLinking?.updateUserInfoOnLink === true) try {
			await c.context.internalAdapter.updateUser(session.user.id, {
				name: linkingUserInfo.user?.name,
				image: linkingUserInfo.user?.image
			});
		} catch (e) {
			console.warn("Could not update user - " + e.toString());
		}
		return c.json({
			url: "",
			status: true,
			redirect: false
		});
	}
	const state = await generateState(c, {
		userId: session.user.id,
		email: session.user.email
	}, c.body.additionalData);
	const url = await provider.createAuthorizationURL({
		state: state.state,
		codeVerifier: state.codeVerifier,
		redirectURI: `${c.context.baseURL}/callback/${provider.id}`,
		scopes: c.body.scopes
	});
	return c.json({
		url: url.toString(),
		redirect: !c.body.disableRedirect
	});
});
const unlinkAccount = createAuthEndpoint("/unlink-account", {
	method: "POST",
	body: z.object({
		providerId: z.string(),
		accountId: z.string().optional()
	}),
	use: [freshSessionMiddleware],
	metadata: { openapi: {
		description: "Unlink an account",
		responses: { "200": {
			description: "Success",
			content: { "application/json": { schema: {
				type: "object",
				properties: { status: { type: "boolean" } }
			} } }
		} }
	} }
}, async (ctx) => {
	const { providerId, accountId } = ctx.body;
	const accounts = await ctx.context.internalAdapter.findAccounts(ctx.context.session.user.id);
	if (accounts.length === 1 && !ctx.context.options.account?.accountLinking?.allowUnlinkingAll) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.FAILED_TO_UNLINK_LAST_ACCOUNT });
	const accountExist = accounts.find((account) => accountId ? account.accountId === accountId && account.providerId === providerId : account.providerId === providerId);
	if (!accountExist) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.ACCOUNT_NOT_FOUND });
	await ctx.context.internalAdapter.deleteAccount(accountExist.id);
	return ctx.json({ status: true });
});
const getAccessToken = createAuthEndpoint("/get-access-token", {
	method: "POST",
	body: z.object({
		providerId: z.string().meta({ description: "The provider ID for the OAuth provider" }),
		accountId: z.string().meta({ description: "The account ID associated with the refresh token" }).optional(),
		userId: z.string().meta({ description: "The user ID associated with the account" }).optional()
	}),
	metadata: { openapi: {
		description: "Get a valid access token, doing a refresh if needed",
		responses: {
			200: {
				description: "A Valid access token",
				content: { "application/json": { schema: {
					type: "object",
					properties: {
						tokenType: { type: "string" },
						idToken: { type: "string" },
						accessToken: { type: "string" },
						refreshToken: { type: "string" },
						accessTokenExpiresAt: {
							type: "string",
							format: "date-time"
						},
						refreshTokenExpiresAt: {
							type: "string",
							format: "date-time"
						}
					}
				} } }
			},
			400: { description: "Invalid refresh token or provider configuration" }
		}
	} }
}, async (ctx) => {
	const { providerId, accountId, userId } = ctx.body || {};
	const req = ctx.request;
	const session = await getSessionFromCtx(ctx);
	if (req && !session) throw ctx.error("UNAUTHORIZED");
	let resolvedUserId = session?.user?.id || userId;
	if (!resolvedUserId) throw ctx.error("UNAUTHORIZED");
	if (!ctx.context.socialProviders.find((p) => p.id === providerId)) throw new APIError("BAD_REQUEST", { message: `Provider ${providerId} is not supported.` });
	const accountDataCookieName = ctx.context.authCookies.accountData.name;
	const accountDataCookie = await ctx.getSignedCookie(accountDataCookieName, ctx.context.secret);
	const accountData = accountDataCookie ? safeJSONParse(accountDataCookie) : null;
	let account = void 0;
	if (accountData && providerId === accountData.providerId && (!accountId || accountData.id === accountId)) account = accountData;
	else account = (await ctx.context.internalAdapter.findAccounts(resolvedUserId)).find((acc) => accountId ? acc.id === accountId && acc.providerId === providerId : acc.providerId === providerId);
	if (!account) throw new APIError("BAD_REQUEST", { message: "Account not found" });
	const provider = ctx.context.socialProviders.find((p) => p.id === providerId);
	if (!provider) throw new APIError("BAD_REQUEST", { message: `Provider ${providerId} not found.` });
	try {
		let newTokens = null;
		const accessTokenExpired = account.accessTokenExpiresAt && new Date(account.accessTokenExpiresAt).getTime() - Date.now() < 5e3;
		if (account.refreshToken && accessTokenExpired && provider.refreshAccessToken) {
			const refreshToken$1 = await decryptOAuthToken(account.refreshToken, ctx.context);
			newTokens = await provider.refreshAccessToken(refreshToken$1);
			const updatedAccount = await ctx.context.internalAdapter.updateAccount(account.id, {
				accessToken: await setTokenUtil(newTokens.accessToken, ctx.context),
				accessTokenExpiresAt: newTokens.accessTokenExpiresAt,
				refreshToken: await setTokenUtil(newTokens.refreshToken, ctx.context),
				refreshTokenExpiresAt: newTokens.refreshTokenExpiresAt
			});
			if (ctx.context.options.account?.storeAccountCookie && updatedAccount) await ctx.setSignedCookie(accountDataCookieName, JSON.stringify(updatedAccount), ctx.context.secret, ctx.context.authCookies.accountData.options);
		}
		const tokens = {
			accessToken: newTokens?.accessToken ?? await decryptOAuthToken(account.accessToken ?? "", ctx.context),
			accessTokenExpiresAt: newTokens?.accessTokenExpiresAt ?? account.accessTokenExpiresAt ?? void 0,
			scopes: account.scope?.split(",") ?? [],
			idToken: newTokens?.idToken ?? account.idToken ?? void 0
		};
		return ctx.json(tokens);
	} catch (error$1) {
		throw new APIError("BAD_REQUEST", {
			message: "Failed to get a valid access token",
			cause: error$1
		});
	}
});
const refreshToken = createAuthEndpoint("/refresh-token", {
	method: "POST",
	body: z.object({
		providerId: z.string().meta({ description: "The provider ID for the OAuth provider" }),
		accountId: z.string().meta({ description: "The account ID associated with the refresh token" }).optional(),
		userId: z.string().meta({ description: "The user ID associated with the account" }).optional()
	}),
	metadata: { openapi: {
		description: "Refresh the access token using a refresh token",
		responses: {
			200: {
				description: "Access token refreshed successfully",
				content: { "application/json": { schema: {
					type: "object",
					properties: {
						tokenType: { type: "string" },
						idToken: { type: "string" },
						accessToken: { type: "string" },
						refreshToken: { type: "string" },
						accessTokenExpiresAt: {
							type: "string",
							format: "date-time"
						},
						refreshTokenExpiresAt: {
							type: "string",
							format: "date-time"
						}
					}
				} } }
			},
			400: { description: "Invalid refresh token or provider configuration" }
		}
	} }
}, async (ctx) => {
	const { providerId, accountId, userId } = ctx.body;
	const req = ctx.request;
	const session = await getSessionFromCtx(ctx);
	if (req && !session) throw ctx.error("UNAUTHORIZED");
	let resolvedUserId = session?.user?.id || userId;
	if (!resolvedUserId) throw new APIError("BAD_REQUEST", { message: `Either userId or session is required` });
	const provider = ctx.context.socialProviders.find((p) => p.id === providerId);
	if (!provider) throw new APIError("BAD_REQUEST", { message: `Provider ${providerId} not found.` });
	if (!provider.refreshAccessToken) throw new APIError("BAD_REQUEST", { message: `Provider ${providerId} does not support token refreshing.` });
	const accountDataCookieName = ctx.context.authCookies.accountData.name;
	const accountDataCookie = await ctx.getSignedCookie(accountDataCookieName, ctx.context.secret);
	let account = void 0;
	const accountData = accountDataCookie ? safeJSONParse(accountDataCookie) : null;
	if (accountData && (!providerId || providerId === accountData?.providerId)) account = accountData;
	else account = (await ctx.context.internalAdapter.findAccounts(resolvedUserId)).find((acc) => accountId ? acc.id === accountId && acc.providerId === providerId : acc.providerId === providerId);
	if (!account) throw new APIError("BAD_REQUEST", { message: "Account not found" });
	let refreshToken$1 = void 0;
	if (accountData && providerId === accountData.providerId) refreshToken$1 = accountData.refreshToken ?? void 0;
	else refreshToken$1 = account.refreshToken ?? void 0;
	if (!refreshToken$1) throw new APIError("BAD_REQUEST", { message: "Refresh token not found" });
	try {
		const decryptedRefreshToken = await decryptOAuthToken(refreshToken$1, ctx.context);
		const tokens = await provider.refreshAccessToken(decryptedRefreshToken);
		if (account.id) {
			const updateData = {
				...account || {},
				accessToken: await setTokenUtil(tokens.accessToken, ctx.context),
				refreshToken: await setTokenUtil(tokens.refreshToken, ctx.context),
				accessTokenExpiresAt: tokens.accessTokenExpiresAt,
				refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
				scope: tokens.scopes?.join(",") || account.scope,
				idToken: tokens.idToken || account.idToken
			};
			await ctx.context.internalAdapter.updateAccount(account.id, updateData);
		}
		if (accountData && providerId === accountData.providerId && ctx.context.options.account?.storeAccountCookie) {
			const updateData = {
				...accountData,
				accessToken: await setTokenUtil(tokens.accessToken, ctx.context),
				refreshToken: await setTokenUtil(tokens.refreshToken, ctx.context),
				accessTokenExpiresAt: tokens.accessTokenExpiresAt,
				refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
				scope: tokens.scopes?.join(",") || accountData.scope,
				idToken: tokens.idToken || accountData.idToken
			};
			await ctx.setSignedCookie(accountDataCookieName, JSON.stringify(updateData), ctx.context.secret, ctx.context.authCookies.accountData.options);
		}
		return ctx.json({
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
			accessTokenExpiresAt: tokens.accessTokenExpiresAt,
			refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
			scope: tokens.scopes?.join(",") || account.scope,
			idToken: tokens.idToken || account.idToken,
			providerId: account.providerId,
			accountId: account.accountId
		});
	} catch (error$1) {
		throw new APIError("BAD_REQUEST", {
			message: "Failed to refresh access token",
			cause: error$1
		});
	}
});
const accountInfoQuerySchema = z.optional(z.object({ accountId: z.string().meta({ description: "The provider given account id for which to get the account info" }).optional() }));
const accountInfo = createAuthEndpoint("/account-info", {
	method: "GET",
	use: [sessionMiddleware],
	metadata: { openapi: {
		description: "Get the account info provided by the provider",
		responses: { "200": {
			description: "Success",
			content: { "application/json": { schema: {
				type: "object",
				properties: {
					user: {
						type: "object",
						properties: {
							id: { type: "string" },
							name: { type: "string" },
							email: { type: "string" },
							image: { type: "string" },
							emailVerified: { type: "boolean" }
						},
						required: ["id", "emailVerified"]
					},
					data: {
						type: "object",
						properties: {},
						additionalProperties: true
					}
				},
				required: ["user", "data"],
				additionalProperties: false
			} } }
		} }
	} },
	query: accountInfoQuerySchema
}, async (ctx) => {
	const providedAccountId = ctx.query?.accountId;
	let account = void 0;
	if (!providedAccountId) {
		if (ctx.context.options.account?.storeAccountCookie) {
			const accountCookieName = ctx.context.authCookies.accountData.name;
			const accountCookie = await ctx.getSignedCookie(accountCookieName, ctx.context.secret);
			if (accountCookie) {
				const accountData = safeJSONParse(accountCookie);
				if (accountData) account = accountData;
			}
		}
	} else {
		const accountData = await ctx.context.internalAdapter.findAccount(providedAccountId);
		if (accountData) account = accountData;
	}
	if (!account || account.userId !== ctx.context.session.user.id) throw new APIError("BAD_REQUEST", { message: "Account not found" });
	const provider = ctx.context.socialProviders.find((p) => p.id === account.providerId);
	if (!provider) throw new APIError("INTERNAL_SERVER_ERROR", { message: `Provider account provider is ${account.providerId} but it is not configured` });
	const tokens = await getAccessToken({
		...ctx,
		method: "POST",
		body: {
			accountId: account.id,
			providerId: account.providerId
		},
		returnHeaders: false,
		returnStatus: false
	});
	if (!tokens.accessToken) throw new APIError("BAD_REQUEST", { message: "Access token not found" });
	const info = await provider.getUserInfo({
		...tokens,
		accessToken: tokens.accessToken
	});
	return ctx.json(info);
});

//#endregion
//#region src/oauth2/link-account.ts
async function handleOAuthUserInfo(c, { userInfo, account, callbackURL, disableSignUp, overrideUserInfo }) {
	const dbUser = await c.context.internalAdapter.findOAuthUser(userInfo.email.toLowerCase(), account.accountId, account.providerId).catch((e) => {
		logger.error("Better auth was unable to query your database.\nError: ", e);
		const errorURL = c.context.options.onAPIError?.errorURL || `${c.context.baseURL}/error`;
		throw c.redirect(`${errorURL}?error=internal_server_error`);
	});
	let user = dbUser?.user;
	let isRegister = !user;
	if (dbUser) {
		const hasBeenLinked = dbUser.accounts.find((a) => a.providerId === account.providerId && a.accountId === account.accountId);
		if (!hasBeenLinked) {
			if (!(c.context.options.account?.accountLinking?.trustedProviders)?.includes(account.providerId) && !userInfo.emailVerified || c.context.options.account?.accountLinking?.enabled === false) {
				if (isDevelopment()) logger.warn(`User already exist but account isn't linked to ${account.providerId}. To read more about how account linking works in Better Auth see https://www.better-auth.com/docs/concepts/users-accounts#account-linking.`);
				return {
					error: "account not linked",
					data: null
				};
			}
			try {
				await c.context.internalAdapter.linkAccount({
					providerId: account.providerId,
					accountId: userInfo.id.toString(),
					userId: dbUser.user.id,
					accessToken: await setTokenUtil(account.accessToken, c.context),
					refreshToken: await setTokenUtil(account.refreshToken, c.context),
					idToken: account.idToken,
					accessTokenExpiresAt: account.accessTokenExpiresAt,
					refreshTokenExpiresAt: account.refreshTokenExpiresAt,
					scope: account.scope
				});
			} catch (e) {
				logger.error("Unable to link account", e);
				return {
					error: "unable to link account",
					data: null
				};
			}
			if (userInfo.emailVerified && !dbUser.user.emailVerified && userInfo.email.toLowerCase() === dbUser.user.email) await c.context.internalAdapter.updateUser(dbUser.user.id, { emailVerified: true });
		} else {
			if (c.context.options.account?.updateAccountOnSignIn !== false) {
				const updateData = Object.fromEntries(Object.entries({
					idToken: account.idToken,
					accessToken: await setTokenUtil(account.accessToken, c.context),
					refreshToken: await setTokenUtil(account.refreshToken, c.context),
					accessTokenExpiresAt: account.accessTokenExpiresAt,
					refreshTokenExpiresAt: account.refreshTokenExpiresAt,
					scope: account.scope
				}).filter(([_, value]) => value !== void 0));
				if (c.context.options.account?.storeAccountCookie) {
					const accountDataCookie = c.context.authCookies.accountData;
					await c.setSignedCookie(accountDataCookie.name, JSON.stringify(updateData), c.context.secret, accountDataCookie.options);
				}
				if (Object.keys(updateData).length > 0) await c.context.internalAdapter.updateAccount(hasBeenLinked.id, updateData);
			}
			if (userInfo.emailVerified && !dbUser.user.emailVerified && userInfo.email.toLowerCase() === dbUser.user.email) await c.context.internalAdapter.updateUser(dbUser.user.id, { emailVerified: true });
		}
		if (overrideUserInfo) {
			const { id: _, ...restUserInfo } = userInfo;
			user = await c.context.internalAdapter.updateUser(dbUser.user.id, {
				...restUserInfo,
				email: userInfo.email.toLowerCase(),
				emailVerified: userInfo.email.toLowerCase() === dbUser.user.email ? dbUser.user.emailVerified || userInfo.emailVerified : userInfo.emailVerified
			});
		}
	} else {
		if (disableSignUp) return {
			error: "signup disabled",
			data: null,
			isRegister: false
		};
		try {
			const { id: _, ...restUserInfo } = userInfo;
			const accountData = {
				accessToken: await setTokenUtil(account.accessToken, c.context),
				refreshToken: await setTokenUtil(account.refreshToken, c.context),
				idToken: account.idToken,
				accessTokenExpiresAt: account.accessTokenExpiresAt,
				refreshTokenExpiresAt: account.refreshTokenExpiresAt,
				scope: account.scope,
				providerId: account.providerId,
				accountId: userInfo.id.toString()
			};
			const { user: createdUser, account: createdAccount } = await c.context.internalAdapter.createOAuthUser({
				...restUserInfo,
				email: userInfo.email.toLowerCase()
			}, accountData);
			user = createdUser;
			if (c.context.options.account?.storeAccountCookie) {
				const accountDataCookie = c.context.authCookies.accountData;
				await c.setSignedCookie(accountDataCookie.name, JSON.stringify(createdAccount), c.context.secret, accountDataCookie.options);
			}
			if (!userInfo.emailVerified && user && c.context.options.emailVerification?.sendOnSignUp) {
				const token = await createEmailVerificationToken(c.context.secret, user.email, void 0, c.context.options.emailVerification?.expiresIn);
				const url = `${c.context.baseURL}/verify-email?token=${token}&callbackURL=${callbackURL}`;
				await c.context.options.emailVerification?.sendVerificationEmail?.({
					user,
					url,
					token
				}, c.request);
			}
		} catch (e) {
			logger.error(e);
			if (e instanceof APIError$1) return {
				error: e.message,
				data: null,
				isRegister: false
			};
			return {
				error: "unable to create user",
				data: null,
				isRegister: false
			};
		}
	}
	if (!user) return {
		error: "unable to create user",
		data: null,
		isRegister: false
	};
	const session = await c.context.internalAdapter.createSession(user.id);
	if (!session) return {
		error: "unable to create session",
		data: null,
		isRegister: false
	};
	return {
		data: {
			session,
			user
		},
		error: null,
		isRegister
	};
}

//#endregion
//#region src/api/routes/callback.ts
const schema = z.object({
	code: z.string().optional(),
	error: z.string().optional(),
	device_id: z.string().optional(),
	error_description: z.string().optional(),
	state: z.string().optional(),
	user: z.string().optional()
});
const callbackOAuth = createAuthEndpoint("/callback/:id", {
	method: ["GET", "POST"],
	operationId: "handleOAuthCallback",
	body: schema.optional(),
	query: schema.optional(),
	metadata: {
		...HIDE_METADATA,
		allowedMediaTypes: ["application/x-www-form-urlencoded", "application/json"]
	}
}, async (c) => {
	let queryOrBody;
	const defaultErrorURL = c.context.options.onAPIError?.errorURL || `${c.context.baseURL}/error`;
	if (c.method === "POST") {
		const postData = c.body ? schema.parse(c.body) : {};
		const queryData = c.query ? schema.parse(c.query) : {};
		const mergedData = schema.parse({
			...postData,
			...queryData
		});
		const params = new URLSearchParams();
		for (const [key, value] of Object.entries(mergedData)) if (value !== void 0 && value !== null) params.set(key, String(value));
		const redirectURL = `${c.context.baseURL}/callback/${c.params.id}?${params.toString()}`;
		throw c.redirect(redirectURL);
	}
	try {
		if (c.method === "GET") queryOrBody = schema.parse(c.query);
		else if (c.method === "POST") queryOrBody = schema.parse(c.body);
		else throw new Error("Unsupported method");
	} catch (e) {
		c.context.logger.error("INVALID_CALLBACK_REQUEST", e);
		throw c.redirect(`${defaultErrorURL}?error=invalid_callback_request`);
	}
	const { code, error: error$1, state, error_description, device_id } = queryOrBody;
	if (!state) {
		c.context.logger.error("State not found", error$1);
		const url = `${defaultErrorURL}${defaultErrorURL.includes("?") ? "&" : "?"}state=state_not_found`;
		throw c.redirect(url);
	}
	const { codeVerifier, callbackURL, link, errorURL, newUserURL, requestSignUp } = await parseState(c);
	function redirectOnError(error$2, description) {
		const baseURL = errorURL ?? defaultErrorURL;
		const params = new URLSearchParams({ error: error$2 });
		if (description) params.set("error_description", description);
		const url = `${baseURL}${baseURL.includes("?") ? "&" : "?"}${params.toString()}`;
		throw c.redirect(url);
	}
	if (error$1) redirectOnError(error$1, error_description);
	if (!code) {
		c.context.logger.error("Code not found");
		throw redirectOnError("no_code");
	}
	const provider = c.context.socialProviders.find((p) => p.id === c.params.id);
	if (!provider) {
		c.context.logger.error("Oauth provider with id", c.params.id, "not found");
		throw redirectOnError("oauth_provider_not_found");
	}
	let tokens;
	try {
		tokens = await provider.validateAuthorizationCode({
			code,
			codeVerifier,
			deviceId: device_id,
			redirectURI: `${c.context.baseURL}/callback/${provider.id}`
		});
	} catch (e) {
		c.context.logger.error("", e);
		throw redirectOnError("invalid_code");
	}
	const userInfo = await provider.getUserInfo({
		...tokens,
		user: c.body?.user ? safeJSONParse(c.body.user) : void 0
	}).then((res) => res?.user);
	if (!userInfo) {
		c.context.logger.error("Unable to get user info");
		return redirectOnError("unable_to_get_user_info");
	}
	if (!callbackURL) {
		c.context.logger.error("No callback URL found");
		throw redirectOnError("no_callback_url");
	}
	if (link) {
		if (!(c.context.options.account?.accountLinking?.trustedProviders)?.includes(provider.id) && !userInfo.emailVerified || c.context.options.account?.accountLinking?.enabled === false) {
			c.context.logger.error("Unable to link account - untrusted provider");
			return redirectOnError("unable_to_link_account");
		}
		if (userInfo.email !== link.email && c.context.options.account?.accountLinking?.allowDifferentEmails !== true) return redirectOnError("email_doesn't_match");
		const existingAccount = await c.context.internalAdapter.findAccount(String(userInfo.id));
		if (existingAccount) {
			if (existingAccount.userId.toString() !== link.userId.toString()) return redirectOnError("account_already_linked_to_different_user");
			const updateData = Object.fromEntries(Object.entries({
				accessToken: await setTokenUtil(tokens.accessToken, c.context),
				refreshToken: await setTokenUtil(tokens.refreshToken, c.context),
				idToken: tokens.idToken,
				accessTokenExpiresAt: tokens.accessTokenExpiresAt,
				refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
				scope: tokens.scopes?.join(",")
			}).filter(([_, value]) => value !== void 0));
			await c.context.internalAdapter.updateAccount(existingAccount.id, updateData);
		} else if (!await c.context.internalAdapter.createAccount({
			userId: link.userId,
			providerId: provider.id,
			accountId: String(userInfo.id),
			...tokens,
			accessToken: await setTokenUtil(tokens.accessToken, c.context),
			refreshToken: await setTokenUtil(tokens.refreshToken, c.context),
			scope: tokens.scopes?.join(",")
		})) return redirectOnError("unable_to_link_account");
		let toRedirectTo$1;
		try {
			toRedirectTo$1 = callbackURL.toString();
		} catch {
			toRedirectTo$1 = callbackURL;
		}
		throw c.redirect(toRedirectTo$1);
	}
	if (!userInfo.email) {
		c.context.logger.error("Provider did not return email. This could be due to misconfiguration in the provider settings.");
		return redirectOnError("email_not_found");
	}
	const accountData = {
		providerId: provider.id,
		accountId: String(userInfo.id),
		...tokens,
		scope: tokens.scopes?.join(",")
	};
	const result = await handleOAuthUserInfo(c, {
		userInfo: {
			...userInfo,
			id: String(userInfo.id),
			email: userInfo.email,
			name: userInfo.name || userInfo.email
		},
		account: accountData,
		callbackURL,
		disableSignUp: provider.disableImplicitSignUp && !requestSignUp || provider.options?.disableSignUp,
		overrideUserInfo: provider.options?.overrideUserInfoOnSignIn
	});
	if (result.error) {
		c.context.logger.error(result.error.split(" ").join("_"));
		return redirectOnError(result.error.split(" ").join("_"));
	}
	const { session, user } = result.data;
	await setSessionCookie(c, {
		session,
		user
	});
	let toRedirectTo;
	try {
		toRedirectTo = (result.isRegister ? newUserURL || callbackURL : callbackURL).toString();
	} catch {
		toRedirectTo = result.isRegister ? newUserURL || callbackURL : callbackURL;
	}
	throw c.redirect(toRedirectTo);
});

//#endregion
//#region src/api/routes/email-verification.ts
async function createEmailVerificationToken(secret, email, updateTo, expiresIn = 3600, extraPayload) {
	return await signJWT({
		email: email.toLowerCase(),
		updateTo,
		...extraPayload
	}, secret, expiresIn);
}
/**
* A function to send a verification email to the user
*/
async function sendVerificationEmailFn(ctx, user) {
	if (!ctx.context.options.emailVerification?.sendVerificationEmail) {
		ctx.context.logger.error("Verification email isn't enabled.");
		throw new APIError("BAD_REQUEST", { message: "Verification email isn't enabled" });
	}
	const token = await createEmailVerificationToken(ctx.context.secret, user.email, void 0, ctx.context.options.emailVerification?.expiresIn);
	const callbackURL = ctx.body.callbackURL ? encodeURIComponent(ctx.body.callbackURL) : encodeURIComponent("/");
	const url = `${ctx.context.baseURL}/verify-email?token=${token}&callbackURL=${callbackURL}`;
	await ctx.context.options.emailVerification.sendVerificationEmail({
		user,
		url,
		token
	}, ctx.request);
}
const sendVerificationEmail = createAuthEndpoint("/send-verification-email", {
	method: "POST",
	operationId: "sendVerificationEmail",
	body: z.object({
		email: z.email().meta({ description: "The email to send the verification email to" }),
		callbackURL: z.string().meta({ description: "The URL to use for email verification callback" }).optional()
	}),
	metadata: { openapi: {
		operationId: "sendVerificationEmail",
		description: "Send a verification email to the user",
		requestBody: { content: { "application/json": { schema: {
			type: "object",
			properties: {
				email: {
					type: "string",
					description: "The email to send the verification email to",
					example: "user@example.com"
				},
				callbackURL: {
					type: "string",
					description: "The URL to use for email verification callback",
					example: "https://example.com/callback",
					nullable: true
				}
			},
			required: ["email"]
		} } } },
		responses: {
			"200": {
				description: "Success",
				content: { "application/json": { schema: {
					type: "object",
					properties: { status: {
						type: "boolean",
						description: "Indicates if the email was sent successfully",
						example: true
					} }
				} } }
			},
			"400": {
				description: "Bad Request",
				content: { "application/json": { schema: {
					type: "object",
					properties: { message: {
						type: "string",
						description: "Error message",
						example: "Verification email isn't enabled"
					} }
				} } }
			}
		}
	} }
}, async (ctx) => {
	if (!ctx.context.options.emailVerification?.sendVerificationEmail) {
		ctx.context.logger.error("Verification email isn't enabled.");
		throw new APIError("BAD_REQUEST", { message: "Verification email isn't enabled" });
	}
	const { email } = ctx.body;
	const session = await getSessionFromCtx(ctx);
	if (!session) {
		const user = await ctx.context.internalAdapter.findUserByEmail(email);
		if (!user) {
			await createEmailVerificationToken(ctx.context.secret, email, void 0, ctx.context.options.emailVerification?.expiresIn);
			return ctx.json({ status: true });
		}
		await sendVerificationEmailFn(ctx, user.user);
		return ctx.json({ status: true });
	}
	if (session?.user.emailVerified) throw new APIError("BAD_REQUEST", { message: "You can only send a verification email to an unverified email" });
	if (session?.user.email !== email) throw new APIError("BAD_REQUEST", { message: "You can only send a verification email to your own email" });
	await sendVerificationEmailFn(ctx, session.user);
	return ctx.json({ status: true });
});
const verifyEmail = createAuthEndpoint("/verify-email", {
	method: "GET",
	operationId: "verifyEmail",
	query: z.object({
		token: z.string().meta({ description: "The token to verify the email" }),
		callbackURL: z.string().meta({ description: "The URL to redirect to after email verification" }).optional()
	}),
	use: [originCheck((ctx) => ctx.query.callbackURL)],
	metadata: { openapi: {
		description: "Verify the email of the user",
		parameters: [{
			name: "token",
			in: "query",
			description: "The token to verify the email",
			required: true,
			schema: { type: "string" }
		}, {
			name: "callbackURL",
			in: "query",
			description: "The URL to redirect to after email verification",
			required: false,
			schema: { type: "string" }
		}],
		responses: { "200": {
			description: "Success",
			content: { "application/json": { schema: {
				type: "object",
				properties: {
					user: {
						type: "object",
						$ref: "#/components/schemas/User"
					},
					status: {
						type: "boolean",
						description: "Indicates if the email was verified successfully"
					}
				},
				required: ["user", "status"]
			} } }
		} }
	} }
}, async (ctx) => {
	function redirectOnError(error$1) {
		if (ctx.query.callbackURL) {
			if (ctx.query.callbackURL.includes("?")) throw ctx.redirect(`${ctx.query.callbackURL}&error=${error$1}`);
			throw ctx.redirect(`${ctx.query.callbackURL}?error=${error$1}`);
		}
		throw new APIError("UNAUTHORIZED", { message: error$1 });
	}
	const { token } = ctx.query;
	let jwt;
	try {
		jwt = await jwtVerify(token, new TextEncoder().encode(ctx.context.secret), { algorithms: ["HS256"] });
	} catch (e) {
		if (e instanceof JWTExpired) return redirectOnError("token_expired");
		return redirectOnError("invalid_token");
	}
	const parsed = z.object({
		email: z.email(),
		updateTo: z.string().optional(),
		requestType: z.string().optional()
	}).parse(jwt.payload);
	const user = await ctx.context.internalAdapter.findUserByEmail(parsed.email);
	if (!user) return redirectOnError("user_not_found");
	if (parsed.updateTo) {
		let session = await getSessionFromCtx(ctx);
		if (session && session.user.email !== parsed.email) return redirectOnError("unauthorized");
		if (parsed.requestType === "change-email-confirmation") {
			const newToken$1 = await createEmailVerificationToken(ctx.context.secret, parsed.email, parsed.updateTo, ctx.context.options.emailVerification?.expiresIn, { requestType: "change-email-verification" });
			const updateCallbackURL$1 = ctx.query.callbackURL ? encodeURIComponent(ctx.query.callbackURL) : encodeURIComponent("/");
			const url = `${ctx.context.baseURL}/verify-email?token=${newToken$1}&callbackURL=${updateCallbackURL$1}`;
			await ctx.context.options.emailVerification?.sendVerificationEmail?.({
				user: {
					...user.user,
					email: parsed.updateTo
				},
				url,
				token: newToken$1
			}, ctx.request);
			if (ctx.query.callbackURL) throw ctx.redirect(ctx.query.callbackURL);
			return ctx.json({ status: true });
		}
		if (!session) {
			const newSession = await ctx.context.internalAdapter.createSession(user.user.id);
			if (!newSession) throw new APIError("INTERNAL_SERVER_ERROR", { message: "Failed to create session" });
			session = {
				session: newSession,
				user: user.user
			};
		}
		if (parsed.requestType === "change-email-verification") {
			const updatedUser$2 = await ctx.context.internalAdapter.updateUserByEmail(parsed.email, {
				email: parsed.updateTo,
				emailVerified: true
			});
			await setSessionCookie(ctx, {
				session: session.session,
				user: {
					...session.user,
					email: parsed.updateTo,
					emailVerified: true
				}
			});
			if (ctx.query.callbackURL) throw ctx.redirect(ctx.query.callbackURL);
			return ctx.json({
				status: true,
				user: updatedUser$2
			});
		}
		const updatedUser$1 = await ctx.context.internalAdapter.updateUserByEmail(parsed.email, {
			email: parsed.updateTo,
			emailVerified: false
		});
		const newToken = await createEmailVerificationToken(ctx.context.secret, parsed.updateTo);
		const updateCallbackURL = ctx.query.callbackURL ? encodeURIComponent(ctx.query.callbackURL) : encodeURIComponent("/");
		await ctx.context.options.emailVerification?.sendVerificationEmail?.({
			user: updatedUser$1,
			url: `${ctx.context.baseURL}/verify-email?token=${newToken}&callbackURL=${updateCallbackURL}`,
			token: newToken
		}, ctx.request);
		await setSessionCookie(ctx, {
			session: session.session,
			user: {
				...session.user,
				email: parsed.updateTo,
				emailVerified: false
			}
		});
		if (ctx.query.callbackURL) throw ctx.redirect(ctx.query.callbackURL);
		return ctx.json({
			status: true,
			user: {
				id: updatedUser$1.id,
				email: updatedUser$1.email,
				name: updatedUser$1.name,
				image: updatedUser$1.image,
				emailVerified: updatedUser$1.emailVerified,
				createdAt: updatedUser$1.createdAt,
				updatedAt: updatedUser$1.updatedAt
			}
		});
	}
	if (user.user.emailVerified) {
		if (ctx.query.callbackURL) throw ctx.redirect(ctx.query.callbackURL);
		return ctx.json({
			status: true,
			user: null
		});
	}
	if (ctx.context.options.emailVerification?.onEmailVerification) await ctx.context.options.emailVerification.onEmailVerification(user.user, ctx.request);
	const updatedUser = await ctx.context.internalAdapter.updateUserByEmail(parsed.email, { emailVerified: true });
	if (ctx.context.options.emailVerification?.afterEmailVerification) await ctx.context.options.emailVerification.afterEmailVerification(updatedUser, ctx.request);
	if (ctx.context.options.emailVerification?.autoSignInAfterVerification) {
		const currentSession = await getSessionFromCtx(ctx);
		if (!currentSession || currentSession.user.email !== parsed.email) {
			const session = await ctx.context.internalAdapter.createSession(user.user.id);
			if (!session) throw new APIError("INTERNAL_SERVER_ERROR", { message: "Failed to create session" });
			await setSessionCookie(ctx, {
				session,
				user: {
					...user.user,
					emailVerified: true
				}
			});
		} else await setSessionCookie(ctx, {
			session: currentSession.session,
			user: {
				...currentSession.user,
				emailVerified: true
			}
		});
	}
	if (ctx.query.callbackURL) throw ctx.redirect(ctx.query.callbackURL);
	return ctx.json({
		status: true,
		user: null
	});
});

//#endregion
//#region src/api/routes/error.ts
function sanitize(input) {
	return input.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/&(?!amp;|lt;|gt;|quot;|#39;|#x[0-9a-fA-F]+;|#[0-9]+;)/g, "&amp;");
}
const html = (options, code = "Unknown", description = null) => {
	const custom = options.onAPIError?.customizeDefaultErrorPage;
	return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Error</title>
    <style>
      * {
        box-sizing: border-box;
      }
      body {
        font-family: ${custom?.font?.defaultFamily || "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"};
        background: ${custom?.colors?.background || "var(--background)"};
        color: var(--foreground);
        margin: 0;
      }
      :root,
      :host {
        --spacing: 0.25rem;
        --container-md: 28rem;
        --text-sm: ${custom?.size?.textSm || "0.875rem"};
        --text-sm--line-height: calc(1.25 / 0.875);
        --text-2xl: ${custom?.size?.text2xl || "1.5rem"};
        --text-2xl--line-height: calc(2 / 1.5);
        --text-4xl: ${custom?.size?.text4xl || "2.25rem"};
        --text-4xl--line-height: calc(2.5 / 2.25);
        --text-6xl: ${custom?.size?.text6xl || "3rem"};
        --text-6xl--line-height: 1;
        --font-weight-medium: 500;
        --font-weight-semibold: 600;
        --font-weight-bold: 700;
        --default-transition-duration: 150ms;
        --default-transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        --radius: ${custom?.size?.radiusSm || "0.625rem"};
        --default-mono-font-family: ${custom?.font?.monoFamily || "var(--font-geist-mono)"};
        --primary: ${custom?.colors?.primary || "black"};
        --primary-foreground: ${custom?.colors?.primaryForeground || "white"};
        --background: ${custom?.colors?.background || "white"};
        --foreground: ${custom?.colors?.foreground || "oklch(0.271 0 0)"};
        --border: ${custom?.colors?.border || "oklch(0.89 0 0)"};
        --destructive: ${custom?.colors?.destructive || "oklch(0.55 0.15 25.723)"};
        --muted-foreground: ${custom?.colors?.mutedForeground || "oklch(0.545 0 0)"};
        --corner-border: ${custom?.colors?.cornerBorder || "#404040"};
      }

      button, .btn {
        cursor: pointer;
        background: none;
        border: none;
        color: inherit;
        font: inherit;
        transition: all var(--default-transition-duration)
          var(--default-transition-timing-function);
      }
      button:hover, .btn:hover {
        opacity: 0.8;
      }

      @media (prefers-color-scheme: dark) {
        :root,
        :host {
          --primary: ${custom?.colors?.primary || "white"};
          --primary-foreground: ${custom?.colors?.primaryForeground || "black"};
          --background: ${custom?.colors?.background || "oklch(0.15 0 0)"};
          --foreground: ${custom?.colors?.foreground || "oklch(0.98 0 0)"};
          --border: ${custom?.colors?.border || "oklch(0.27 0 0)"};
          --destructive: ${custom?.colors?.destructive || "oklch(0.65 0.15 25.723)"};
          --muted-foreground: ${custom?.colors?.mutedForeground || "oklch(0.65 0 0)"};
          --corner-border: ${custom?.colors?.cornerBorder || "#a0a0a0"};
        }
      }
      @media (max-width: 640px) {
        :root, :host {
          --text-6xl: 2.5rem;
          --text-2xl: 1.25rem;
          --text-sm: 0.8125rem;
        }
      }
      @media (max-width: 480px) {
        :root, :host {
          --text-6xl: 2rem;
          --text-2xl: 1.125rem;
        }
      }
    </style>
  </head>
  <body style="width: 100vw; min-height: 100vh; overflow-x: hidden; overflow-y: auto;">
    <div
        style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 1.5rem;
            position: relative;
            width: 100%;
            min-height: 100vh;
            padding: 1rem;
        "
        >
${custom?.disableBackgroundGrid ? "" : `
      <div
        style="
          position: absolute;
          inset: 0;
          background-image: linear-gradient(to right, ${custom?.colors?.gridColor || "var(--border)"} 1px, transparent 1px),
            linear-gradient(to bottom, ${custom?.colors?.gridColor || "var(--border)"} 1px, transparent 1px);
          background-size: 40px 40px;
          opacity: 0.6;
          pointer-events: none;
          width: 100vw;
          height: 100vh;
        "
      ></div>
      <div
        style="
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: ${custom?.colors?.background || "var(--background)"};
          mask-image: radial-gradient(ellipse at center, transparent 20%, black);
          -webkit-mask-image: radial-gradient(ellipse at center, transparent 20%, black);
          pointer-events: none;
        "
      ></div>
`}

<div
  style="
    position: relative;
    z-index: 10;
    border: 2px solid var(--border);
    background: ${custom?.colors?.cardBackground || "var(--background)"};
    padding: 1.5rem;
    max-width: 42rem;
    width: 100%;
  "
>
    ${custom?.disableCornerDecorations ? "" : `
        <!-- Corner decorations -->
        <div
          style="
            position: absolute;
            top: -2px;
            left: -2px;
            width: 2rem;
            height: 2rem;
            border-top: 4px solid var(--corner-border);
            border-left: 4px solid var(--corner-border);
          "
        ></div>
        <div
          style="
            position: absolute;
            top: -2px;
            right: -2px;
            width: 2rem;
            height: 2rem;
            border-top: 4px solid var(--corner-border);
            border-right: 4px solid var(--corner-border);
          "
        ></div>
  
        <div
          style="
            position: absolute;
            bottom: -2px;
            left: -2px;
            width: 2rem;
            height: 2rem;
            border-bottom: 4px solid var(--corner-border);
            border-left: 4px solid var(--corner-border);
          "
        ></div>
        <div
          style="
            position: absolute;
            bottom: -2px;
            right: -2px;
            width: 2rem;
            height: 2rem;
            border-bottom: 4px solid var(--corner-border);
            border-right: 4px solid var(--corner-border);
          "
        ></div>`}

        <div style="text-align: center; margin-bottom: 1.5rem;">
          <div style="margin-bottom: 1.5rem;">
            <div
              style="
                display: inline-block;
                border: 2px solid ${custom?.disableTitleBorder ? "transparent" : custom?.colors?.titleBorder || "var(--destructive)"};
                padding: 0.375rem 1rem;
              "
            >
              <h1
                style="
                  font-size: var(--text-6xl);
                  font-weight: var(--font-weight-semibold);
                  color: ${custom?.colors?.titleColor || "var(--foreground)"};
                  letter-spacing: -0.02em;
                  margin: 0;
                "
              >
                ERROR
              </h1>
            </div>
            <div
              style="
                height: 2px;
                background-color: var(--border);
                width: calc(100% + 3rem);
                margin-left: -1.5rem;
                margin-top: 1.5rem;
              "
            ></div>
          </div>

          <h2
            style="
              font-size: var(--text-2xl);
              font-weight: var(--font-weight-semibold);
              color: var(--foreground);
              margin: 0 0 1rem;
            "
          >
            Something went wrong
          </h2>

          <div
            style="
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                border: 2px solid var(--border);
                background-color: var(--muted);
                padding: 0.375rem 0.75rem;
                margin: 0 0 1rem;
                flex-wrap: wrap;
                justify-content: center;
            "
            >
            <span
                style="
                font-size: 0.75rem;
                color: var(--muted-foreground);
                font-weight: var(--font-weight-semibold);
                "
            >
                CODE:
            </span>
            <span
                style="
                font-size: var(--text-sm);
                font-family: var(--default-mono-font-family, monospace);
                color: var(--foreground);
                word-break: break-all;
                "
            >
                ${sanitize(code)}
            </span>
            </div>

          <p
            style="
              color: var(--muted-foreground);
              max-width: 28rem;
              margin: 0 auto;
              font-size: var(--text-sm);
              line-height: 1.5;
              text-wrap: pretty;
            "
          >
            ${!description ? `We encountered an unexpected error. Please try again or return to the home page. If you're a developer, you can find more information about the error <a href='https://better-auth.com/docs/errors/${encodeURIComponent(code)}' target='_blank' rel="noopener noreferrer" style='color: var(--foreground); text-decoration: underline;'>here</a>.` : description}
          </p>
        </div>

        <div
          style="
            display: flex;
            gap: 0.75rem;
            margin-top: 1.5rem;
            justify-content: center;
            flex-wrap: wrap;
          "
        >
          <a
            href="/"
            style="
              text-decoration: none;
            "
          >
            <div
              style="
                border: 2px solid var(--border);
                background: var(--primary);
                color: var(--primary-foreground);
                padding: 0.5rem 1rem;
                border-radius: 0;
                white-space: nowrap;
              "
              class="btn"
            >
              Go Home
            </div>
          </a>
          <a
            href="https://better-auth.com/docs/errors/${encodeURIComponent(code)}?askai=${encodeURIComponent(`What does the error code ${code} mean?`)}"
            target="_blank"
            rel="noopener noreferrer"
            style="
              text-decoration: none;
            "
          >
            <div
              style="
                border: 2px solid var(--border);
                background: transparent;
                color: var(--foreground);
                padding: 0.5rem 1rem;
                border-radius: 0;
                white-space: nowrap;
              "
              class="btn"
            >
              Ask AI
            </div>
          </a>
        </div>
      </div>
    </div>
  </body>
</html>`;
};
const error = createAuthEndpoint("/error", {
	method: "GET",
	metadata: {
		...HIDE_METADATA,
		openapi: {
			description: "Displays an error page",
			responses: { "200": {
				description: "Success",
				content: { "text/html": { schema: {
					type: "string",
					description: "The HTML content of the error page"
				} } }
			} }
		}
	}
}, async (c) => {
	const url = new URL(c.request?.url || "");
	const unsanitizedCode = url.searchParams.get("error") || "UNKNOWN";
	const unsanitizedDescription = url.searchParams.get("error_description") || null;
	const safeCode = /^[\'A-Za-z0-9_-]+$/.test(unsanitizedCode || "") ? unsanitizedCode : "UNKNOWN";
	const safeDescription = unsanitizedDescription ? sanitize(unsanitizedDescription) : null;
	const queryParams = new URLSearchParams();
	queryParams.set("error", safeCode);
	if (unsanitizedDescription) queryParams.set("error_description", unsanitizedDescription);
	const options = c.context.options;
	const errorURL = options.onAPIError?.errorURL;
	if (errorURL) return new Response(null, {
		status: 302,
		headers: { Location: `${errorURL}${errorURL.includes("?") ? "&" : "?"}${queryParams.toString()}` }
	});
	if (isProduction && !options.onAPIError?.customizeDefaultErrorPage) return new Response(null, {
		status: 302,
		headers: { Location: `/?${queryParams.toString()}` }
	});
	return new Response(html(c.context.options, safeCode, safeDescription), { headers: { "Content-Type": "text/html" } });
});

//#endregion
//#region src/api/routes/ok.ts
const ok = createAuthEndpoint("/ok", {
	method: "GET",
	metadata: {
		...HIDE_METADATA,
		openapi: {
			description: "Check if the API is working",
			responses: { "200": {
				description: "API is working",
				content: { "application/json": { schema: {
					type: "object",
					properties: { ok: {
						type: "boolean",
						description: "Indicates if the API is working"
					} },
					required: ["ok"]
				} } }
			} }
		}
	}
}, async (ctx) => {
	return ctx.json({ ok: true });
});

//#endregion
//#region src/api/routes/reset-password.ts
function redirectError(ctx, callbackURL, query) {
	const url = callbackURL ? new URL(callbackURL, ctx.baseURL) : new URL(`${ctx.baseURL}/error`);
	if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
	return url.href;
}
function redirectCallback(ctx, callbackURL, query) {
	const url = new URL(callbackURL, ctx.baseURL);
	if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
	return url.href;
}
const requestPasswordReset = createAuthEndpoint("/request-password-reset", {
	method: "POST",
	operationId: "forgetPassword",
	body: z.object({
		email: z.email().meta({ description: "The email address of the user to send a password reset email to" }),
		redirectTo: z.string().meta({ description: "The URL to redirect the user to reset their password. If the token isn't valid or expired, it'll be redirected with a query parameter `?error=INVALID_TOKEN`. If the token is valid, it'll be redirected with a query parameter `?token=VALID_TOKEN" }).optional()
	}),
	metadata: { openapi: {
		operationId: "forgetPassword",
		description: "Send a password reset email to the user",
		responses: { "200": {
			description: "Success",
			content: { "application/json": { schema: {
				type: "object",
				properties: {
					status: { type: "boolean" },
					message: { type: "string" }
				}
			} } }
		} }
	} }
}, async (ctx) => {
	if (!ctx.context.options.emailAndPassword?.sendResetPassword) {
		ctx.context.logger.error("Reset password isn't enabled.Please pass an emailAndPassword.sendResetPassword function in your auth config!");
		throw new APIError("BAD_REQUEST", { message: "Reset password isn't enabled" });
	}
	const { email, redirectTo } = ctx.body;
	const user = await ctx.context.internalAdapter.findUserByEmail(email, { includeAccounts: true });
	if (!user) {
		/**
		* We simulate the verification token generation and the database lookup
		* to mitigate timing attacks.
		*/
		generateId(24);
		await ctx.context.internalAdapter.findVerificationValue("dummy-verification-token");
		ctx.context.logger.error("Reset Password: User not found", { email });
		return ctx.json({
			status: true,
			message: "If this email exists in our system, check your email for the reset link"
		});
	}
	const expiresAt = getDate(ctx.context.options.emailAndPassword.resetPasswordTokenExpiresIn || 3600 * 1, "sec");
	const verificationToken = generateId(24);
	await ctx.context.internalAdapter.createVerificationValue({
		value: user.user.id,
		identifier: `reset-password:${verificationToken}`,
		expiresAt
	});
	const callbackURL = redirectTo ? encodeURIComponent(redirectTo) : "";
	const url = `${ctx.context.baseURL}/reset-password/${verificationToken}?callbackURL=${callbackURL}`;
	/**
	* We send the email in the background to prevent timing attacks.
	* This is to ensure that the response time is consistent regardless of whether the email was sent or not.
	*/
	ctx.context.options.emailAndPassword.sendResetPassword({
		user: user.user,
		url,
		token: verificationToken
	}, ctx.request).catch((e) => {
		ctx.context.logger.error("Failed to send reset password email", e);
	});
	return ctx.json({
		status: true,
		message: "If this email exists in our system, check your email for the reset link"
	});
});
const requestPasswordResetCallback = createAuthEndpoint("/reset-password/:token", {
	method: "GET",
	operationId: "forgetPasswordCallback",
	query: z.object({ callbackURL: z.string().meta({ description: "The URL to redirect the user to reset their password" }) }),
	use: [originCheck((ctx) => ctx.query.callbackURL)],
	metadata: { openapi: {
		operationId: "resetPasswordCallback",
		description: "Redirects the user to the callback URL with the token",
		parameters: [{
			name: "token",
			in: "path",
			required: true,
			description: "The token to reset the password",
			schema: { type: "string" }
		}, {
			name: "callbackURL",
			in: "query",
			required: true,
			description: "The URL to redirect the user to reset their password",
			schema: { type: "string" }
		}],
		responses: { "200": {
			description: "Success",
			content: { "application/json": { schema: {
				type: "object",
				properties: { token: { type: "string" } }
			} } }
		} }
	} }
}, async (ctx) => {
	const { token } = ctx.params;
	const { callbackURL } = ctx.query;
	if (!token || !callbackURL) throw ctx.redirect(redirectError(ctx.context, callbackURL, { error: "INVALID_TOKEN" }));
	const verification = await ctx.context.internalAdapter.findVerificationValue(`reset-password:${token}`);
	if (!verification || verification.expiresAt < /* @__PURE__ */ new Date()) throw ctx.redirect(redirectError(ctx.context, callbackURL, { error: "INVALID_TOKEN" }));
	throw ctx.redirect(redirectCallback(ctx.context, callbackURL, { token }));
});
const resetPassword = createAuthEndpoint("/reset-password", {
	method: "POST",
	operationId: "resetPassword",
	query: z.object({ token: z.string().optional() }).optional(),
	body: z.object({
		newPassword: z.string().meta({ description: "The new password to set" }),
		token: z.string().meta({ description: "The token to reset the password" }).optional()
	}),
	metadata: { openapi: {
		operationId: "resetPassword",
		description: "Reset the password for a user",
		responses: { "200": {
			description: "Success",
			content: { "application/json": { schema: {
				type: "object",
				properties: { status: { type: "boolean" } }
			} } }
		} }
	} }
}, async (ctx) => {
	const token = ctx.body.token || ctx.query?.token;
	if (!token) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.INVALID_TOKEN });
	const { newPassword } = ctx.body;
	const minLength = ctx.context.password?.config.minPasswordLength;
	const maxLength = ctx.context.password?.config.maxPasswordLength;
	if (newPassword.length < minLength) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.PASSWORD_TOO_SHORT });
	if (newPassword.length > maxLength) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.PASSWORD_TOO_LONG });
	const id = `reset-password:${token}`;
	const verification = await ctx.context.internalAdapter.findVerificationValue(id);
	if (!verification || verification.expiresAt < /* @__PURE__ */ new Date()) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.INVALID_TOKEN });
	const userId = verification.value;
	const hashedPassword = await ctx.context.password.hash(newPassword);
	if (!(await ctx.context.internalAdapter.findAccounts(userId)).find((ac) => ac.providerId === "credential")) await ctx.context.internalAdapter.createAccount({
		userId,
		providerId: "credential",
		password: hashedPassword,
		accountId: userId
	});
	else await ctx.context.internalAdapter.updatePassword(userId, hashedPassword);
	await ctx.context.internalAdapter.deleteVerificationValue(verification.id);
	if (ctx.context.options.emailAndPassword?.onPasswordReset) {
		const user = await ctx.context.internalAdapter.findUserById(userId);
		if (user) await ctx.context.options.emailAndPassword.onPasswordReset({ user }, ctx.request);
	}
	if (ctx.context.options.emailAndPassword?.revokeSessionsOnPasswordReset) await ctx.context.internalAdapter.deleteSessions(userId);
	return ctx.json({ status: true });
});

//#endregion
//#region src/api/routes/sign-in.ts
const socialSignInBodySchema = z.object({
	callbackURL: z.string().meta({ description: "Callback URL to redirect to after the user has signed in" }).optional(),
	newUserCallbackURL: z.string().optional(),
	errorCallbackURL: z.string().meta({ description: "Callback URL to redirect to if an error happens" }).optional(),
	provider: SocialProviderListEnum,
	disableRedirect: z.boolean().meta({ description: "Disable automatic redirection to the provider. Useful for handling the redirection yourself" }).optional(),
	idToken: z.optional(z.object({
		token: z.string().meta({ description: "ID token from the provider" }),
		nonce: z.string().meta({ description: "Nonce used to generate the token" }).optional(),
		accessToken: z.string().meta({ description: "Access token from the provider" }).optional(),
		refreshToken: z.string().meta({ description: "Refresh token from the provider" }).optional(),
		expiresAt: z.number().meta({ description: "Expiry date of the token" }).optional()
	})),
	scopes: z.array(z.string()).meta({ description: "Array of scopes to request from the provider. This will override the default scopes passed." }).optional(),
	requestSignUp: z.boolean().meta({ description: "Explicitly request sign-up. Useful when disableImplicitSignUp is true for this provider" }).optional(),
	loginHint: z.string().meta({ description: "The login hint to use for the authorization code request" }).optional(),
	additionalData: z.record(z.string(), z.any()).optional().meta({ description: "Additional data to be passed through the OAuth flow" })
});
const signInSocial = () => createAuthEndpoint("/sign-in/social", {
	method: "POST",
	operationId: "socialSignIn",
	body: socialSignInBodySchema,
	metadata: {
		$Infer: {
			body: {},
			returned: {}
		},
		openapi: {
			description: "Sign in with a social provider",
			operationId: "socialSignIn",
			responses: { "200": {
				description: "Success - Returns either session details or redirect URL",
				content: { "application/json": { schema: {
					type: "object",
					description: "Session response when idToken is provided",
					properties: {
						token: { type: "string" },
						user: {
							type: "object",
							$ref: "#/components/schemas/User"
						},
						url: { type: "string" },
						redirect: {
							type: "boolean",
							enum: [false]
						}
					},
					required: [
						"redirect",
						"token",
						"user"
					]
				} } }
			} }
		}
	}
}, async (c) => {
	const provider = c.context.socialProviders.find((p) => p.id === c.body.provider);
	if (!provider) {
		c.context.logger.error("Provider not found. Make sure to add the provider in your auth config", { provider: c.body.provider });
		throw new APIError("NOT_FOUND", { message: BASE_ERROR_CODES.PROVIDER_NOT_FOUND });
	}
	if (c.body.idToken) {
		if (!provider.verifyIdToken) {
			c.context.logger.error("Provider does not support id token verification", { provider: c.body.provider });
			throw new APIError("NOT_FOUND", { message: BASE_ERROR_CODES.ID_TOKEN_NOT_SUPPORTED });
		}
		const { token, nonce } = c.body.idToken;
		if (!await provider.verifyIdToken(token, nonce)) {
			c.context.logger.error("Invalid id token", { provider: c.body.provider });
			throw new APIError("UNAUTHORIZED", { message: BASE_ERROR_CODES.INVALID_TOKEN });
		}
		const userInfo = await provider.getUserInfo({
			idToken: token,
			accessToken: c.body.idToken.accessToken,
			refreshToken: c.body.idToken.refreshToken
		});
		if (!userInfo || !userInfo?.user) {
			c.context.logger.error("Failed to get user info", { provider: c.body.provider });
			throw new APIError("UNAUTHORIZED", { message: BASE_ERROR_CODES.FAILED_TO_GET_USER_INFO });
		}
		if (!userInfo.user.email) {
			c.context.logger.error("User email not found", { provider: c.body.provider });
			throw new APIError("UNAUTHORIZED", { message: BASE_ERROR_CODES.USER_EMAIL_NOT_FOUND });
		}
		const data = await handleOAuthUserInfo(c, {
			userInfo: {
				...userInfo.user,
				email: userInfo.user.email,
				id: String(userInfo.user.id),
				name: userInfo.user.name || "",
				image: userInfo.user.image,
				emailVerified: userInfo.user.emailVerified || false
			},
			account: {
				providerId: provider.id,
				accountId: String(userInfo.user.id),
				accessToken: c.body.idToken.accessToken
			},
			callbackURL: c.body.callbackURL,
			disableSignUp: provider.disableImplicitSignUp && !c.body.requestSignUp || provider.disableSignUp
		});
		if (data.error) throw new APIError("UNAUTHORIZED", { message: data.error });
		await setSessionCookie(c, data.data);
		return c.json({
			redirect: false,
			token: data.data.session.token,
			url: void 0,
			user: parseUserOutput(c.context.options, data.data.user)
		});
	}
	const { codeVerifier, state } = await generateState(c, void 0, c.body.additionalData);
	const url = await provider.createAuthorizationURL({
		state,
		codeVerifier,
		redirectURI: `${c.context.baseURL}/callback/${provider.id}`,
		scopes: c.body.scopes,
		loginHint: c.body.loginHint
	});
	return c.json({
		url: url.toString(),
		redirect: !c.body.disableRedirect
	});
});
const signInEmail = () => createAuthEndpoint("/sign-in/email", {
	method: "POST",
	operationId: "signInEmail",
	body: z.object({
		email: z.string().meta({ description: "Email of the user" }),
		password: z.string().meta({ description: "Password of the user" }),
		callbackURL: z.string().meta({ description: "Callback URL to use as a redirect for email verification" }).optional(),
		rememberMe: z.boolean().meta({ description: "If this is false, the session will not be remembered. Default is `true`." }).default(true).optional()
	}),
	metadata: {
		$Infer: {
			body: {},
			returned: {}
		},
		openapi: {
			operationId: "signInEmail",
			description: "Sign in with email and password",
			responses: { "200": {
				description: "Success - Returns either session details or redirect URL",
				content: { "application/json": { schema: {
					type: "object",
					description: "Session response when idToken is provided",
					properties: {
						redirect: {
							type: "boolean",
							enum: [false]
						},
						token: {
							type: "string",
							description: "Session token"
						},
						url: {
							type: "string",
							nullable: true
						},
						user: {
							type: "object",
							$ref: "#/components/schemas/User"
						}
					},
					required: [
						"redirect",
						"token",
						"user"
					]
				} } }
			} }
		}
	}
}, async (ctx) => {
	if (!ctx.context.options?.emailAndPassword?.enabled) {
		ctx.context.logger.error("Email and password is not enabled. Make sure to enable it in the options on you `auth.ts` file. Check `https://better-auth.com/docs/authentication/email-password` for more!");
		throw new APIError("BAD_REQUEST", { message: "Email and password is not enabled" });
	}
	const { email, password } = ctx.body;
	if (!z.email().safeParse(email).success) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.INVALID_EMAIL });
	const user = await ctx.context.internalAdapter.findUserByEmail(email, { includeAccounts: true });
	if (!user) {
		await ctx.context.password.hash(password);
		ctx.context.logger.error("User not found", { email });
		throw new APIError("UNAUTHORIZED", { message: BASE_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD });
	}
	const credentialAccount = user.accounts.find((a) => a.providerId === "credential");
	if (!credentialAccount) {
		await ctx.context.password.hash(password);
		ctx.context.logger.error("Credential account not found", { email });
		throw new APIError("UNAUTHORIZED", { message: BASE_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD });
	}
	const currentPassword = credentialAccount?.password;
	if (!currentPassword) {
		await ctx.context.password.hash(password);
		ctx.context.logger.error("Password not found", { email });
		throw new APIError("UNAUTHORIZED", { message: BASE_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD });
	}
	if (!await ctx.context.password.verify({
		hash: currentPassword,
		password
	})) {
		ctx.context.logger.error("Invalid password");
		throw new APIError("UNAUTHORIZED", { message: BASE_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD });
	}
	if (ctx.context.options?.emailAndPassword?.requireEmailVerification && !user.user.emailVerified) {
		if (!ctx.context.options?.emailVerification?.sendVerificationEmail) throw new APIError("FORBIDDEN", { message: BASE_ERROR_CODES.EMAIL_NOT_VERIFIED });
		if (ctx.context.options?.emailVerification?.sendOnSignIn) {
			const token = await createEmailVerificationToken(ctx.context.secret, user.user.email, void 0, ctx.context.options.emailVerification?.expiresIn);
			const callbackURL = ctx.body.callbackURL ? encodeURIComponent(ctx.body.callbackURL) : encodeURIComponent("/");
			const url = `${ctx.context.baseURL}/verify-email?token=${token}&callbackURL=${callbackURL}`;
			await ctx.context.options.emailVerification.sendVerificationEmail({
				user: user.user,
				url,
				token
			}, ctx.request);
		}
		throw new APIError("FORBIDDEN", { message: BASE_ERROR_CODES.EMAIL_NOT_VERIFIED });
	}
	const session = await ctx.context.internalAdapter.createSession(user.user.id, ctx.body.rememberMe === false);
	if (!session) {
		ctx.context.logger.error("Failed to create session");
		throw new APIError("UNAUTHORIZED", { message: BASE_ERROR_CODES.FAILED_TO_CREATE_SESSION });
	}
	await setSessionCookie(ctx, {
		session,
		user: user.user
	}, ctx.body.rememberMe === false);
	return ctx.json({
		redirect: !!ctx.body.callbackURL,
		token: session.token,
		url: ctx.body.callbackURL,
		user: parseUserOutput(ctx.context.options, user.user)
	});
});

//#endregion
//#region src/api/routes/sign-out.ts
const signOut = createAuthEndpoint("/sign-out", {
	method: "POST",
	operationId: "signOut",
	requireHeaders: true,
	metadata: { openapi: {
		operationId: "signOut",
		description: "Sign out the current user",
		responses: { "200": {
			description: "Success",
			content: { "application/json": { schema: {
				type: "object",
				properties: { success: { type: "boolean" } }
			} } }
		} }
	} }
}, async (ctx) => {
	const sessionCookieToken = await ctx.getSignedCookie(ctx.context.authCookies.sessionToken.name, ctx.context.secret);
	if (sessionCookieToken) try {
		await ctx.context.internalAdapter.deleteSession(sessionCookieToken);
	} catch (e) {
		ctx.context.logger.error("Failed to delete session from database", e);
	}
	deleteSessionCookie(ctx);
	return ctx.json({ success: true });
});

//#endregion
//#region src/api/routes/sign-up.ts
const signUpEmail = () => createAuthEndpoint("/sign-up/email", {
	method: "POST",
	operationId: "signUpWithEmailAndPassword",
	body: z.record(z.string(), z.any()),
	metadata: {
		$Infer: {
			body: {},
			returned: {}
		},
		openapi: {
			operationId: "signUpWithEmailAndPassword",
			description: "Sign up a user using email and password",
			requestBody: { content: { "application/json": { schema: {
				type: "object",
				properties: {
					name: {
						type: "string",
						description: "The name of the user"
					},
					email: {
						type: "string",
						description: "The email of the user"
					},
					password: {
						type: "string",
						description: "The password of the user"
					},
					image: {
						type: "string",
						description: "The profile image URL of the user"
					},
					callbackURL: {
						type: "string",
						description: "The URL to use for email verification callback"
					},
					rememberMe: {
						type: "boolean",
						description: "If this is false, the session will not be remembered. Default is `true`."
					}
				},
				required: [
					"name",
					"email",
					"password"
				]
			} } } },
			responses: {
				"200": {
					description: "Successfully created user",
					content: { "application/json": { schema: {
						type: "object",
						properties: {
							token: {
								type: "string",
								nullable: true,
								description: "Authentication token for the session"
							},
							user: {
								type: "object",
								properties: {
									id: {
										type: "string",
										description: "The unique identifier of the user"
									},
									email: {
										type: "string",
										format: "email",
										description: "The email address of the user"
									},
									name: {
										type: "string",
										description: "The name of the user"
									},
									image: {
										type: "string",
										format: "uri",
										nullable: true,
										description: "The profile image URL of the user"
									},
									emailVerified: {
										type: "boolean",
										description: "Whether the email has been verified"
									},
									createdAt: {
										type: "string",
										format: "date-time",
										description: "When the user was created"
									},
									updatedAt: {
										type: "string",
										format: "date-time",
										description: "When the user was last updated"
									}
								},
								required: [
									"id",
									"email",
									"name",
									"emailVerified",
									"createdAt",
									"updatedAt"
								]
							}
						},
						required: ["user"]
					} } }
				},
				"422": {
					description: "Unprocessable Entity. User already exists or failed to create user.",
					content: { "application/json": { schema: {
						type: "object",
						properties: { message: { type: "string" } }
					} } }
				}
			}
		}
	}
}, async (ctx) => {
	return runWithTransaction(ctx.context.adapter, async () => {
		if (!ctx.context.options.emailAndPassword?.enabled || ctx.context.options.emailAndPassword?.disableSignUp) throw new APIError("BAD_REQUEST", { message: "Email and password sign up is not enabled" });
		const body = ctx.body;
		const { name, email, password, image, callbackURL, rememberMe, ...rest } = body;
		if (!z.email().safeParse(email).success) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.INVALID_EMAIL });
		const minPasswordLength = ctx.context.password.config.minPasswordLength;
		if (password.length < minPasswordLength) {
			ctx.context.logger.error("Password is too short");
			throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.PASSWORD_TOO_SHORT });
		}
		const maxPasswordLength = ctx.context.password.config.maxPasswordLength;
		if (password.length > maxPasswordLength) {
			ctx.context.logger.error("Password is too long");
			throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.PASSWORD_TOO_LONG });
		}
		if ((await ctx.context.internalAdapter.findUserByEmail(email))?.user) {
			ctx.context.logger.info(`Sign-up attempt for existing email: ${email}`);
			throw new APIError("UNPROCESSABLE_ENTITY", { message: BASE_ERROR_CODES.USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL });
		}
		/**
		* Hash the password
		*
		* This is done prior to creating the user
		* to ensure that any plugin that
		* may break the hashing should break
		* before the user is created.
		*/
		const hash = await ctx.context.password.hash(password);
		let createdUser;
		try {
			const data = parseUserInput(ctx.context.options, rest, "create");
			createdUser = await ctx.context.internalAdapter.createUser({
				email: email.toLowerCase(),
				name,
				image,
				...data,
				emailVerified: false
			});
			if (!createdUser) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.FAILED_TO_CREATE_USER });
		} catch (e) {
			if (isDevelopment()) ctx.context.logger.error("Failed to create user", e);
			if (e instanceof APIError) throw e;
			ctx.context.logger?.error("Failed to create user", e);
			throw new APIError("UNPROCESSABLE_ENTITY", {
				message: BASE_ERROR_CODES.FAILED_TO_CREATE_USER,
				details: e
			});
		}
		if (!createdUser) throw new APIError("UNPROCESSABLE_ENTITY", { message: BASE_ERROR_CODES.FAILED_TO_CREATE_USER });
		await ctx.context.internalAdapter.linkAccount({
			userId: createdUser.id,
			providerId: "credential",
			accountId: createdUser.id,
			password: hash
		});
		if (ctx.context.options.emailVerification?.sendOnSignUp || ctx.context.options.emailAndPassword.requireEmailVerification) {
			const token = await createEmailVerificationToken(ctx.context.secret, createdUser.email, void 0, ctx.context.options.emailVerification?.expiresIn);
			const callbackURL$1 = body.callbackURL ? encodeURIComponent(body.callbackURL) : encodeURIComponent("/");
			const url = `${ctx.context.baseURL}/verify-email?token=${token}&callbackURL=${callbackURL$1}`;
			const args = ctx.request ? [{
				user: createdUser,
				url,
				token
			}, ctx.request] : [{
				user: createdUser,
				url,
				token
			}];
			await ctx.context.options.emailVerification?.sendVerificationEmail?.(...args);
		}
		if (ctx.context.options.emailAndPassword.autoSignIn === false || ctx.context.options.emailAndPassword.requireEmailVerification) return ctx.json({
			token: null,
			user: parseUserOutput(ctx.context.options, createdUser)
		});
		const session = await ctx.context.internalAdapter.createSession(createdUser.id, rememberMe === false);
		if (!session) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.FAILED_TO_CREATE_SESSION });
		await setSessionCookie(ctx, {
			session,
			user: createdUser
		}, rememberMe === false);
		return ctx.json({
			token: session.token,
			user: parseUserOutput(ctx.context.options, createdUser)
		});
	});
});

//#endregion
//#region src/api/routes/update-user.ts
const updateUser = () => createAuthEndpoint("/update-user", {
	method: "POST",
	operationId: "updateUser",
	body: z.record(z.string().meta({ description: "Field name must be a string" }), z.any()),
	use: [sessionMiddleware],
	metadata: {
		$Infer: { body: {} },
		openapi: {
			operationId: "updateUser",
			description: "Update the current user",
			requestBody: { content: { "application/json": { schema: {
				type: "object",
				properties: {
					name: {
						type: "string",
						description: "The name of the user"
					},
					image: {
						type: "string",
						description: "The image of the user"
					}
				}
			} } } },
			responses: { "200": {
				description: "Success",
				content: { "application/json": { schema: {
					type: "object",
					properties: { user: {
						type: "object",
						$ref: "#/components/schemas/User"
					} }
				} } }
			} }
		}
	}
}, async (ctx) => {
	const body = ctx.body;
	if (body.email) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.EMAIL_CAN_NOT_BE_UPDATED });
	const { name, image, ...rest } = body;
	const session = ctx.context.session;
	const additionalFields = parseUserInput(ctx.context.options, rest, "update");
	if (image === void 0 && name === void 0 && Object.keys(additionalFields).length === 0) throw new APIError("BAD_REQUEST", { message: "No fields to update" });
	const user = await ctx.context.internalAdapter.updateUser(session.user.id, {
		name,
		image,
		...additionalFields
	});
	/**
	* Update the session cookie with the new user data
	*/
	await setSessionCookie(ctx, {
		session: session.session,
		user
	});
	return ctx.json({ status: true });
});
const changePassword = createAuthEndpoint("/change-password", {
	method: "POST",
	operationId: "changePassword",
	body: z.object({
		newPassword: z.string().meta({ description: "The new password to set" }),
		currentPassword: z.string().meta({ description: "The current password is required" }),
		revokeOtherSessions: z.boolean().meta({ description: "Must be a boolean value" }).optional()
	}),
	use: [sensitiveSessionMiddleware],
	metadata: { openapi: {
		operationId: "changePassword",
		description: "Change the password of the user",
		responses: { "200": {
			description: "Password successfully changed",
			content: { "application/json": { schema: {
				type: "object",
				properties: {
					token: {
						type: "string",
						nullable: true,
						description: "New session token if other sessions were revoked"
					},
					user: {
						type: "object",
						properties: {
							id: {
								type: "string",
								description: "The unique identifier of the user"
							},
							email: {
								type: "string",
								format: "email",
								description: "The email address of the user"
							},
							name: {
								type: "string",
								description: "The name of the user"
							},
							image: {
								type: "string",
								format: "uri",
								nullable: true,
								description: "The profile image URL of the user"
							},
							emailVerified: {
								type: "boolean",
								description: "Whether the email has been verified"
							},
							createdAt: {
								type: "string",
								format: "date-time",
								description: "When the user was created"
							},
							updatedAt: {
								type: "string",
								format: "date-time",
								description: "When the user was last updated"
							}
						},
						required: [
							"id",
							"email",
							"name",
							"emailVerified",
							"createdAt",
							"updatedAt"
						]
					}
				},
				required: ["user"]
			} } }
		} }
	} }
}, async (ctx) => {
	const { newPassword, currentPassword, revokeOtherSessions: revokeOtherSessions$1 } = ctx.body;
	const session = ctx.context.session;
	const minPasswordLength = ctx.context.password.config.minPasswordLength;
	if (newPassword.length < minPasswordLength) {
		ctx.context.logger.error("Password is too short");
		throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.PASSWORD_TOO_SHORT });
	}
	const maxPasswordLength = ctx.context.password.config.maxPasswordLength;
	if (newPassword.length > maxPasswordLength) {
		ctx.context.logger.error("Password is too long");
		throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.PASSWORD_TOO_LONG });
	}
	const account = (await ctx.context.internalAdapter.findAccounts(session.user.id)).find((account$1) => account$1.providerId === "credential" && account$1.password);
	if (!account || !account.password) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.CREDENTIAL_ACCOUNT_NOT_FOUND });
	const passwordHash = await ctx.context.password.hash(newPassword);
	if (!await ctx.context.password.verify({
		hash: account.password,
		password: currentPassword
	})) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.INVALID_PASSWORD });
	await ctx.context.internalAdapter.updateAccount(account.id, { password: passwordHash });
	let token = null;
	if (revokeOtherSessions$1) {
		await ctx.context.internalAdapter.deleteSessions(session.user.id);
		const newSession = await ctx.context.internalAdapter.createSession(session.user.id);
		if (!newSession) throw new APIError("INTERNAL_SERVER_ERROR", { message: BASE_ERROR_CODES.FAILED_TO_GET_SESSION });
		await setSessionCookie(ctx, {
			session: newSession,
			user: session.user
		});
		token = newSession.token;
	}
	return ctx.json({
		token,
		user: {
			id: session.user.id,
			email: session.user.email,
			name: session.user.name,
			image: session.user.image,
			emailVerified: session.user.emailVerified,
			createdAt: session.user.createdAt,
			updatedAt: session.user.updatedAt
		}
	});
});
const setPassword = createAuthEndpoint("/set-password", {
	method: "POST",
	body: z.object({ newPassword: z.string().meta({ description: "The new password to set is required" }) }),
	metadata: { SERVER_ONLY: true },
	use: [sensitiveSessionMiddleware]
}, async (ctx) => {
	const { newPassword } = ctx.body;
	const session = ctx.context.session;
	const minPasswordLength = ctx.context.password.config.minPasswordLength;
	if (newPassword.length < minPasswordLength) {
		ctx.context.logger.error("Password is too short");
		throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.PASSWORD_TOO_SHORT });
	}
	const maxPasswordLength = ctx.context.password.config.maxPasswordLength;
	if (newPassword.length > maxPasswordLength) {
		ctx.context.logger.error("Password is too long");
		throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.PASSWORD_TOO_LONG });
	}
	const account = (await ctx.context.internalAdapter.findAccounts(session.user.id)).find((account$1) => account$1.providerId === "credential" && account$1.password);
	const passwordHash = await ctx.context.password.hash(newPassword);
	if (!account) {
		await ctx.context.internalAdapter.linkAccount({
			userId: session.user.id,
			providerId: "credential",
			accountId: session.user.id,
			password: passwordHash
		});
		return ctx.json({ status: true });
	}
	throw new APIError("BAD_REQUEST", { message: "user already has a password" });
});
const deleteUser = createAuthEndpoint("/delete-user", {
	method: "POST",
	use: [sensitiveSessionMiddleware],
	body: z.object({
		callbackURL: z.string().meta({ description: "The callback URL to redirect to after the user is deleted" }).optional(),
		password: z.string().meta({ description: "The password of the user is required to delete the user" }).optional(),
		token: z.string().meta({ description: "The token to delete the user is required" }).optional()
	}),
	metadata: { openapi: {
		operationId: "deleteUser",
		description: "Delete the user",
		requestBody: { content: { "application/json": { schema: {
			type: "object",
			properties: {
				callbackURL: {
					type: "string",
					description: "The callback URL to redirect to after the user is deleted"
				},
				password: {
					type: "string",
					description: "The user's password. Required if session is not fresh"
				},
				token: {
					type: "string",
					description: "The deletion verification token"
				}
			}
		} } } },
		responses: { "200": {
			description: "User deletion processed successfully",
			content: { "application/json": { schema: {
				type: "object",
				properties: {
					success: {
						type: "boolean",
						description: "Indicates if the operation was successful"
					},
					message: {
						type: "string",
						enum: ["User deleted", "Verification email sent"],
						description: "Status message of the deletion process"
					}
				},
				required: ["success", "message"]
			} } }
		} }
	} }
}, async (ctx) => {
	if (!ctx.context.options.user?.deleteUser?.enabled) {
		ctx.context.logger.error("Delete user is disabled. Enable it in the options");
		throw new APIError("NOT_FOUND");
	}
	const session = ctx.context.session;
	if (ctx.body.password) {
		const account = (await ctx.context.internalAdapter.findAccounts(session.user.id)).find((account$1) => account$1.providerId === "credential" && account$1.password);
		if (!account || !account.password) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.CREDENTIAL_ACCOUNT_NOT_FOUND });
		if (!await ctx.context.password.verify({
			hash: account.password,
			password: ctx.body.password
		})) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.INVALID_PASSWORD });
	}
	if (ctx.body.token) {
		await deleteUserCallback({
			...ctx,
			query: { token: ctx.body.token }
		});
		return ctx.json({
			success: true,
			message: "User deleted"
		});
	}
	if (ctx.context.options.user.deleteUser?.sendDeleteAccountVerification) {
		const token = generateRandomString(32, "0-9", "a-z");
		await ctx.context.internalAdapter.createVerificationValue({
			value: session.user.id,
			identifier: `delete-account-${token}`,
			expiresAt: new Date(Date.now() + (ctx.context.options.user.deleteUser?.deleteTokenExpiresIn || 3600 * 24) * 1e3)
		});
		const url = `${ctx.context.baseURL}/delete-user/callback?token=${token}&callbackURL=${ctx.body.callbackURL || "/"}`;
		await ctx.context.options.user.deleteUser.sendDeleteAccountVerification({
			user: session.user,
			url,
			token
		}, ctx.request);
		return ctx.json({
			success: true,
			message: "Verification email sent"
		});
	}
	if (!ctx.body.password && ctx.context.sessionConfig.freshAge !== 0) {
		const currentAge = new Date(session.session.createdAt).getTime();
		const freshAge = ctx.context.sessionConfig.freshAge * 1e3;
		if (Date.now() - currentAge > freshAge * 1e3) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.SESSION_EXPIRED });
	}
	const beforeDelete = ctx.context.options.user.deleteUser?.beforeDelete;
	if (beforeDelete) await beforeDelete(session.user, ctx.request);
	await ctx.context.internalAdapter.deleteUser(session.user.id);
	await ctx.context.internalAdapter.deleteSessions(session.user.id);
	deleteSessionCookie(ctx);
	const afterDelete = ctx.context.options.user.deleteUser?.afterDelete;
	if (afterDelete) await afterDelete(session.user, ctx.request);
	return ctx.json({
		success: true,
		message: "User deleted"
	});
});
const deleteUserCallback = createAuthEndpoint("/delete-user/callback", {
	method: "GET",
	query: z.object({
		token: z.string().meta({ description: "The token to verify the deletion request" }),
		callbackURL: z.string().meta({ description: "The URL to redirect to after deletion" }).optional()
	}),
	use: [originCheck((ctx) => ctx.query.callbackURL)],
	metadata: { openapi: {
		description: "Callback to complete user deletion with verification token",
		responses: { "200": {
			description: "User successfully deleted",
			content: { "application/json": { schema: {
				type: "object",
				properties: {
					success: {
						type: "boolean",
						description: "Indicates if the deletion was successful"
					},
					message: {
						type: "string",
						enum: ["User deleted"],
						description: "Confirmation message"
					}
				},
				required: ["success", "message"]
			} } }
		} }
	} }
}, async (ctx) => {
	if (!ctx.context.options.user?.deleteUser?.enabled) {
		ctx.context.logger.error("Delete user is disabled. Enable it in the options");
		throw new APIError("NOT_FOUND");
	}
	const session = await getSessionFromCtx(ctx);
	if (!session) throw new APIError("NOT_FOUND", { message: BASE_ERROR_CODES.FAILED_TO_GET_USER_INFO });
	const token = await ctx.context.internalAdapter.findVerificationValue(`delete-account-${ctx.query.token}`);
	if (!token || token.expiresAt < /* @__PURE__ */ new Date()) throw new APIError("NOT_FOUND", { message: BASE_ERROR_CODES.INVALID_TOKEN });
	if (token.value !== session.user.id) throw new APIError("NOT_FOUND", { message: BASE_ERROR_CODES.INVALID_TOKEN });
	const beforeDelete = ctx.context.options.user.deleteUser?.beforeDelete;
	if (beforeDelete) await beforeDelete(session.user, ctx.request);
	await ctx.context.internalAdapter.deleteUser(session.user.id);
	await ctx.context.internalAdapter.deleteSessions(session.user.id);
	await ctx.context.internalAdapter.deleteAccounts(session.user.id);
	await ctx.context.internalAdapter.deleteVerificationValue(token.id);
	deleteSessionCookie(ctx);
	const afterDelete = ctx.context.options.user.deleteUser?.afterDelete;
	if (afterDelete) await afterDelete(session.user, ctx.request);
	if (ctx.query.callbackURL) throw ctx.redirect(ctx.query.callbackURL || "/");
	return ctx.json({
		success: true,
		message: "User deleted"
	});
});
const changeEmail = createAuthEndpoint("/change-email", {
	method: "POST",
	body: z.object({
		newEmail: z.email().meta({ description: "The new email address to set must be a valid email address" }),
		callbackURL: z.string().meta({ description: "The URL to redirect to after email verification" }).optional()
	}),
	use: [sensitiveSessionMiddleware],
	metadata: { openapi: {
		operationId: "changeEmail",
		responses: {
			"200": {
				description: "Email change request processed successfully",
				content: { "application/json": { schema: {
					type: "object",
					properties: {
						user: {
							type: "object",
							$ref: "#/components/schemas/User"
						},
						status: {
							type: "boolean",
							description: "Indicates if the request was successful"
						},
						message: {
							type: "string",
							enum: ["Email updated", "Verification email sent"],
							description: "Status message of the email change process",
							nullable: true
						}
					},
					required: ["status"]
				} } }
			},
			"422": {
				description: "Unprocessable Entity. Email already exists",
				content: { "application/json": { schema: {
					type: "object",
					properties: { message: { type: "string" } }
				} } }
			}
		}
	} }
}, async (ctx) => {
	if (!ctx.context.options.user?.changeEmail?.enabled) {
		ctx.context.logger.error("Change email is disabled.");
		throw new APIError("BAD_REQUEST", { message: "Change email is disabled" });
	}
	const newEmail = ctx.body.newEmail.toLowerCase();
	if (newEmail === ctx.context.session.user.email) {
		ctx.context.logger.error("Email is the same");
		throw new APIError("BAD_REQUEST", { message: "Email is the same" });
	}
	if (await ctx.context.internalAdapter.findUserByEmail(newEmail)) {
		ctx.context.logger.error("Email already exists");
		throw new APIError("UNPROCESSABLE_ENTITY", { message: BASE_ERROR_CODES.USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL });
	}
	/**
	* If the email is not verified, we can update the email if the option is enabled
	*/
	if (ctx.context.session.user.emailVerified !== true && ctx.context.options.user.changeEmail.updateEmailWithoutVerification) {
		await ctx.context.internalAdapter.updateUserByEmail(ctx.context.session.user.email, { email: newEmail });
		await setSessionCookie(ctx, {
			session: ctx.context.session.session,
			user: {
				...ctx.context.session.user,
				email: newEmail
			}
		});
		if (ctx.context.options.emailVerification?.sendVerificationEmail) {
			const token$1 = await createEmailVerificationToken(ctx.context.secret, newEmail, void 0, ctx.context.options.emailVerification?.expiresIn);
			const url$1 = `${ctx.context.baseURL}/verify-email?token=${token$1}&callbackURL=${ctx.body.callbackURL || "/"}`;
			await ctx.context.options.emailVerification.sendVerificationEmail({
				user: {
					...ctx.context.session.user,
					email: newEmail
				},
				url: url$1,
				token: token$1
			}, ctx.request);
		}
		return ctx.json({ status: true });
	}
	if (ctx.context.session.user.emailVerified && (ctx.context.options.user.changeEmail.sendChangeEmailConfirmation || ctx.context.options.user.changeEmail.sendChangeEmailVerification)) {
		const token$1 = await createEmailVerificationToken(ctx.context.secret, ctx.context.session.user.email, newEmail, ctx.context.options.emailVerification?.expiresIn, { requestType: "change-email-confirmation" });
		const url$1 = `${ctx.context.baseURL}/verify-email?token=${token$1}&callbackURL=${ctx.body.callbackURL || "/"}`;
		const sendFn = ctx.context.options.user.changeEmail.sendChangeEmailConfirmation || ctx.context.options.user.changeEmail.sendChangeEmailVerification;
		if (sendFn) await sendFn({
			user: ctx.context.session.user,
			newEmail,
			url: url$1,
			token: token$1
		}, ctx.request);
		return ctx.json({ status: true });
	}
	if (!ctx.context.options.emailVerification?.sendVerificationEmail) {
		ctx.context.logger.error("Verification email isn't enabled.");
		throw new APIError("BAD_REQUEST", { message: "Verification email isn't enabled" });
	}
	const token = await createEmailVerificationToken(ctx.context.secret, ctx.context.session.user.email, newEmail, ctx.context.options.emailVerification?.expiresIn, { requestType: "change-email-verification" });
	const url = `${ctx.context.baseURL}/verify-email?token=${token}&callbackURL=${ctx.body.callbackURL || "/"}`;
	await ctx.context.options.emailVerification.sendVerificationEmail({
		user: {
			...ctx.context.session.user,
			email: newEmail
		},
		url,
		token
	}, ctx.request);
	return ctx.json({ status: true });
});

//#endregion
//#region src/api/to-auth-endpoints.ts
const defuReplaceArrays = createDefu((obj, key, value) => {
	if (Array.isArray(obj[key]) && Array.isArray(value)) {
		obj[key] = value;
		return true;
	}
});
function toAuthEndpoints(endpoints, ctx) {
	const api = {};
	for (const [key, endpoint] of Object.entries(endpoints)) {
		api[key] = async (context) => {
			const run = async () => {
				const authContext = await ctx;
				let internalContext = {
					...context,
					context: {
						...authContext,
						returned: void 0,
						responseHeaders: void 0,
						session: null
					},
					path: endpoint.path,
					headers: context?.headers ? new Headers(context?.headers) : void 0
				};
				return runWithEndpointContext(internalContext, async () => {
					const { beforeHooks, afterHooks } = getHooks(authContext);
					const before = await runBeforeHooks(internalContext, beforeHooks);
					/**
					* If `before.context` is returned, it should
					* get merged with the original context
					*/
					if ("context" in before && before.context && typeof before.context === "object") {
						const { headers, ...rest } = before.context;
						/**
						* Headers should be merged differently
						* so the hook doesn't override the whole
						* header
						*/
						if (headers) headers.forEach((value, key$1) => {
							internalContext.headers.set(key$1, value);
						});
						internalContext = defuReplaceArrays(rest, internalContext);
					} else if (before) return context?.asResponse ? toResponse(before, { headers: context?.headers }) : context?.returnHeaders ? {
						headers: context?.headers,
						response: before
					} : before;
					internalContext.asResponse = false;
					internalContext.returnHeaders = true;
					internalContext.returnStatus = true;
					const result = await runWithEndpointContext(internalContext, () => endpoint(internalContext)).catch((e) => {
						if (e instanceof APIError)
 /**
						* API Errors from response are caught
						* and returned to hooks
						*/
						return {
							response: e,
							status: e.statusCode,
							headers: e.headers ? new Headers(e.headers) : null
						};
						throw e;
					});
					if (result && result instanceof Response) return result;
					internalContext.context.returned = result.response;
					internalContext.context.responseHeaders = result.headers;
					const after = await runAfterHooks(internalContext, afterHooks);
					if (after.response) result.response = after.response;
					if (result.response instanceof APIError && shouldPublishLog(authContext.logger.level, "debug")) result.response.stack = result.response.errorStack;
					if (result.response instanceof APIError && !context?.asResponse) throw result.response;
					return context?.asResponse ? toResponse(result.response, {
						headers: result.headers,
						status: result.status
					}) : context?.returnHeaders ? context?.returnStatus ? {
						headers: result.headers,
						response: result.response,
						status: result.status
					} : {
						headers: result.headers,
						response: result.response
					} : context?.returnStatus ? {
						response: result.response,
						status: result.status
					} : result.response;
				});
			};
			if (await hasRequestState()) return run();
			else return runWithRequestState(/* @__PURE__ */ new WeakMap(), run);
		};
		api[key].path = endpoint.path;
		api[key].options = endpoint.options;
	}
	return api;
}
async function runBeforeHooks(context, hooks) {
	let modifiedContext = {};
	for (const hook of hooks) if (hook.matcher(context)) {
		const result = await hook.handler({
			...context,
			returnHeaders: false
		}).catch((e) => {
			if (e instanceof APIError && shouldPublishLog(context.context.logger.level, "debug")) e.stack = e.errorStack;
			throw e;
		});
		if (result && typeof result === "object") {
			if ("context" in result && typeof result.context === "object") {
				const { headers, ...rest } = result.context;
				if (headers instanceof Headers) if (modifiedContext.headers) headers.forEach((value, key) => {
					modifiedContext.headers?.set(key, value);
				});
				else modifiedContext.headers = headers;
				modifiedContext = defuReplaceArrays(rest, modifiedContext);
				continue;
			}
			return result;
		}
	}
	return { context: modifiedContext };
}
async function runAfterHooks(context, hooks) {
	for (const hook of hooks) if (hook.matcher(context)) {
		const result = await hook.handler(context).catch((e) => {
			if (e instanceof APIError) {
				if (shouldPublishLog(context.context.logger.level, "debug")) e.stack = e.errorStack;
				return {
					response: e,
					headers: e.headers ? new Headers(e.headers) : null
				};
			}
			throw e;
		});
		if (result.headers) result.headers.forEach((value, key) => {
			if (!context.context.responseHeaders) context.context.responseHeaders = new Headers({ [key]: value });
			else if (key.toLowerCase() === "set-cookie") context.context.responseHeaders.append(key, value);
			else context.context.responseHeaders.set(key, value);
		});
		if (result.response) context.context.returned = result.response;
	}
	return {
		response: context.context.returned,
		headers: context.context.responseHeaders
	};
}
function getHooks(authContext) {
	const plugins = authContext.options.plugins || [];
	const beforeHooks = [];
	const afterHooks = [];
	if (authContext.options.hooks?.before) beforeHooks.push({
		matcher: () => true,
		handler: authContext.options.hooks.before
	});
	if (authContext.options.hooks?.after) afterHooks.push({
		matcher: () => true,
		handler: authContext.options.hooks.after
	});
	const pluginBeforeHooks = plugins.map((plugin) => {
		if (plugin.hooks?.before) return plugin.hooks.before;
	}).filter((plugin) => plugin !== void 0).flat();
	const pluginAfterHooks = plugins.map((plugin) => {
		if (plugin.hooks?.after) return plugin.hooks.after;
	}).filter((plugin) => plugin !== void 0).flat();
	/**
	* Add plugin added hooks at last
	*/
	if (pluginBeforeHooks.length) beforeHooks.push(...pluginBeforeHooks);
	if (pluginAfterHooks.length) afterHooks.push(...pluginAfterHooks);
	return {
		beforeHooks,
		afterHooks
	};
}

//#endregion
//#region src/api/index.ts
function checkEndpointConflicts(options, logger$1) {
	const endpointRegistry = /* @__PURE__ */ new Map();
	options.plugins?.forEach((plugin) => {
		if (plugin.endpoints) {
			for (const [key, endpoint] of Object.entries(plugin.endpoints)) if (endpoint && "path" in endpoint) {
				const path = endpoint.path;
				let methods = [];
				if (endpoint.options && "method" in endpoint.options) {
					if (Array.isArray(endpoint.options.method)) methods = endpoint.options.method;
					else if (typeof endpoint.options.method === "string") methods = [endpoint.options.method];
				}
				if (methods.length === 0) methods = ["*"];
				if (!endpointRegistry.has(path)) endpointRegistry.set(path, []);
				endpointRegistry.get(path).push({
					pluginId: plugin.id,
					endpointKey: key,
					methods
				});
			}
		}
	});
	const conflicts = [];
	for (const [path, entries] of endpointRegistry.entries()) if (entries.length > 1) {
		const methodMap = /* @__PURE__ */ new Map();
		let hasConflict = false;
		for (const entry of entries) for (const method of entry.methods) {
			if (!methodMap.has(method)) methodMap.set(method, []);
			methodMap.get(method).push(entry.pluginId);
			if (methodMap.get(method).length > 1) hasConflict = true;
			if (method === "*" && entries.length > 1) hasConflict = true;
			else if (method !== "*" && methodMap.has("*")) hasConflict = true;
		}
		if (hasConflict) {
			const uniquePlugins = [...new Set(entries.map((e) => e.pluginId))];
			const conflictingMethods = [];
			for (const [method, plugins] of methodMap.entries()) if (plugins.length > 1 || method === "*" && entries.length > 1 || method !== "*" && methodMap.has("*")) conflictingMethods.push(method);
			conflicts.push({
				path,
				plugins: uniquePlugins,
				conflictingMethods
			});
		}
	}
	if (conflicts.length > 0) {
		const conflictMessages = conflicts.map((conflict) => `  - "${conflict.path}" [${conflict.conflictingMethods.join(", ")}] used by plugins: ${conflict.plugins.join(", ")}`).join("\n");
		logger$1.error(`Endpoint path conflicts detected! Multiple plugins are trying to use the same endpoint paths with conflicting HTTP methods:
${conflictMessages}

To resolve this, you can:
	1. Use only one of the conflicting plugins
	2. Configure the plugins to use different paths (if supported)
	3. Ensure plugins use different HTTP methods for the same path
`);
	}
}
function getEndpoints(ctx, options) {
	const pluginEndpoints = options.plugins?.reduce((acc, plugin) => {
		return {
			...acc,
			...plugin.endpoints
		};
	}, {}) ?? {};
	const middlewares = options.plugins?.map((plugin) => plugin.middlewares?.map((m) => {
		const middleware = (async (context) => {
			const authContext = await ctx;
			return m.middleware({
				...context,
				context: {
					...authContext,
					...context.context
				}
			});
		});
		middleware.options = m.middleware.options;
		return {
			path: m.path,
			middleware
		};
	})).filter((plugin) => plugin !== void 0).flat() || [];
	return {
		api: toAuthEndpoints({
			signInSocial: signInSocial(),
			callbackOAuth,
			getSession: getSession(),
			signOut,
			signUpEmail: signUpEmail(),
			signInEmail: signInEmail(),
			resetPassword,
			verifyEmail,
			sendVerificationEmail,
			changeEmail,
			changePassword,
			setPassword,
			updateUser: updateUser(),
			deleteUser,
			requestPasswordReset,
			requestPasswordResetCallback,
			listSessions: listSessions(),
			revokeSession,
			revokeSessions,
			revokeOtherSessions,
			linkSocialAccount,
			listUserAccounts,
			deleteUserCallback,
			unlinkAccount,
			refreshToken,
			getAccessToken,
			accountInfo,
			...pluginEndpoints,
			ok,
			error
		}, ctx),
		middlewares
	};
}
const router = (ctx, options) => {
	const { api, middlewares } = getEndpoints(ctx, options);
	const basePath = new URL(ctx.baseURL).pathname;
	return createRouter(api, {
		routerContext: ctx,
		openapi: { disabled: true },
		basePath,
		routerMiddleware: [{
			path: "/**",
			middleware: originCheckMiddleware
		}, ...middlewares],
		allowedMediaTypes: ["application/json"],
		async onRequest(req) {
			const disabledPaths = ctx.options.disabledPaths || [];
			const path = new URL(req.url).pathname.replace(basePath, "");
			if (disabledPaths.includes(path)) return new Response("Not Found", { status: 404 });
			for (const plugin of ctx.options.plugins || []) if (plugin.onRequest) {
				const response = await plugin.onRequest(req, ctx);
				if (response && "response" in response) return response.response;
				if (response && "request" in response) {
					const rateLimitResponse$1 = await onRequestRateLimit(response.request, ctx);
					if (rateLimitResponse$1) return rateLimitResponse$1;
					return response.request;
				}
			}
			return onRequestRateLimit(req, ctx);
		},
		async onResponse(res) {
			for (const plugin of ctx.options.plugins || []) if (plugin.onResponse) {
				const response = await plugin.onResponse(res, ctx);
				if (response) return response.response;
			}
			return res;
		},
		onError(e) {
			if (e instanceof APIError && e.status === "FOUND") return;
			if (options.onAPIError?.throw) throw e;
			if (options.onAPIError?.onError) {
				options.onAPIError.onError(e, ctx);
				return;
			}
			const optLogLevel = options.logger?.level;
			const log = optLogLevel === "error" || optLogLevel === "warn" || optLogLevel === "debug" ? logger : void 0;
			if (options.logger?.disabled !== true) {
				if (e && typeof e === "object" && "message" in e && typeof e.message === "string") {
					if (e.message.includes("no column") || e.message.includes("column") || e.message.includes("relation") || e.message.includes("table") || e.message.includes("does not exist")) {
						ctx.logger?.error(e.message);
						return;
					}
				}
				if (e instanceof APIError) {
					if (e.status === "INTERNAL_SERVER_ERROR") ctx.logger.error(e.status, e);
					log?.error(e.message);
				} else ctx.logger?.error(e && typeof e === "object" && "name" in e ? e.name : "", e);
			}
		}
	});
};

//#endregion
export { getAccessToken as A, createEmailVerificationToken as C, callbackOAuth as D, verifyEmail as E, decryptOAuthToken as F, setTokenUtil as I, originCheck as L, listUserAccounts as M, refreshToken as N, handleOAuthUserInfo as O, unlinkAccount as P, originCheckMiddleware as R, error as S, sendVerificationEmailFn as T, signInSocial as _, getEndpoints as a, resetPassword as b, changeEmail as c, deleteUserCallback as d, setPassword as f, signInEmail as g, signOut as h, createAuthMiddleware$1 as i, linkSocialAccount as j, accountInfo as k, changePassword as l, signUpEmail as m, checkEndpointConflicts as n, optionsMiddleware as o, updateUser as p, createAuthEndpoint$1 as r, router as s, APIError$1 as t, deleteUser as u, requestPasswordReset as v, sendVerificationEmail as w, ok as x, requestPasswordResetCallback as y };