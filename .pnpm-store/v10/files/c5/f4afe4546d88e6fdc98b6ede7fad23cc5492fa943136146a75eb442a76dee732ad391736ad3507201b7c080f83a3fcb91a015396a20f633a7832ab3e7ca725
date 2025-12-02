import { t as mergeSchema } from "./schema-CSB7dlK0.mjs";
import { C as createEmailVerificationToken } from "./api-q2sbQ7PT.mjs";
import { c as setSessionCookie } from "./cookies-D_dksn7B.mjs";
import { BASE_ERROR_CODES } from "@better-auth/core/error";
import { defineErrorCodes } from "@better-auth/core/utils";
import { APIError } from "better-call";
import * as z from "zod";
import { createAuthEndpoint, createAuthMiddleware } from "@better-auth/core/api";

//#region src/plugins/username/error-codes.ts
const USERNAME_ERROR_CODES = defineErrorCodes({
	INVALID_USERNAME_OR_PASSWORD: "Invalid username or password",
	EMAIL_NOT_VERIFIED: "Email not verified",
	UNEXPECTED_ERROR: "Unexpected error",
	USERNAME_IS_ALREADY_TAKEN: "Username is already taken. Please try another.",
	USERNAME_TOO_SHORT: "Username is too short",
	USERNAME_TOO_LONG: "Username is too long",
	INVALID_USERNAME: "Username is invalid",
	INVALID_DISPLAY_USERNAME: "Display username is invalid"
});

//#endregion
//#region src/plugins/username/schema.ts
const getSchema = (normalizer) => {
	return { user: { fields: {
		username: {
			type: "string",
			required: false,
			sortable: true,
			unique: true,
			returned: true,
			transform: { input(value) {
				return typeof value !== "string" ? value : normalizer.username(value);
			} }
		},
		displayUsername: {
			type: "string",
			required: false,
			transform: { input(value) {
				return typeof value !== "string" ? value : normalizer.displayUsername(value);
			} }
		}
	} } };
};

