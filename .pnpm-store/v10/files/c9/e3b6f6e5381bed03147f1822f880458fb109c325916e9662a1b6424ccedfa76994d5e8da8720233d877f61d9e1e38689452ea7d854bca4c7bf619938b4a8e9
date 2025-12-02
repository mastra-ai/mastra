import { t as APIError } from "./api-q2sbQ7PT.mjs";
import { c as setSessionCookie, l as parseSetCookieHeader, n as deleteSessionCookie, o as parseCookies } from "./cookies-D_dksn7B.mjs";
import { u as sessionMiddleware } from "./session-CgfX4vv1.mjs";
import { defineErrorCodes } from "@better-auth/core/utils";
import * as z from "zod";
import { createAuthEndpoint, createAuthMiddleware } from "@better-auth/core/api";

//#region src/plugins/multi-session/index.ts
const ERROR_CODES = defineErrorCodes({ INVALID_SESSION_TOKEN: "Invalid session token" });
const multiSession = (options) => {
	const opts = {
		maximumSessions: 5,
		...options
	};
	const isMultiSessionCookie = (key) => key.includes("_multi-");
	return {
		id: "multi-session",
		endpoints: {
			listDeviceSessions: createAuthEndpoint("/multi-session/list-device-sessions", {
				method: "GET",
				requireHeaders: true
			}, async (ctx) => {
				const cookieHeader = ctx.headers?.get("cookie");
				if (!cookieHeader) return ctx.json([]);
				const cookies = Object.fromEntries(parseCookies(cookieHeader));
				const sessionTokens = (await Promise.all(Object.entries(cookies).filter(([key]) => isMultiSessionCookie(key)).map(async ([key]) => await ctx.getSignedCookie(key, ctx.context.secret)))).filter((v) => v !== null);
				if (!sessionTokens.length) return ctx.json([]);
				const uniqueUserSessions = (await ctx.context.internalAdapter.findSessions(sessionTokens)).filter((session) => session && session.session.expiresAt > /* @__PURE__ */ new Date()).reduce((acc, session) => {
					if (!acc.find((s) => s.user.id === session.user.id)) acc.push(session);
					return acc;
				}, []);
				return ctx.json(uniqueUserSessions);
			}),
			setActiveSession: createAuthEndpoint("/multi-session/set-active", {
				method: "POST",
				body: z.object({ sessionToken: z.string().meta({ description: "The session token to set as active" }) }),
				requireHeaders: true,
				use: [sessionMiddleware],
				metadata: { openapi: {
					description: "Set the active session",
					responses: { 200: {
						description: "Success",
						content: { "application/json": { schema: {
							type: "object",
							properties: { session: { $ref: "#/components/schemas/Session" } }
						} } }
					} }
				} }
			}, async (ctx) => {
				const sessionToken = ctx.body.sessionToken;
				const multiSessionCookieName = `${ctx.context.authCookies.sessionToken.name}_multi-${sessionToken.toLowerCase()}`;
				if (!await ctx.getSignedCookie(multiSessionCookieName, ctx.context.secret)) throw new APIError("UNAUTHORIZED", { message: ERROR_CODES.INVALID_SESSION_TOKEN });
				const session = await ctx.context.internalAdapter.findSession(sessionToken);
				if (!session || session.session.expiresAt < /* @__PURE__ */ new Date()) {
					ctx.setCookie(multiSessionCookieName, "", {
						...ctx.context.authCookies.sessionToken.options,
						maxAge: 0
					});
					throw new APIError("UNAUTHORIZED", { message: ERROR_CODES.INVALID_SESSION_TOKEN });
				}
				await setSessionCookie(ctx, session);
				return ctx.json(session);
			}),
			revokeDeviceSession: createAuthEndpoint("/multi-session/revoke", {
				method: "POST",
				body: z.object({ sessionToken: z.string().meta({ description: "The session token to revoke" }) }),
				requireHeaders: true,
				use: [sessionMiddleware],
				metadata: { openapi: {
					description: "Revoke a device session",
					responses: { 200: {
						description: "Success",
						content: { "application/json": { schema: {
							type: "object",
							properties: { status: { type: "boolean" } }
						} } }
					} }
				} }
			}, async (ctx) => {
				const sessionToken = ctx.body.sessionToken;
				const multiSessionCookieName = `${ctx.context.authCookies.sessionToken.name}_multi-${sessionToken.toLowerCase()}`;
				if (!await ctx.getSignedCookie(multiSessionCookieName, ctx.context.secret)) throw new APIError("UNAUTHORIZED", { message: ERROR_CODES.INVALID_SESSION_TOKEN });
				await ctx.context.internalAdapter.deleteSession(sessionToken);
				ctx.setCookie(multiSessionCookieName, "", {
					...ctx.context.authCookies.sessionToken.options,
					maxAge: 0
				});
				if (!(ctx.context.session?.session.token === sessionToken)) return ctx.json({ status: true });
				const cookieHeader = ctx.headers?.get("cookie");
				if (cookieHeader) {
					const cookies = Object.fromEntries(parseCookies(cookieHeader));
					const sessionTokens = (await Promise.all(Object.entries(cookies).filter(([key]) => isMultiSessionCookie(key)).map(async ([key]) => await ctx.getSignedCookie(key, ctx.context.secret)))).filter((v) => v !== void 0);
					const internalAdapter = ctx.context.internalAdapter;
					if (sessionTokens.length > 0) {
						const validSessions = (await internalAdapter.findSessions(sessionTokens)).filter((session) => session && session.session.expiresAt > /* @__PURE__ */ new Date());
						if (validSessions.length > 0) {
							const nextSession = validSessions[0];
							await setSessionCookie(ctx, nextSession);
						} else deleteSessionCookie(ctx);
					} else deleteSessionCookie(ctx);
				} else deleteSessionCookie(ctx);
				return ctx.json({ status: true });
			})
		},
		hooks: { after: [{
			matcher: () => true,
			handler: createAuthMiddleware(async (ctx) => {
				const cookieString = ctx.context.responseHeaders?.get("set-cookie");
				if (!cookieString) return;
				const setCookies = parseSetCookieHeader(cookieString);
				const sessionCookieConfig = ctx.context.authCookies.sessionToken;
				const sessionToken = ctx.context.newSession?.session.token;
				if (!sessionToken) return;
				const cookies = parseCookies(ctx.headers?.get("cookie") || "");
				const cookieName = `${sessionCookieConfig.name}_multi-${sessionToken.toLowerCase()}`;
				if (setCookies.get(cookieName) || cookies.get(cookieName)) return;
				if (Object.keys(Object.fromEntries(cookies)).filter(isMultiSessionCookie).length + (cookieString.includes("session_token") ? 1 : 0) >= opts.maximumSessions) return;
				await ctx.setSignedCookie(cookieName, sessionToken, ctx.context.secret, sessionCookieConfig.options);
			})
		}, {
			matcher: (context) => context.path === "/sign-out",
			handler: createAuthMiddleware(async (ctx) => {
				const cookieHeader = ctx.headers?.get("cookie");
				if (!cookieHeader) return;
				const cookies = Object.fromEntries(parseCookies(cookieHeader));
				const multiSessionKeys = Object.keys(cookies).filter((key) => isMultiSessionCookie(key));
				const verifiedTokens = (await Promise.all(multiSessionKeys.map(async (key) => {
					const verifiedToken = await ctx.getSignedCookie(key, ctx.context.secret);
					if (verifiedToken) {
						ctx.setCookie(key.toLowerCase().replace("__secure-", "__Secure-"), "", {
							...ctx.context.authCookies.sessionToken.options,
							maxAge: 0
						});
						return verifiedToken;
					}
					return null;
				}))).filter((v) => v !== null);
				if (verifiedTokens.length > 0) await ctx.context.internalAdapter.deleteSessions(verifiedTokens);
			})
		}] },
		$ERROR_CODES: ERROR_CODES
	};
};

//#endregion
export { multiSession as t };