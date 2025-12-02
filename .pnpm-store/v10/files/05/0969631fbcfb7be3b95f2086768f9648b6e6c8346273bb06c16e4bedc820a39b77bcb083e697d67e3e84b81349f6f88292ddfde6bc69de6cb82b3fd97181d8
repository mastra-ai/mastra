import { i as verifyJWT, n as symmetricDecodeJWT } from "./jwt-DzuIBp7t.mjs";
import { l as parseUserOutput, s as parseSessionOutput, u as getDate } from "./schema-CSB7dlK0.mjs";
import { t as safeJSONParse } from "./json-_HMgPUVh.mjs";
import { c as setSessionCookie, f as getChunkedCookie, n as deleteSessionCookie, p as getSessionQuerySchema, s as setCookieCache } from "./cookies-D_dksn7B.mjs";
import { BASE_ERROR_CODES } from "@better-auth/core/error";
import { APIError } from "better-call";
import * as z from "zod";
import { createAuthEndpoint, createAuthMiddleware } from "@better-auth/core/api";
import { base64Url } from "@better-auth/utils/base64";
import { binary } from "@better-auth/utils/binary";
import { createHMAC } from "@better-auth/utils/hmac";

//#region src/api/routes/session.ts
const getSession = () => createAuthEndpoint("/get-session", {
	method: "GET",
	operationId: "getSession",
	query: getSessionQuerySchema,
	requireHeaders: true,
	metadata: { openapi: {
		operationId: "getSession",
		description: "Get the current session",
		responses: { "200": {
			description: "Success",
			content: { "application/json": { schema: {
				type: "object",
				properties: {
					session: { $ref: "#/components/schemas/Session" },
					user: { $ref: "#/components/schemas/User" }
				},
				required: ["session", "user"]
			} } }
		} }
	} }
}, async (ctx) => {
	try {
		const sessionCookieToken = await ctx.getSignedCookie(ctx.context.authCookies.sessionToken.name, ctx.context.secret);
		if (!sessionCookieToken) return null;
		const sessionDataCookie = getChunkedCookie(ctx, ctx.context.authCookies.sessionData.name);
		let sessionDataPayload = null;
		if (sessionDataCookie) {
			const strategy = ctx.context.options.session?.cookieCache?.strategy || "compact";
			if (strategy === "jwe") {
				const payload = await symmetricDecodeJWT(sessionDataCookie, ctx.context.secret, "better-auth-session");
				if (payload && payload.session && payload.user) sessionDataPayload = {
					session: {
						session: payload.session,
						user: payload.user,
						updatedAt: payload.updatedAt,
						version: payload.version
					},
					expiresAt: payload.exp ? payload.exp * 1e3 : Date.now()
				};
				else {
					const dataCookie = ctx.context.authCookies.sessionData.name;
					ctx.setCookie(dataCookie, "", { maxAge: 0 });
					return ctx.json(null);
				}
			} else if (strategy === "jwt") {
				const payload = await verifyJWT(sessionDataCookie, ctx.context.secret);
				if (payload && payload.session && payload.user) sessionDataPayload = {
					session: {
						session: payload.session,
						user: payload.user,
						updatedAt: payload.updatedAt,
						version: payload.version
					},
					expiresAt: payload.exp ? payload.exp * 1e3 : Date.now()
				};
				else {
					const dataCookie = ctx.context.authCookies.sessionData.name;
					ctx.setCookie(dataCookie, "", { maxAge: 0 });
					return ctx.json(null);
				}
			} else {
				const parsed = safeJSONParse(binary.decode(base64Url.decode(sessionDataCookie)));
				if (parsed) if (await createHMAC("SHA-256", "base64urlnopad").verify(ctx.context.secret, JSON.stringify({
					...parsed.session,
					expiresAt: parsed.expiresAt
				}), parsed.signature)) sessionDataPayload = parsed;
				else {
					const dataCookie = ctx.context.authCookies.sessionData.name;
					ctx.setCookie(dataCookie, "", { maxAge: 0 });
					return ctx.json(null);
				}
			}
		}
		const dontRememberMe = await ctx.getSignedCookie(ctx.context.authCookies.dontRememberToken.name, ctx.context.secret);
		/**
		* If session data is present in the cookie, check if it should be used or refreshed
		*/
		if (sessionDataPayload?.session && ctx.context.options.session?.cookieCache?.enabled && !ctx.query?.disableCookieCache) {
			const session$1 = sessionDataPayload.session;
			const versionConfig = ctx.context.options.session?.cookieCache?.version;
			let expectedVersion = "1";
			if (versionConfig) {
				if (typeof versionConfig === "string") expectedVersion = versionConfig;
				else if (typeof versionConfig === "function") {
					const result = versionConfig(session$1.session, session$1.user);
					expectedVersion = result instanceof Promise ? await result : result;
				}
			}
			if ((session$1.version || "1") !== expectedVersion) {
				const dataCookie = ctx.context.authCookies.sessionData.name;
				ctx.setCookie(dataCookie, "", { maxAge: 0 });
			} else if (sessionDataPayload.expiresAt < Date.now() || session$1.session.expiresAt < /* @__PURE__ */ new Date()) {
				const dataCookie = ctx.context.authCookies.sessionData.name;
				ctx.setCookie(dataCookie, "", { maxAge: 0 });
			} else {
				const cookieRefreshCache = ctx.context.sessionConfig.cookieRefreshCache;
				if (cookieRefreshCache === false) {
					ctx.context.session = session$1;
					return ctx.json({
						session: session$1.session,
						user: session$1.user
					});
				}
				if (sessionDataPayload.expiresAt - Date.now() < cookieRefreshCache.updateAge * 1e3) {
					const newExpiresAt = getDate(ctx.context.options.session?.cookieCache?.maxAge || 300, "sec");
					const refreshedSession = {
						session: {
							...session$1.session,
							expiresAt: newExpiresAt
						},
						user: session$1.user,
						updatedAt: Date.now()
					};
					await setCookieCache(ctx, refreshedSession, false);
					const parsedRefreshedSession = parseSessionOutput(ctx.context.options, {
						...refreshedSession.session,
						expiresAt: new Date(refreshedSession.session.expiresAt),
						createdAt: new Date(refreshedSession.session.createdAt),
						updatedAt: new Date(refreshedSession.session.updatedAt)
					});
					const parsedRefreshedUser = parseUserOutput(ctx.context.options, {
						...refreshedSession.user,
						createdAt: new Date(refreshedSession.user.createdAt),
						updatedAt: new Date(refreshedSession.user.updatedAt)
					});
					ctx.context.session = {
						session: parsedRefreshedSession,
						user: parsedRefreshedUser
					};
					return ctx.json({
						session: parsedRefreshedSession,
						user: parsedRefreshedUser
					});
				}
				const parsedSession = parseSessionOutput(ctx.context.options, {
					...session$1.session,
					expiresAt: new Date(session$1.session.expiresAt),
					createdAt: new Date(session$1.session.createdAt),
					updatedAt: new Date(session$1.session.updatedAt)
				});
				const parsedUser = parseUserOutput(ctx.context.options, {
					...session$1.user,
					createdAt: new Date(session$1.user.createdAt),
					updatedAt: new Date(session$1.user.updatedAt)
				});
				ctx.context.session = {
					session: parsedSession,
					user: parsedUser
				};
				return ctx.json({
					session: parsedSession,
					user: parsedUser
				});
			}
		}
		const session = await ctx.context.internalAdapter.findSession(sessionCookieToken);
		ctx.context.session = session;
		if (!session || session.session.expiresAt < /* @__PURE__ */ new Date()) {
			deleteSessionCookie(ctx);
			if (session)
 /**
			* if session expired clean up the session
			*/
			await ctx.context.internalAdapter.deleteSession(session.session.token);
			return ctx.json(null);
		}
		/**
		* We don't need to update the session if the user doesn't want to be remembered
		* or if the session refresh is disabled
		*/
		if (dontRememberMe || ctx.query?.disableRefresh) {
			const parsedSession = parseSessionOutput(ctx.context.options, session.session);
			const parsedUser = parseUserOutput(ctx.context.options, session.user);
			return ctx.json({
				session: parsedSession,
				user: parsedUser
			});
		}
		const expiresIn = ctx.context.sessionConfig.expiresIn;
		const updateAge = ctx.context.sessionConfig.updateAge;
		if (session.session.expiresAt.valueOf() - expiresIn * 1e3 + updateAge * 1e3 <= Date.now() && (!ctx.query?.disableRefresh || !ctx.context.options.session?.disableSessionRefresh)) {
			const updatedSession = await ctx.context.internalAdapter.updateSession(session.session.token, {
				expiresAt: getDate(ctx.context.sessionConfig.expiresIn, "sec"),
				updatedAt: /* @__PURE__ */ new Date()
			});
			if (!updatedSession) {
				/**
				* Handle case where session update fails (e.g., concurrent deletion)
				*/
				deleteSessionCookie(ctx);
				return ctx.json(null, { status: 401 });
			}
			const maxAge = (updatedSession.expiresAt.valueOf() - Date.now()) / 1e3;
			await setSessionCookie(ctx, {
				session: updatedSession,
				user: session.user
			}, false, { maxAge });
			const parsedUpdatedSession = parseSessionOutput(ctx.context.options, updatedSession);
			const parsedUser = parseUserOutput(ctx.context.options, session.user);
			return ctx.json({
				session: parsedUpdatedSession,
				user: parsedUser
			});
		}
		await setCookieCache(ctx, session, !!dontRememberMe);
		return ctx.json(session);
	} catch (error) {
		ctx.context.logger.error("INTERNAL_SERVER_ERROR", error);
		throw new APIError("INTERNAL_SERVER_ERROR", { message: BASE_ERROR_CODES.FAILED_TO_GET_SESSION });
	}
});
const getSessionFromCtx = async (ctx, config) => {
	if (ctx.context.session) return ctx.context.session;
	const session = await getSession()({
		...ctx,
		asResponse: false,
		headers: ctx.headers,
		returnHeaders: false,
		returnStatus: false,
		query: {
			...config,
			...ctx.query
		}
	}).catch((e) => {
		return null;
	});
	ctx.context.session = session;
	return session;
};
/**
* The middleware forces the endpoint to require a valid session.
*/
const sessionMiddleware = createAuthMiddleware(async (ctx) => {
	const session = await getSessionFromCtx(ctx);
	if (!session?.session) throw new APIError("UNAUTHORIZED");
	return { session };
});
/**
* This middleware forces the endpoint to require a valid session and ignores cookie cache.
* This should be used for sensitive operations like password changes, account deletion, etc.
* to ensure that revoked sessions cannot be used even if they're still cached in cookies.
*/
const sensitiveSessionMiddleware = createAuthMiddleware(async (ctx) => {
	const session = await getSessionFromCtx(ctx, { disableCookieCache: true });
	if (!session?.session) throw new APIError("UNAUTHORIZED");
	return { session };
});
/**
* This middleware allows you to call the endpoint on the client if session is valid.
* However, if called on the server, no session is required.
*/
const requestOnlySessionMiddleware = createAuthMiddleware(async (ctx) => {
	const session = await getSessionFromCtx(ctx);
	if (!session?.session && (ctx.request || ctx.headers)) throw new APIError("UNAUTHORIZED");
	return { session };
});
/**
* This middleware forces the endpoint to require a valid session,
* as well as making sure the session is fresh before proceeding.
*
* Session freshness check will be skipped if the session config's freshAge
* is set to 0
*/
const freshSessionMiddleware = createAuthMiddleware(async (ctx) => {
	const session = await getSessionFromCtx(ctx);
	if (!session?.session) throw new APIError("UNAUTHORIZED");
	if (ctx.context.sessionConfig.freshAge === 0) return { session };
	const freshAge = ctx.context.sessionConfig.freshAge;
	const lastUpdated = new Date(session.session.updatedAt || session.session.createdAt).getTime();
	if (!(Date.now() - lastUpdated < freshAge * 1e3)) throw new APIError("FORBIDDEN", { message: "Session is not fresh" });
	return { session };
});
/**
* user active sessions list
*/
const listSessions = () => createAuthEndpoint("/list-sessions", {
	method: "GET",
	operationId: "listUserSessions",
	use: [sessionMiddleware],
	requireHeaders: true,
	metadata: { openapi: {
		operationId: "listUserSessions",
		description: "List all active sessions for the user",
		responses: { "200": {
			description: "Success",
			content: { "application/json": { schema: {
				type: "array",
				items: { $ref: "#/components/schemas/Session" }
			} } }
		} }
	} }
}, async (ctx) => {
	try {
		const activeSessions = (await ctx.context.internalAdapter.listSessions(ctx.context.session.user.id)).filter((session) => {
			return session.expiresAt > /* @__PURE__ */ new Date();
		});
		return ctx.json(activeSessions);
	} catch (e) {
		ctx.context.logger.error(e);
		throw ctx.error("INTERNAL_SERVER_ERROR");
	}
});
/**
* revoke a single session
*/
const revokeSession = createAuthEndpoint("/revoke-session", {
	method: "POST",
	body: z.object({ token: z.string().meta({ description: "The token to revoke" }) }),
	use: [sensitiveSessionMiddleware],
	requireHeaders: true,
	metadata: { openapi: {
		description: "Revoke a single session",
		requestBody: { content: { "application/json": { schema: {
			type: "object",
			properties: { token: {
				type: "string",
				description: "The token to revoke"
			} },
			required: ["token"]
		} } } },
		responses: { "200": {
			description: "Success",
			content: { "application/json": { schema: {
				type: "object",
				properties: { status: {
					type: "boolean",
					description: "Indicates if the session was revoked successfully"
				} },
				required: ["status"]
			} } }
		} }
	} }
}, async (ctx) => {
	const token = ctx.body.token;
	if ((await ctx.context.internalAdapter.findSession(token))?.session.userId === ctx.context.session.user.id) try {
		await ctx.context.internalAdapter.deleteSession(token);
	} catch (error) {
		ctx.context.logger.error(error && typeof error === "object" && "name" in error ? error.name : "", error);
		throw new APIError("INTERNAL_SERVER_ERROR");
	}
	return ctx.json({ status: true });
});
/**
* revoke all user sessions
*/
const revokeSessions = createAuthEndpoint("/revoke-sessions", {
	method: "POST",
	use: [sensitiveSessionMiddleware],
	requireHeaders: true,
	metadata: { openapi: {
		description: "Revoke all sessions for the user",
		responses: { "200": {
			description: "Success",
			content: { "application/json": { schema: {
				type: "object",
				properties: { status: {
					type: "boolean",
					description: "Indicates if all sessions were revoked successfully"
				} },
				required: ["status"]
			} } }
		} }
	} }
}, async (ctx) => {
	try {
		await ctx.context.internalAdapter.deleteSessions(ctx.context.session.user.id);
	} catch (error) {
		ctx.context.logger.error(error && typeof error === "object" && "name" in error ? error.name : "", error);
		throw new APIError("INTERNAL_SERVER_ERROR");
	}
	return ctx.json({ status: true });
});
const revokeOtherSessions = createAuthEndpoint("/revoke-other-sessions", {
	method: "POST",
	requireHeaders: true,
	use: [sensitiveSessionMiddleware],
	metadata: { openapi: {
		description: "Revoke all other sessions for the user except the current one",
		responses: { "200": {
			description: "Success",
			content: { "application/json": { schema: {
				type: "object",
				properties: { status: {
					type: "boolean",
					description: "Indicates if all other sessions were revoked successfully"
				} },
				required: ["status"]
			} } }
		} }
	} }
}, async (ctx) => {
	const session = ctx.context.session;
	if (!session.user) throw new APIError("UNAUTHORIZED");
	const otherSessions = (await ctx.context.internalAdapter.listSessions(session.user.id)).filter((session$1) => {
		return session$1.expiresAt > /* @__PURE__ */ new Date();
	}).filter((session$1) => session$1.token !== ctx.context.session.session.token);
	await Promise.all(otherSessions.map((session$1) => ctx.context.internalAdapter.deleteSession(session$1.token)));
	return ctx.json({ status: true });
});

//#endregion
export { requestOnlySessionMiddleware as a, revokeSessions as c, listSessions as i, sensitiveSessionMiddleware as l, getSession as n, revokeOtherSessions as o, getSessionFromCtx as r, revokeSession as s, freshSessionMiddleware as t, sessionMiddleware as u };