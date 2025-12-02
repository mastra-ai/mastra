import { i as verifyJWT, n as symmetricDecodeJWT, r as symmetricEncodeJWT, t as signJWT } from "./jwt-DzuIBp7t.mjs";
import { l as parseUserOutput, u as getDate } from "./schema-CSB7dlK0.mjs";
import { t as safeJSONParse } from "./json-_HMgPUVh.mjs";
import { t as getBaseURL } from "./url-BLNRhCPO.mjs";
import { env, isProduction } from "@better-auth/core/env";
import { BetterAuthError } from "@better-auth/core/error";
import * as z from "zod";
import { base64Url } from "@better-auth/utils/base64";
import { binary } from "@better-auth/utils/binary";
import { createHMAC } from "@better-auth/utils/hmac";

//#region ../../node_modules/.pnpm/ms@4.0.0-nightly.202508271359/node_modules/ms/dist/index.js
const s = 1e3;
const m = s * 60;
const h = m * 60;
const d = h * 24;
const w = d * 7;
const y = d * 365.25;
const mo = y / 12;
function ms(value, options) {
	if (typeof value === "string") return parse(value);
	else if (typeof value === "number") return format(value, options);
	throw new Error(`Value provided to ms() must be a string or number. value=${JSON.stringify(value)}`);
}
/**
* Parse the given string and return milliseconds.
*
* @param str - A string to parse to milliseconds
* @returns The parsed value in milliseconds, or `NaN` if the string can't be
* parsed
*/
function parse(str) {
	if (typeof str !== "string" || str.length === 0 || str.length > 100) throw new Error(`Value provided to ms.parse() must be a string with length between 1 and 99. value=${JSON.stringify(str)}`);
	const match = /^(?<value>-?\d*\.?\d+) *(?<unit>milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|months?|mo|years?|yrs?|y)?$/i.exec(str);
	if (!match?.groups) return NaN;
	const { value, unit = "ms" } = match.groups;
	const n = parseFloat(value);
	const matchUnit = unit.toLowerCase();
	/* istanbul ignore next - istanbul doesn't understand, but thankfully the TypeScript the exhaustiveness check in the default case keeps us type safe here */
	switch (matchUnit) {
		case "years":
		case "year":
		case "yrs":
		case "yr":
		case "y": return n * y;
		case "months":
		case "month":
		case "mo": return n * mo;
		case "weeks":
		case "week":
		case "w": return n * w;
		case "days":
		case "day":
		case "d": return n * d;
		case "hours":
		case "hour":
		case "hrs":
		case "hr":
		case "h": return n * h;
		case "minutes":
		case "minute":
		case "mins":
		case "min":
		case "m": return n * m;
		case "seconds":
		case "second":
		case "secs":
		case "sec":
		case "s": return n * s;
		case "milliseconds":
		case "millisecond":
		case "msecs":
		case "msec":
		case "ms": return n;
		default: throw new Error(`Unknown unit "${matchUnit}" provided to ms.parse(). value=${JSON.stringify(str)}`);
	}
}
/**
* Short format for `ms`.
*/
function fmtShort(ms$1) {
	const msAbs = Math.abs(ms$1);
	if (msAbs >= y) return `${Math.round(ms$1 / y)}y`;
	if (msAbs >= mo) return `${Math.round(ms$1 / mo)}mo`;
	if (msAbs >= w) return `${Math.round(ms$1 / w)}w`;
	if (msAbs >= d) return `${Math.round(ms$1 / d)}d`;
	if (msAbs >= h) return `${Math.round(ms$1 / h)}h`;
	if (msAbs >= m) return `${Math.round(ms$1 / m)}m`;
	if (msAbs >= s) return `${Math.round(ms$1 / s)}s`;
	return `${ms$1}ms`;
}
/**
* Long format for `ms`.
*/
function fmtLong(ms$1) {
	const msAbs = Math.abs(ms$1);
	if (msAbs >= y) return plural(ms$1, msAbs, y, "year");
	if (msAbs >= mo) return plural(ms$1, msAbs, mo, "month");
	if (msAbs >= w) return plural(ms$1, msAbs, w, "week");
	if (msAbs >= d) return plural(ms$1, msAbs, d, "day");
	if (msAbs >= h) return plural(ms$1, msAbs, h, "hour");
	if (msAbs >= m) return plural(ms$1, msAbs, m, "minute");
	if (msAbs >= s) return plural(ms$1, msAbs, s, "second");
	return `${ms$1} ms`;
}
/**
* Format the given integer as a string.
*
* @param ms - milliseconds
* @param options - Options for the conversion
* @returns The formatted string
*/
function format(ms$1, options) {
	if (typeof ms$1 !== "number" || !Number.isFinite(ms$1)) throw new Error("Value provided to ms.format() must be of type number.");
	return options?.long ? fmtLong(ms$1) : fmtShort(ms$1);
}
/**
* Pluralization helper.
*/
function plural(ms$1, msAbs, n, name) {
	const isPlural = msAbs >= n * 1.5;
	return `${Math.round(ms$1 / n)} ${name}${isPlural ? "s" : ""}`;
}

