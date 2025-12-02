import { t as generateId } from "./utils-DBbaShi0.mjs";
import { t as mergeSchema } from "./schema-CSB7dlK0.mjs";
import { t as APIError } from "./api-q2sbQ7PT.mjs";
import { c as setSessionCookie, l as parseSetCookieHeader } from "./cookies-D_dksn7B.mjs";
import { r as getSessionFromCtx } from "./session-CgfX4vv1.mjs";
import { defineErrorCodes } from "@better-auth/core/utils";
import * as z from "zod";
import { createAuthEndpoint, createAuthMiddleware } from "@better-auth/core/api";

//#region src/plugins/anonymous/error-codes.ts
const ANONYMOUS_ERROR_CODES = defineErrorCodes({
	INVALID_EMAIL_FORMAT: "Email was not generated in a valid format",
	FAILED_TO_CREATE_USER: "Failed to create user",
	COULD_NOT_CREATE_SESSION: "Could not create session",
	ANONYMOUS_USERS_CANNOT_SIGN_IN_AGAIN_ANONYMOUSLY: "Anonymous users cannot sign in again anonymously"
});

//#endregion
//#region src/plugins/anonymous/schema.ts
const schema = { user: { fields: { isAnonymous: {
	type: "boolean",
	required: false,
	input: false,
	defaultValue: false
} } } };

//#endregion
//#region src/plugins/anonymous/index.ts
async function getAnonUserEmail(options) {
	const customEmail = await options?.generateRandomEmail?.();
	if (customEmail) {
		if (!z.email().safeParse(customEmail).success) throw new APIError("BAD_REQUEST", { message: ANONYMOUS_ERROR_CODES.INVALID_EMAIL_FORMAT });
		return customEmail;
	}
	const id = generateId();
	if (options?.emailDomainName) return `temp-${id}@${options.emailDomainName}`;
	return `temp@${id}.com`;
}
const anonymous = (options) => {
	return {
		id: "anonymous",
		endpoints: { signInAnonymous: createAuthEndpoint("/sign-in/anonymous", {
			method: "POST",
			metadata: { openapi: {
				description: "Sign in anonymously",
				responses: { 200: {
					description: "Sign in anonymously",
					content: { "application/json": { schema: {
						type: "object",
						properties: {
							user: { $ref: "#/components/schemas/User" },
							session: { $ref: "#/components/schemas/Session" }
						}
					} } }
				} }
			} }
		}, async (ctx) => {
			if ((await getSessionFromCtx(ctx, { disableRefresh: true }))?.user.isAnonymous) throw new APIError("BAD_REQUEST", { message: ANONYMOUS_ERROR_CODES.ANONYMOUS_USERS_CANNOT_SIGN_IN_AGAIN_ANONYMOUSLY });
			const email = await getAnonUserEmail(options);
			const name = await options?.generateName?.(ctx) || "Anonymous";
			const newUser = await ctx.context.internalAdapter.createUser({
				email,
				emailVerified: false,
				isAnonymous: true,
				name,
				createdAt: /* @__PURE__ */ new Date(),
				updatedAt: /* @__PURE__ */ new Date()
			});
			if (!newUser) throw ctx.error("INTERNAL_SERVER_ERROR", { message: ANONYMOUS_ERROR_CODES.FAILED_TO_CREATE_USER });
			const session = await ctx.context.internalAdapter.createSession(newUser.id);
			if (!session) return ctx.json(null, {
				status: 400,
				body: { message: ANONYMOUS_ERROR_CODES.COULD_NOT_CREATE_SESSION }
			});
			await setSessionCookie(ctx, {
				session,
				user: newUser
			});
			return ctx.json({
				token: session.token,
				user: {
					id: newUser.id,
					email: newUser.email,
					emailVerified: newUser.emailVerified,
					name: newUser.name,
					createdAt: newUser.createdAt,
					updatedAt: newUser.updatedAt
				}
			});
		}) },
		hooks: { after: [{
			matcher(ctx) {
				return ctx.path.startsWith("/sign-in") || ctx.path.startsWith("/sign-up") || ctx.path.startsWith("/callback") || ctx.path.startsWith("/oauth2/callback") || ctx.path.startsWith("/magic-link/verify") || ctx.path.startsWith("/email-otp/verify-email") || ctx.path.startsWith("/one-tap/callback") || ctx.path.startsWith("/passkey/verify-authentication") || ctx.path.startsWith("/phone-number/verify");
			},
			handler: createAuthMiddleware(async (ctx) => {
				const setCookie = ctx.context.responseHeaders?.get("set-cookie");
				/**
				* We can consider the user is about to sign in or sign up
				* if the response contains a session token.
				*/
				const sessionTokenName = ctx.context.authCookies.sessionToken.name;
				if (!parseSetCookieHeader(setCookie || "").get(sessionTokenName)?.value.split(".")[0]) return;
				/**
				* Make sure the user had an anonymous session.
				*/
				const session = await getSessionFromCtx(ctx, { disableRefresh: true });
				if (!session || !session.user.isAnonymous) return;
				if (ctx.path === "/sign-in/anonymous" && !ctx.context.newSession) throw new APIError("BAD_REQUEST", { message: ANONYMOUS_ERROR_CODES.ANONYMOUS_USERS_CANNOT_SIGN_IN_AGAIN_ANONYMOUSLY });
				const newSession = ctx.context.newSession;
				if (!newSession) return;
				if (options?.onLinkAccount) await options?.onLinkAccount?.({
					anonymousUser: session,
					newUser: newSession,
					ctx
				});
				if (!options?.disableDeleteAnonymousUser) await ctx.context.internalAdapter.deleteUser(session.user.id);
			})
		}] },
		schema: mergeSchema(schema, options?.schema),
		$ERROR_CODES: ANONYMOUS_ERROR_CODES
	};
};

//#endregion
export { anonymous as t };