//#endregion
//#region src/plugins/username/index.ts
function defaultUsernameValidator(username$1) {
	return /^[a-zA-Z0-9_.]+$/.test(username$1);
}
const username = (options) => {
	const normalizer = (username$1) => {
		if (options?.usernameNormalization === false) return username$1;
		if (options?.usernameNormalization) return options.usernameNormalization(username$1);
		return username$1.toLowerCase();
	};
	const displayUsernameNormalizer = (displayUsername) => {
		return options?.displayUsernameNormalization ? options.displayUsernameNormalization(displayUsername) : displayUsername;
	};
	return {
		id: "username",
		init(ctx) {
			return { options: { databaseHooks: { user: {
				create: { async before(user, context) {
					const username$1 = "username" in user ? user.username : null;
					const displayUsername = "displayUsername" in user ? user.displayUsername : null;
					return { data: {
						...user,
						...username$1 ? { username: normalizer(username$1) } : {},
						...displayUsername ? { displayUsername: displayUsernameNormalizer(displayUsername) } : {}
					} };
				} },
				update: { async before(user, context) {
					const username$1 = "username" in user ? user.username : null;
					const displayUsername = "displayUsername" in user ? user.displayUsername : null;
					return { data: {
						...user,
						...username$1 ? { username: normalizer(username$1) } : {},
						...displayUsername ? { displayUsername: displayUsernameNormalizer(displayUsername) } : {}
					} };
				} }
			} } } };
		},
		endpoints: {
			signInUsername: createAuthEndpoint("/sign-in/username", {
				method: "POST",
				body: z.object({
					username: z.string().meta({ description: "The username of the user" }),
					password: z.string().meta({ description: "The password of the user" }),
					rememberMe: z.boolean().meta({ description: "Remember the user session" }).optional(),
					callbackURL: z.string().meta({ description: "The URL to redirect to after email verification" }).optional()
				}),
				metadata: { openapi: {
					summary: "Sign in with username",
					description: "Sign in with username",
					responses: {
						200: {
							description: "Success",
							content: { "application/json": { schema: {
								type: "object",
								properties: {
									token: {
										type: "string",
										description: "Session token for the authenticated session"
									},
									user: { $ref: "#/components/schemas/User" }
								},
								required: ["token", "user"]
							} } }
						},
						422: {
							description: "Unprocessable Entity. Validation error",
							content: { "application/json": { schema: {
								type: "object",
								properties: { message: { type: "string" } }
							} } }
						}
					}
				} }
			}, async (ctx) => {
				if (!ctx.body.username || !ctx.body.password) {
					ctx.context.logger.error("Username or password not found");
					throw new APIError("UNAUTHORIZED", { message: USERNAME_ERROR_CODES.INVALID_USERNAME_OR_PASSWORD });
				}
				const username$1 = options?.validationOrder?.username === "pre-normalization" ? normalizer(ctx.body.username) : ctx.body.username;
				const minUsernameLength = options?.minUsernameLength || 3;
				const maxUsernameLength = options?.maxUsernameLength || 30;
				if (username$1.length < minUsernameLength) {
					ctx.context.logger.error("Username too short", { username: username$1 });
					throw new APIError("UNPROCESSABLE_ENTITY", {
						code: "USERNAME_TOO_SHORT",
						message: USERNAME_ERROR_CODES.USERNAME_TOO_SHORT
					});
				}
				if (username$1.length > maxUsernameLength) {
					ctx.context.logger.error("Username too long", { username: username$1 });
					throw new APIError("UNPROCESSABLE_ENTITY", { message: USERNAME_ERROR_CODES.USERNAME_TOO_LONG });
				}
				if (!(options?.usernameValidator || defaultUsernameValidator)(username$1)) throw new APIError("UNPROCESSABLE_ENTITY", { message: USERNAME_ERROR_CODES.INVALID_USERNAME });
				const user = await ctx.context.adapter.findOne({
					model: "user",
					where: [{
						field: "username",
						value: normalizer(username$1)
					}]
				});
				if (!user) {
					await ctx.context.password.hash(ctx.body.password);
					ctx.context.logger.error("User not found", { username: username$1 });
					throw new APIError("UNAUTHORIZED", { message: USERNAME_ERROR_CODES.INVALID_USERNAME_OR_PASSWORD });
				}
				const account = await ctx.context.adapter.findOne({
					model: "account",
					where: [{
						field: "userId",
						value: user.id
					}, {
						field: "providerId",
						value: "credential"
					}]
				});
				if (!account) throw new APIError("UNAUTHORIZED", { message: USERNAME_ERROR_CODES.INVALID_USERNAME_OR_PASSWORD });
				const currentPassword = account?.password;
				if (!currentPassword) {
					ctx.context.logger.error("Password not found", { username: username$1 });
					throw new APIError("UNAUTHORIZED", { message: USERNAME_ERROR_CODES.INVALID_USERNAME_OR_PASSWORD });
				}
				if (!await ctx.context.password.verify({
					hash: currentPassword,
					password: ctx.body.password
				})) {
					ctx.context.logger.error("Invalid password");
					throw new APIError("UNAUTHORIZED", { message: USERNAME_ERROR_CODES.INVALID_USERNAME_OR_PASSWORD });
				}
				if (ctx.context.options?.emailAndPassword?.requireEmailVerification && !user.emailVerified) {
					if (!ctx.context.options?.emailVerification?.sendVerificationEmail) throw new APIError("FORBIDDEN", { message: USERNAME_ERROR_CODES.EMAIL_NOT_VERIFIED });
					if (ctx.context.options?.emailVerification?.sendOnSignIn) {
						const token = await createEmailVerificationToken(ctx.context.secret, user.email, void 0, ctx.context.options.emailVerification?.expiresIn);
						const url = `${ctx.context.baseURL}/verify-email?token=${token}&callbackURL=${ctx.body.callbackURL || "/"}`;
						await ctx.context.options.emailVerification.sendVerificationEmail({
							user,
							url,
							token
						}, ctx.request);
					}
					throw new APIError("FORBIDDEN", { message: USERNAME_ERROR_CODES.EMAIL_NOT_VERIFIED });
				}
				const session = await ctx.context.internalAdapter.createSession(user.id, ctx.body.rememberMe === false);
				if (!session) return ctx.json(null, {
					status: 500,
					body: { message: BASE_ERROR_CODES.FAILED_TO_CREATE_SESSION }
				});
				await setSessionCookie(ctx, {
					session,
					user
				}, ctx.body.rememberMe === false);
				return ctx.json({
					token: session.token,
					user: {
						id: user.id,
						email: user.email,
						emailVerified: user.emailVerified,
						username: user.username,
						displayUsername: user.displayUsername,
						name: user.name,
						image: user.image,
						createdAt: user.createdAt,
						updatedAt: user.updatedAt
					}
				});
			}),
			isUsernameAvailable: createAuthEndpoint("/is-username-available", {
				method: "POST",
				body: z.object({ username: z.string().meta({ description: "The username to check" }) })
			}, async (ctx) => {
				const username$1 = ctx.body.username;
				if (!username$1) throw new APIError("UNPROCESSABLE_ENTITY", { message: USERNAME_ERROR_CODES.INVALID_USERNAME });
				const minUsernameLength = options?.minUsernameLength || 3;
				const maxUsernameLength = options?.maxUsernameLength || 30;
				if (username$1.length < minUsernameLength) throw new APIError("UNPROCESSABLE_ENTITY", {
					code: "USERNAME_TOO_SHORT",
					message: USERNAME_ERROR_CODES.USERNAME_TOO_SHORT
				});
				if (username$1.length > maxUsernameLength) throw new APIError("UNPROCESSABLE_ENTITY", { message: USERNAME_ERROR_CODES.USERNAME_TOO_LONG });
				if (!await (options?.usernameValidator || defaultUsernameValidator)(username$1)) throw new APIError("UNPROCESSABLE_ENTITY", { message: USERNAME_ERROR_CODES.INVALID_USERNAME });
				if (await ctx.context.adapter.findOne({
					model: "user",
					where: [{
						field: "username",
						value: normalizer(username$1)
					}]
				})) return ctx.json({ available: false });
				return ctx.json({ available: true });
			})
		},
		schema: mergeSchema(getSchema({
			username: normalizer,
			displayUsername: displayUsernameNormalizer
		}), options?.schema),
		hooks: { before: [{
			matcher(context) {
				return context.path === "/sign-up/email" || context.path === "/update-user";
			},
			handler: createAuthMiddleware(async (ctx) => {
				const username$1 = typeof ctx.body.username === "string" && options?.validationOrder?.username === "post-normalization" ? normalizer(ctx.body.username) : ctx.body.username;
				if (username$1 !== void 0 && typeof username$1 === "string") {
					const minUsernameLength = options?.minUsernameLength || 3;
					const maxUsernameLength = options?.maxUsernameLength || 30;
					if (username$1.length < minUsernameLength) throw new APIError("BAD_REQUEST", {
						code: "USERNAME_TOO_SHORT",
						message: USERNAME_ERROR_CODES.USERNAME_TOO_SHORT
					});
					if (username$1.length > maxUsernameLength) throw new APIError("BAD_REQUEST", { message: USERNAME_ERROR_CODES.USERNAME_TOO_LONG });
					if (!await (options?.usernameValidator || defaultUsernameValidator)(username$1)) throw new APIError("BAD_REQUEST", { message: USERNAME_ERROR_CODES.INVALID_USERNAME });
					const user = await ctx.context.adapter.findOne({
						model: "user",
						where: [{
							field: "username",
							value: username$1
						}]
					});
					const blockChangeSignUp = ctx.path === "/sign-up/email" && user;
					const blockChangeUpdateUser = ctx.path === "/update-user" && user && ctx.context.session && user.id !== ctx.context.session.session.userId;
					if (blockChangeSignUp || blockChangeUpdateUser) throw new APIError("BAD_REQUEST", { message: USERNAME_ERROR_CODES.USERNAME_IS_ALREADY_TAKEN });
				}
				const displayUsername = typeof ctx.body.displayUsername === "string" && options?.validationOrder?.displayUsername === "post-normalization" ? displayUsernameNormalizer(ctx.body.displayUsername) : ctx.body.displayUsername;
				if (displayUsername !== void 0 && typeof displayUsername === "string") {
					if (options?.displayUsernameValidator) {
						if (!await options.displayUsernameValidator(displayUsername)) throw new APIError("BAD_REQUEST", { message: USERNAME_ERROR_CODES.INVALID_DISPLAY_USERNAME });
					}
				}
			})
		}, {
			matcher(context) {
				return context.path === "/sign-up/email" || context.path === "/update-user";
			},
			handler: createAuthMiddleware(async (ctx) => {
				if (ctx.body.username && !ctx.body.displayUsername) ctx.body.displayUsername = ctx.body.username;
				if (ctx.body.displayUsername && !ctx.body.username) ctx.body.username = ctx.body.displayUsername;
			})
		}] },
		$ERROR_CODES: USERNAME_ERROR_CODES
	};
};

//#endregion
export { USERNAME_ERROR_CODES as n, username as t };