//#endregion
//#region src/cookies/session-store.ts
const ALLOWED_COOKIE_SIZE = 4096;
const ESTIMATED_EMPTY_COOKIE_SIZE = 200;
const CHUNK_SIZE = ALLOWED_COOKIE_SIZE - ESTIMATED_EMPTY_COOKIE_SIZE;
/**
* Parse cookies from the request headers
*/
function parseCookiesFromContext(ctx) {
	const cookieHeader = ctx.headers?.get("cookie");
	if (!cookieHeader) return {};
	const cookies = {};
	const pairs = cookieHeader.split("; ");
	for (const pair of pairs) {
		const [name, ...valueParts] = pair.split("=");
		if (name && valueParts.length > 0) cookies[name] = valueParts.join("=");
	}
	return cookies;
}
/**
* Extract the chunk index from a cookie name
*/
function getChunkIndex(cookieName) {
	const parts = cookieName.split(".");
	const lastPart = parts[parts.length - 1];
	const index = parseInt(lastPart || "0", 10);
	return isNaN(index) ? 0 : index;
}
/**
* Read all existing chunks from cookies
*/
function readExistingChunks(cookieName, ctx) {
	const chunks = {};
	const cookies = parseCookiesFromContext(ctx);
	for (const [name, value] of Object.entries(cookies)) if (name.startsWith(cookieName)) chunks[name] = value;
	return chunks;
}
/**
* Get the full session data by joining all chunks
*/
function joinChunks(chunks) {
	return Object.keys(chunks).sort((a, b) => {
		return getChunkIndex(a) - getChunkIndex(b);
	}).map((key) => chunks[key]).join("");
}
/**
* Split a cookie value into chunks if needed
*/
function chunkCookie(cookie, chunks, logger$1) {
	const chunkCount = Math.ceil(cookie.value.length / CHUNK_SIZE);
	if (chunkCount === 1) {
		chunks[cookie.name] = cookie.value;
		return [cookie];
	}
	const cookies = [];
	for (let i = 0; i < chunkCount; i++) {
		const name = `${cookie.name}.${i}`;
		const start = i * CHUNK_SIZE;
		const value = cookie.value.substring(start, start + CHUNK_SIZE);
		cookies.push({
			...cookie,
			name,
			value
		});
		chunks[name] = value;
	}
	logger$1.debug("CHUNKING_SESSION_COOKIE", {
		message: `Session cookie exceeds allowed ${ALLOWED_COOKIE_SIZE} bytes.`,
		emptyCookieSize: ESTIMATED_EMPTY_COOKIE_SIZE,
		valueSize: cookie.value.length,
		chunkCount,
		chunks: cookies.map((c) => c.value.length + ESTIMATED_EMPTY_COOKIE_SIZE)
	});
	return cookies;
}
/**
* Get all cookies that should be cleaned (removed)
*/
function getCleanCookies(chunks, cookieOptions) {
	const cleanedChunks = {};
	for (const name in chunks) cleanedChunks[name] = {
		name,
		value: "",
		options: {
			...cookieOptions,
			maxAge: 0
		}
	};
	return cleanedChunks;
}
/**
* Create a session store for handling cookie chunking.
* When session data exceeds 4KB, it automatically splits it into multiple cookies.
*
* Based on next-auth's SessionStore implementation.
* @see https://github.com/nextauthjs/next-auth/blob/27b2519b84b8eb9cf053775dea29d577d2aa0098/packages/next-auth/src/core/lib/cookie.ts
*/
function createSessionStore(cookieName, cookieOptions, ctx) {
	const chunks = readExistingChunks(cookieName, ctx);
	const logger$1 = ctx.context.logger;
	return {
		getValue() {
			return joinChunks(chunks);
		},
		hasChunks() {
			return Object.keys(chunks).length > 0;
		},
		chunk(value, options) {
			const cleanedChunks = getCleanCookies(chunks, cookieOptions);
			for (const name in chunks) delete chunks[name];
			const cookies = cleanedChunks;
			const chunked = chunkCookie({
				name: cookieName,
				value,
				options: {
					...cookieOptions,
					...options
				}
			}, chunks, logger$1);
			for (const chunk of chunked) cookies[chunk.name] = chunk;
			return Object.values(cookies);
		},
		clean() {
			const cleanedChunks = getCleanCookies(chunks, cookieOptions);
			for (const name in chunks) delete chunks[name];
			return Object.values(cleanedChunks);
		},
		setCookies(cookies) {
			for (const cookie of cookies) ctx.setCookie(cookie.name, cookie.value, cookie.options);
		}
	};
}
function getChunkedCookie(ctx, cookieName) {
	const value = ctx.getCookie(cookieName);
	if (value) return value;
	const chunks = [];
	const cookieHeader = ctx.headers?.get("cookie");
	if (!cookieHeader) return null;
	const cookies = {};
	const pairs = cookieHeader.split("; ");
	for (const pair of pairs) {
		const [name, ...valueParts] = pair.split("=");
		if (name && valueParts.length > 0) cookies[name] = valueParts.join("=");
	}
	for (const [name, val] of Object.entries(cookies)) if (name.startsWith(cookieName + ".")) {
		const indexStr = name.split(".").at(-1);
		const index = parseInt(indexStr || "0", 10);
		if (!isNaN(index)) chunks.push({
			index,
			value: val
		});
	}
	if (chunks.length > 0) {
		chunks.sort((a, b) => a.index - b.index);
		return chunks.map((c) => c.value).join("");
	}
	return null;
}
const getSessionQuerySchema = z.optional(z.object({
	disableCookieCache: z.coerce.boolean().meta({ description: "Disable cookie cache and fetch session from database" }).optional(),
	disableRefresh: z.coerce.boolean().meta({ description: "Disable session refresh. Useful for checking session status, without updating the session" }).optional()
}));

//#endregion
//#region src/cookies/cookie-utils.ts
function parseSetCookieHeader(setCookie) {
	const cookies = /* @__PURE__ */ new Map();
	setCookie.split(", ").forEach((cookieString) => {
		const [nameValue, ...attributes] = cookieString.split(";").map((part) => part.trim());
		const [name, ...valueParts] = (nameValue || "").split("=");
		const value = valueParts.join("=");
		if (!name || value === void 0) return;
		const attrObj = { value };
		attributes.forEach((attribute) => {
			const [attrName, ...attrValueParts] = attribute.split("=");
			const attrValue = attrValueParts.join("=");
			const normalizedAttrName = attrName.trim().toLowerCase();
			switch (normalizedAttrName) {
				case "max-age":
					attrObj["max-age"] = attrValue ? parseInt(attrValue.trim(), 10) : void 0;
					break;
				case "expires":
					attrObj.expires = attrValue ? new Date(attrValue.trim()) : void 0;
					break;
				case "domain":
					attrObj.domain = attrValue ? attrValue.trim() : void 0;
					break;
				case "path":
					attrObj.path = attrValue ? attrValue.trim() : void 0;
					break;
				case "secure":
					attrObj.secure = true;
					break;
				case "httponly":
					attrObj.httponly = true;
					break;
				case "samesite":
					attrObj.samesite = attrValue ? attrValue.trim().toLowerCase() : void 0;
					break;
				default:
					attrObj[normalizedAttrName] = attrValue ? attrValue.trim() : true;
					break;
			}
		});
		cookies.set(name, attrObj);
	});
	return cookies;
}
function setCookieToHeader(headers) {
	return (context) => {
		const setCookieHeader = context.response.headers.get("set-cookie");
		if (!setCookieHeader) return;
		const cookieMap = /* @__PURE__ */ new Map();
		(headers.get("cookie") || "").split(";").forEach((cookie) => {
			const [name, ...rest] = cookie.trim().split("=");
			if (name && rest.length > 0) cookieMap.set(name, rest.join("="));
		});
		setCookieHeader.split(",").forEach((header) => {
			parseSetCookieHeader(header).forEach((value, name) => {
				cookieMap.set(name, value.value);
			});
		});
		const updatedCookies = Array.from(cookieMap.entries()).map(([name, value]) => `${name}=${value}`).join("; ");
		headers.set("cookie", updatedCookies);
	};
}

//#endregion
//#region src/cookies/index.ts
function createCookieGetter(options) {
	const secureCookiePrefix = (options.advanced?.useSecureCookies !== void 0 ? options.advanced?.useSecureCookies : options.baseURL !== void 0 ? options.baseURL.startsWith("https://") ? true : false : isProduction) ? "__Secure-" : "";
	const crossSubdomainEnabled = !!options.advanced?.crossSubDomainCookies?.enabled;
	const domain = crossSubdomainEnabled ? options.advanced?.crossSubDomainCookies?.domain || (options.baseURL ? new URL(options.baseURL).hostname : void 0) : void 0;
	if (crossSubdomainEnabled && !domain) throw new BetterAuthError("baseURL is required when crossSubdomainCookies are enabled");
	function createCookie(cookieName, overrideAttributes = {}) {
		const prefix = options.advanced?.cookiePrefix || "better-auth";
		const name = options.advanced?.cookies?.[cookieName]?.name || `${prefix}.${cookieName}`;
		const attributes = options.advanced?.cookies?.[cookieName]?.attributes;
		return {
			name: `${secureCookiePrefix}${name}`,
			attributes: {
				secure: !!secureCookiePrefix,
				sameSite: "lax",
				path: "/",
				httpOnly: true,
				...crossSubdomainEnabled ? { domain } : {},
				...options.advanced?.defaultCookieAttributes,
				...overrideAttributes,
				...attributes
			}
		};
	}
	return createCookie;
}
function getCookies(options) {
	const createCookie = createCookieGetter(options);
	const sessionToken = createCookie("session_token", { maxAge: options.session?.expiresIn || ms("7d") / 1e3 });
	const sessionData = createCookie("session_data", { maxAge: options.session?.cookieCache?.maxAge || 300 });
	const accountData = createCookie("account_data", { maxAge: options.session?.cookieCache?.maxAge || 300 });
	const dontRememberToken = createCookie("dont_remember");
	return {
		sessionToken: {
			name: sessionToken.name,
			options: sessionToken.attributes
		},
		sessionData: {
			name: sessionData.name,
			options: sessionData.attributes
		},
		dontRememberToken: {
			name: dontRememberToken.name,
			options: dontRememberToken.attributes
		},
		accountData: {
			name: accountData.name,
			options: accountData.attributes
		}
	};
}
async function setCookieCache(ctx, session, dontRememberMe) {
	if (ctx.context.options.session?.cookieCache?.enabled) {
		const filteredSession = Object.entries(session.session).reduce((acc, [key, value]) => {
			const fieldConfig = ctx.context.options.session?.additionalFields?.[key];
			if (!fieldConfig || fieldConfig.returned !== false) acc[key] = value;
			return acc;
		}, {});
		const filteredUser = parseUserOutput(ctx.context.options, session.user);
		const versionConfig = ctx.context.options.session?.cookieCache?.version;
		let version = "1";
		if (versionConfig) {
			if (typeof versionConfig === "string") version = versionConfig;
			else if (typeof versionConfig === "function") {
				const result = versionConfig(session.session, session.user);
				version = result instanceof Promise ? await result : result;
			}
		}
		const sessionData = {
			session: filteredSession,
			user: filteredUser,
			updatedAt: Date.now(),
			version
		};
		const options = {
			...ctx.context.authCookies.sessionData.options,
			maxAge: dontRememberMe ? void 0 : ctx.context.authCookies.sessionData.options.maxAge
		};
		const expiresAtDate = getDate(options.maxAge || 60, "sec").getTime();
		const strategy = ctx.context.options.session?.cookieCache?.strategy || "compact";
		let data;
		if (strategy === "jwe") data = await symmetricEncodeJWT(sessionData, ctx.context.secret, "better-auth-session", options.maxAge || 300);
		else if (strategy === "jwt") data = await signJWT(sessionData, ctx.context.secret, options.maxAge || 300);
		else data = base64Url.encode(JSON.stringify({
			session: sessionData,
			expiresAt: expiresAtDate,
			signature: await createHMAC("SHA-256", "base64urlnopad").sign(ctx.context.secret, JSON.stringify({
				...sessionData,
				expiresAt: expiresAtDate
			}))
		}), { padding: false });
		if (data.length > 4093) {
			const sessionStore = createSessionStore(ctx.context.authCookies.sessionData.name, options, ctx);
			const cookies = sessionStore.chunk(data, options);
			sessionStore.setCookies(cookies);
		} else {
			const sessionStore = createSessionStore(ctx.context.authCookies.sessionData.name, options, ctx);
			if (sessionStore.hasChunks()) {
				const cleanCookies = sessionStore.clean();
				sessionStore.setCookies(cleanCookies);
			}
			ctx.setCookie(ctx.context.authCookies.sessionData.name, data, options);
		}
	}
}
async function setSessionCookie(ctx, session, dontRememberMe, overrides) {
	const dontRememberMeCookie = await ctx.getSignedCookie(ctx.context.authCookies.dontRememberToken.name, ctx.context.secret);
	dontRememberMe = dontRememberMe !== void 0 ? dontRememberMe : !!dontRememberMeCookie;
	const options = ctx.context.authCookies.sessionToken.options;
	const maxAge = dontRememberMe ? void 0 : ctx.context.sessionConfig.expiresIn;
	await ctx.setSignedCookie(ctx.context.authCookies.sessionToken.name, session.session.token, ctx.context.secret, {
		...options,
		maxAge,
		...overrides
	});
	if (dontRememberMe) await ctx.setSignedCookie(ctx.context.authCookies.dontRememberToken.name, "true", ctx.context.secret, ctx.context.authCookies.dontRememberToken.options);
	await setCookieCache(ctx, session, dontRememberMe);
	ctx.context.setNewSession(session);
	/**
	* If secondary storage is enabled, store the session data in the secondary storage
	* This is useful if the session got updated and we want to update the session data in the
	* secondary storage
	*/
	if (ctx.context.options.secondaryStorage) await ctx.context.secondaryStorage?.set(session.session.token, JSON.stringify({
		user: session.user,
		session: session.session
	}), Math.floor((new Date(session.session.expiresAt).getTime() - Date.now()) / 1e3));
}
function deleteSessionCookie(ctx, skipDontRememberMe) {
	ctx.setCookie(ctx.context.authCookies.sessionToken.name, "", {
		...ctx.context.authCookies.sessionToken.options,
		maxAge: 0
	});
	const sessionStore = createSessionStore(ctx.context.authCookies.sessionData.name, ctx.context.authCookies.sessionData.options, ctx);
	const cleanCookies = sessionStore.clean();
	sessionStore.setCookies(cleanCookies);
	if (!skipDontRememberMe) ctx.setCookie(ctx.context.authCookies.dontRememberToken.name, "", {
		...ctx.context.authCookies.dontRememberToken.options,
		maxAge: 0
	});
}
function parseCookies(cookieHeader) {
	const cookies = cookieHeader.split("; ");
	const cookieMap = /* @__PURE__ */ new Map();
	cookies.forEach((cookie) => {
		const [name, value] = cookie.split("=");
		cookieMap.set(name, value);
	});
	return cookieMap;
}
const getSessionCookie = (request, config) => {
	if (config?.cookiePrefix) if (config.cookieName) config.cookiePrefix = `${config.cookiePrefix}-`;
	else config.cookiePrefix = `${config.cookiePrefix}.`;
	const headers = "headers" in request ? request.headers : request;
	const req = request instanceof Request ? request : void 0;
	getBaseURL(req?.url, config?.path, req);
	const cookies = headers.get("cookie");
	if (!cookies) return null;
	const { cookieName = "session_token", cookiePrefix = "better-auth." } = config || {};
	const name = `${cookiePrefix}${cookieName}`;
	const secureCookieName = `__Secure-${name}`;
	const parsedCookie = parseCookies(cookies);
	const sessionToken = parsedCookie.get(name) || parsedCookie.get(secureCookieName);
	if (sessionToken) return sessionToken;
	return null;
};
const getCookieCache = async (request, config) => {
	const cookies = (request instanceof Headers ? request : request.headers).get("cookie");
	if (!cookies) return null;
	const { cookieName = "session_data", cookiePrefix = "better-auth" } = config || {};
	const name = config?.isSecure !== void 0 ? config.isSecure ? `__Secure-${cookiePrefix}.${cookieName}` : `${cookiePrefix}.${cookieName}` : isProduction ? `__Secure-${cookiePrefix}.${cookieName}` : `${cookiePrefix}.${cookieName}`;
	const parsedCookie = parseCookies(cookies);
	let sessionData = parsedCookie.get(name);
	if (!sessionData) {
		const chunks = [];
		for (const [cookieName$1, value] of parsedCookie.entries()) if (cookieName$1.startsWith(name + ".")) {
			const parts = cookieName$1.split(".");
			const indexStr = parts[parts.length - 1];
			const index = parseInt(indexStr || "0", 10);
			if (!isNaN(index)) chunks.push({
				index,
				value
			});
		}
		if (chunks.length > 0) {
			chunks.sort((a, b) => a.index - b.index);
			sessionData = chunks.map((c) => c.value).join("");
		}
	}
	if (sessionData) {
		const secret = config?.secret || env.BETTER_AUTH_SECRET;
		if (!secret) throw new BetterAuthError("getCookieCache requires a secret to be provided. Either pass it as an option or set the BETTER_AUTH_SECRET environment variable");
		const strategy = config?.strategy || "compact";
		if (strategy === "jwe") {
			const payload = await symmetricDecodeJWT(sessionData, secret, "better-auth-session");
			if (payload && payload.session && payload.user) {
				if (config?.version) {
					const cookieVersion = payload.version || "1";
					let expectedVersion = "1";
					if (typeof config.version === "string") expectedVersion = config.version;
					else if (typeof config.version === "function") {
						const result = config.version(payload.session, payload.user);
						expectedVersion = result instanceof Promise ? await result : result;
					}
					if (cookieVersion !== expectedVersion) return null;
				}
				return payload;
			}
			return null;
		} else if (strategy === "jwt") {
			const payload = await verifyJWT(sessionData, secret);
			if (payload && payload.session && payload.user) {
				if (config?.version) {
					const cookieVersion = payload.version || "1";
					let expectedVersion = "1";
					if (typeof config.version === "string") expectedVersion = config.version;
					else if (typeof config.version === "function") {
						const result = config.version(payload.session, payload.user);
						expectedVersion = result instanceof Promise ? await result : result;
					}
					if (cookieVersion !== expectedVersion) return null;
				}
				return payload;
			}
			return null;
		} else {
			const sessionDataPayload = safeJSONParse(binary.decode(base64Url.decode(sessionData)));
			if (!sessionDataPayload) return null;
			if (!await createHMAC("SHA-256", "base64urlnopad").verify(secret, JSON.stringify({
				...sessionDataPayload.session,
				expiresAt: sessionDataPayload.expiresAt
			}), sessionDataPayload.signature)) return null;
			if (config?.version && sessionDataPayload.session) {
				const cookieVersion = sessionDataPayload.session.version || "1";
				let expectedVersion = "1";
				if (typeof config.version === "string") expectedVersion = config.version;
				else if (typeof config.version === "function") {
					const result = config.version(sessionDataPayload.session.session, sessionDataPayload.session.user);
					expectedVersion = result instanceof Promise ? await result : result;
				}
				if (cookieVersion !== expectedVersion) return null;
			}
			return sessionDataPayload.session;
		}
	}
	return null;
};

//#endregion
export { getSessionCookie as a, setSessionCookie as c, createSessionStore as d, getChunkedCookie as f, getCookies as i, parseSetCookieHeader as l, ms as m, deleteSessionCookie as n, parseCookies as o, getSessionQuerySchema as p, getCookieCache as r, setCookieCache as s, createCookieGetter as t, setCookieToHeader as u };