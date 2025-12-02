import { n as symmetricEncrypt, o as constantTimeEqual, r as generateRandomString, t as symmetricDecrypt } from "./crypto-BQxYXGGX.mjs";
import { u as getDate } from "./schema-CSB7dlK0.mjs";
import { t as APIError } from "./api-q2sbQ7PT.mjs";
import { c as setSessionCookie, s as setCookieCache } from "./cookies-D_dksn7B.mjs";
import { r as getSessionFromCtx } from "./session-CgfX4vv1.mjs";
import { t as getEndpointResponse } from "./plugin-helper-CA_Vvnl9.mjs";
import { BASE_ERROR_CODES } from "@better-auth/core/error";
import { defineErrorCodes } from "@better-auth/core/utils";
import * as z from "zod";
import { createHash } from "@better-auth/utils/hash";
import { createAuthEndpoint, createAuthMiddleware } from "@better-auth/core/api";
import { base64Url } from "@better-auth/utils/base64";

//#region src/plugins/email-otp/utils.ts
const defaultKeyHasher = async (otp) => {
	const hash = await createHash("SHA-256").digest(new TextEncoder().encode(otp));
	return base64Url.encode(new Uint8Array(hash), { padding: false });
};
function splitAtLastColon(input) {
	const idx = input.lastIndexOf(":");
	if (idx === -1) return [input, ""];
	return [input.slice(0, idx), input.slice(idx + 1)];
}

//#endregion
//#region src/plugins/email-otp/index.ts
const types = [
	"email-verification",
	"sign-in",
	"forget-password"
];
const defaultOTPGenerator = (options) => generateRandomString(options.otpLength ?? 6, "0-9");
const ERROR_CODES = defineErrorCodes({
	OTP_EXPIRED: "OTP expired",
	INVALID_OTP: "Invalid OTP",
	TOO_MANY_ATTEMPTS: "Too many attempts"
});
const emailOTP = (options) => {
	const opts = {
		expiresIn: 300,
		generateOTP: () => defaultOTPGenerator(options),
		storeOTP: "plain",
		...options
	};
	async function storeOTP(ctx, otp) {
		if (opts.storeOTP === "encrypted") return await symmetricEncrypt({
			key: ctx.context.secret,
			data: otp
		});
		if (opts.storeOTP === "hashed") return await defaultKeyHasher(otp);
		if (typeof opts.storeOTP === "object" && "hash" in opts.storeOTP) return await opts.storeOTP.hash(otp);
		if (typeof opts.storeOTP === "object" && "encrypt" in opts.storeOTP) return await opts.storeOTP.encrypt(otp);
		return otp;
	}
	async function verifyStoredOTP(ctx, storedOtp, otp) {
		if (opts.storeOTP === "encrypted") return constantTimeEqual(await symmetricDecrypt({
			key: ctx.context.secret,
			data: storedOtp
		}), otp);
		if (opts.storeOTP === "hashed") return constantTimeEqual(await defaultKeyHasher(otp), storedOtp);
		if (typeof opts.storeOTP === "object" && "hash" in opts.storeOTP) return constantTimeEqual(await opts.storeOTP.hash(otp), storedOtp);
		if (typeof opts.storeOTP === "object" && "decrypt" in opts.storeOTP) return constantTimeEqual(await opts.storeOTP.decrypt(storedOtp), otp);
		return constantTimeEqual(otp, storedOtp);
	}
	const endpoints = { sendVerificationOTP: createAuthEndpoint("/email-otp/send-verification-otp", {
		method: "POST",
		body: z.object({
			email: z.string({}).meta({ description: "Email address to send the OTP" }),
			type: z.enum(types).meta({ description: "Type of the OTP" })
		}),
		metadata: { openapi: {
			operationId: "sendEmailVerificationOTP",
			description: "Send a verification OTP to an email",
			responses: { 200: {
				description: "Success",
				content: { "application/json": { schema: {
					type: "object",
					properties: { success: { type: "boolean" } }
				} } }
			} }
		} }
	}, async (ctx) => {
		if (!options?.sendVerificationOTP) {
			ctx.context.logger.error("send email verification is not implemented");
			throw new APIError("BAD_REQUEST", { message: "send email verification is not implemented" });
		}
		const email = ctx.body.email.toLowerCase();
		if (!z.email().safeParse(email).success) throw ctx.error("BAD_REQUEST", { message: BASE_ERROR_CODES.INVALID_EMAIL });
		let otp = opts.generateOTP({
			email,
			type: ctx.body.type
		}, ctx) || defaultOTPGenerator(opts);
		let storedOTP = await storeOTP(ctx, otp);
		await ctx.context.internalAdapter.createVerificationValue({
			value: `${storedOTP}:0`,
			identifier: `${ctx.body.type}-otp-${email}`,
			expiresAt: getDate(opts.expiresIn, "sec")
		}).catch(async (error) => {
			await ctx.context.internalAdapter.deleteVerificationByIdentifier(`${ctx.body.type}-otp-${email}`);
			await ctx.context.internalAdapter.createVerificationValue({
				value: `${storedOTP}:0`,
				identifier: `${ctx.body.type}-otp-${email}`,
				expiresAt: getDate(opts.expiresIn, "sec")
			});
		});
		if (!await ctx.context.internalAdapter.findUserByEmail(email)) if (ctx.body.type === "sign-in" && !opts.disableSignUp) {} else {
			await ctx.context.internalAdapter.deleteVerificationByIdentifier(`${ctx.body.type}-otp-${email}`);
			return ctx.json({ success: true });
		}
		await options.sendVerificationOTP({
			email,
			otp,
			type: ctx.body.type
		}, ctx);
		return ctx.json({ success: true });
	}) };
	return {
		id: "email-otp",
		init(ctx) {
			if (!opts.overrideDefaultEmailVerification) return;
			return { options: { emailVerification: { async sendVerificationEmail(data, request) {
				await endpoints.sendVerificationOTP({
					context: ctx,
					request,
					body: {
						email: data.user.email,
						type: "email-verification"
					},
					ctx
				});
			} } } };
		},
		endpoints: {
			...endpoints,
			createVerificationOTP: createAuthEndpoint("/email-otp/create-verification-otp", {
				method: "POST",
				body: z.object({
					email: z.string({}).meta({ description: "Email address to send the OTP" }),
					type: z.enum(types).meta({
						required: true,
						description: "Type of the OTP"
					})
				}),
				metadata: {
					SERVER_ONLY: true,
					openapi: {
						operationId: "createEmailVerificationOTP",
						description: "Create a verification OTP for an email",
						responses: { 200: {
							description: "Success",
							content: { "application/json": { schema: { type: "string" } } }
						} }
					}
				}
			}, async (ctx) => {
				const email = ctx.body.email.toLowerCase();
				const otp = opts.generateOTP({
					email,
					type: ctx.body.type
				}, ctx) || defaultOTPGenerator(opts);
				let storedOTP = await storeOTP(ctx, otp);
				await ctx.context.internalAdapter.createVerificationValue({
					value: `${storedOTP}:0`,
					identifier: `${ctx.body.type}-otp-${email}`,
					expiresAt: getDate(opts.expiresIn, "sec")
				});
				return otp;
			}),
			getVerificationOTP: createAuthEndpoint("/email-otp/get-verification-otp", {
				method: "GET",
				query: z.object({
					email: z.string({}).meta({ description: "Email address the OTP was sent to" }),
					type: z.enum(types).meta({
						required: true,
						description: "Type of the OTP"
					})
				}),
				metadata: {
					SERVER_ONLY: true,
					openapi: {
						operationId: "getEmailVerificationOTP",
						description: "Get a verification OTP for an email",
						responses: { "200": {
							description: "OTP retrieved successfully or not found/expired",
							content: { "application/json": { schema: {
								type: "object",
								properties: { otp: {
									type: "string",
									nullable: true,
									description: "The stored OTP, or null if not found or expired"
								} },
								required: ["otp"]
							} } }
						} }
					}
				}
			}, async (ctx) => {
				const email = ctx.query.email.toLowerCase();
				const verificationValue = await ctx.context.internalAdapter.findVerificationValue(`${ctx.query.type}-otp-${email}`);
				if (!verificationValue || verificationValue.expiresAt < /* @__PURE__ */ new Date()) return ctx.json({ otp: null });
				if (opts.storeOTP === "hashed" || typeof opts.storeOTP === "object" && "hash" in opts.storeOTP) throw new APIError("BAD_REQUEST", { message: "OTP is hashed, cannot return the plain text OTP" });
				let [storedOtp, _attempts] = splitAtLastColon(verificationValue.value);
				let otp = storedOtp;
				if (opts.storeOTP === "encrypted") otp = await symmetricDecrypt({
					key: ctx.context.secret,
					data: storedOtp
				});
				if (typeof opts.storeOTP === "object" && "decrypt" in opts.storeOTP) otp = await opts.storeOTP.decrypt(storedOtp);
				return ctx.json({ otp });
			}),
			checkVerificationOTP: createAuthEndpoint("/email-otp/check-verification-otp", {
				method: "POST",
				body: z.object({
					email: z.string().meta({ description: "Email address the OTP was sent to" }),
					type: z.enum(types).meta({
						required: true,
						description: "Type of the OTP"
					}),
					otp: z.string().meta({
						required: true,
						description: "OTP to verify"
					})
				}),
				metadata: { openapi: {
					operationId: "verifyEmailWithOTP",
					description: "Verify an email with an OTP",
					responses: { 200: {
						description: "Success",
						content: { "application/json": { schema: {
							type: "object",
							properties: { success: { type: "boolean" } }
						} } }
					} }
				} }
			}, async (ctx) => {
				const email = ctx.body.email.toLowerCase();
				if (!z.email().safeParse(email).success) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.INVALID_EMAIL });
				if (!await ctx.context.internalAdapter.findUserByEmail(email)) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.USER_NOT_FOUND });
				const verificationValue = await ctx.context.internalAdapter.findVerificationValue(`${ctx.body.type}-otp-${email}`);
				if (!verificationValue) throw new APIError("BAD_REQUEST", { message: ERROR_CODES.INVALID_OTP });
				if (verificationValue.expiresAt < /* @__PURE__ */ new Date()) {
					await ctx.context.internalAdapter.deleteVerificationValue(verificationValue.id);
					throw new APIError("BAD_REQUEST", { message: ERROR_CODES.OTP_EXPIRED });
				}
				const [otpValue, attempts] = splitAtLastColon(verificationValue.value);
				const allowedAttempts = options?.allowedAttempts || 3;
				if (attempts && parseInt(attempts) >= allowedAttempts) {
					await ctx.context.internalAdapter.deleteVerificationValue(verificationValue.id);
					throw new APIError("FORBIDDEN", { message: ERROR_CODES.TOO_MANY_ATTEMPTS });
				}
				if (!await verifyStoredOTP(ctx, otpValue, ctx.body.otp)) {
					await ctx.context.internalAdapter.updateVerificationValue(verificationValue.id, { value: `${otpValue}:${parseInt(attempts || "0") + 1}` });
					throw new APIError("BAD_REQUEST", { message: ERROR_CODES.INVALID_OTP });
				}
				return ctx.json({ success: true });
			}),
			verifyEmailOTP: createAuthEndpoint("/email-otp/verify-email", {
				method: "POST",
				body: z.object({
					email: z.string({}).meta({ description: "Email address to verify" }),
					otp: z.string().meta({
						required: true,
						description: "OTP to verify"
					})
				}),
				metadata: { openapi: {
					description: "Verify email with OTP",
					responses: { 200: {
						description: "Success",
						content: { "application/json": { schema: {
							type: "object",
							properties: {
								status: {
									type: "boolean",
									description: "Indicates if the verification was successful",
									enum: [true]
								},
								token: {
									type: "string",
									nullable: true,
									description: "Session token if autoSignInAfterVerification is enabled, otherwise null"
								},
								user: { $ref: "#/components/schemas/User" }
							},
							required: [
								"status",
								"token",
								"user"
							]
						} } }
					} }
				} }
			}, async (ctx) => {
				const email = ctx.body.email.toLowerCase();
				if (!z.email().safeParse(email).success) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.INVALID_EMAIL });
				const verificationValue = await ctx.context.internalAdapter.findVerificationValue(`email-verification-otp-${email}`);
				if (!verificationValue) throw new APIError("BAD_REQUEST", { message: ERROR_CODES.INVALID_OTP });
				if (verificationValue.expiresAt < /* @__PURE__ */ new Date()) throw new APIError("BAD_REQUEST", { message: ERROR_CODES.OTP_EXPIRED });
				const [otpValue, attempts] = splitAtLastColon(verificationValue.value);
				const allowedAttempts = options?.allowedAttempts || 3;
				if (attempts && parseInt(attempts) >= allowedAttempts) {
					await ctx.context.internalAdapter.deleteVerificationValue(verificationValue.id);
					throw new APIError("FORBIDDEN", { message: ERROR_CODES.TOO_MANY_ATTEMPTS });
				}
				if (!await verifyStoredOTP(ctx, otpValue, ctx.body.otp)) {
					await ctx.context.internalAdapter.updateVerificationValue(verificationValue.id, { value: `${otpValue}:${parseInt(attempts || "0") + 1}` });
					throw new APIError("BAD_REQUEST", { message: ERROR_CODES.INVALID_OTP });
				}
				await ctx.context.internalAdapter.deleteVerificationValue(verificationValue.id);
				const user = await ctx.context.internalAdapter.findUserByEmail(email);
				if (!user)
 /**
				* safe to leak the existence of a user, given the user has already the OTP from the
				* email
				*/
				throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.USER_NOT_FOUND });
				const updatedUser = await ctx.context.internalAdapter.updateUser(user.user.id, {
					email,
					emailVerified: true
				});
				await ctx.context.options.emailVerification?.onEmailVerification?.(updatedUser, ctx.request);
				if (ctx.context.options.emailVerification?.autoSignInAfterVerification) {
					const session = await ctx.context.internalAdapter.createSession(updatedUser.id);
					await setSessionCookie(ctx, {
						session,
						user: updatedUser
					});
					return ctx.json({
						status: true,
						token: session.token,
						user: {
							id: updatedUser.id,
							email: updatedUser.email,
							emailVerified: updatedUser.emailVerified,
							name: updatedUser.name,
							image: updatedUser.image,
							createdAt: updatedUser.createdAt,
							updatedAt: updatedUser.updatedAt
						}
					});
				}
				const currentSession = await getSessionFromCtx(ctx);
				if (currentSession && updatedUser.emailVerified) {
					const dontRememberMeCookie = await ctx.getSignedCookie(ctx.context.authCookies.dontRememberToken.name, ctx.context.secret);
					await setCookieCache(ctx, {
						session: currentSession.session,
						user: {
							...currentSession.user,
							emailVerified: true
						}
					}, !!dontRememberMeCookie);
				}
				return ctx.json({
					status: true,
					token: null,
					user: {
						id: updatedUser.id,
						email: updatedUser.email,
						emailVerified: updatedUser.emailVerified,
						name: updatedUser.name,
						image: updatedUser.image,
						createdAt: updatedUser.createdAt,
						updatedAt: updatedUser.updatedAt
					}
				});
			}),
			signInEmailOTP: createAuthEndpoint("/sign-in/email-otp", {
				method: "POST",
				body: z.object({
					email: z.string({}).meta({ description: "Email address to sign in" }),
					otp: z.string().meta({
						required: true,
						description: "OTP sent to the email"
					})
				}),
				metadata: { openapi: {
					operationId: "signInWithEmailOTP",
					description: "Sign in with email and OTP",
					responses: { 200: {
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
					} }
				} }
			}, async (ctx) => {
				const email = ctx.body.email.toLowerCase();
				const verificationValue = await ctx.context.internalAdapter.findVerificationValue(`sign-in-otp-${email}`);
				if (!verificationValue) throw new APIError("BAD_REQUEST", { message: ERROR_CODES.INVALID_OTP });
				if (verificationValue.expiresAt < /* @__PURE__ */ new Date()) throw new APIError("BAD_REQUEST", { message: ERROR_CODES.OTP_EXPIRED });
				const [otpValue, attempts] = splitAtLastColon(verificationValue.value);
				const allowedAttempts = options?.allowedAttempts || 3;
				if (attempts && parseInt(attempts) >= allowedAttempts) {
					await ctx.context.internalAdapter.deleteVerificationValue(verificationValue.id);
					throw new APIError("FORBIDDEN", { message: ERROR_CODES.TOO_MANY_ATTEMPTS });
				}
				if (!await verifyStoredOTP(ctx, otpValue, ctx.body.otp)) {
					await ctx.context.internalAdapter.updateVerificationValue(verificationValue.id, { value: `${otpValue}:${parseInt(attempts || "0") + 1}` });
					throw new APIError("BAD_REQUEST", { message: ERROR_CODES.INVALID_OTP });
				}
				await ctx.context.internalAdapter.deleteVerificationValue(verificationValue.id);
				const user = await ctx.context.internalAdapter.findUserByEmail(email);
				if (!user) {
					if (opts.disableSignUp) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.USER_NOT_FOUND });
					const newUser = await ctx.context.internalAdapter.createUser({
						email,
						emailVerified: true,
						name: ""
					});
					const session$1 = await ctx.context.internalAdapter.createSession(newUser.id);
					await setSessionCookie(ctx, {
						session: session$1,
						user: newUser
					});
					return ctx.json({
						token: session$1.token,
						user: {
							id: newUser.id,
							email: newUser.email,
							emailVerified: newUser.emailVerified,
							name: newUser.name,
							image: newUser.image,
							createdAt: newUser.createdAt,
							updatedAt: newUser.updatedAt
						}
					});
				}
				if (!user.user.emailVerified) await ctx.context.internalAdapter.updateUser(user.user.id, { emailVerified: true });
				const session = await ctx.context.internalAdapter.createSession(user.user.id);
				await setSessionCookie(ctx, {
					session,
					user: user.user
				});
				return ctx.json({
					token: session.token,
					user: {
						id: user.user.id,
						email: user.user.email,
						emailVerified: user.user.emailVerified,
						name: user.user.name,
						image: user.user.image,
						createdAt: user.user.createdAt,
						updatedAt: user.user.updatedAt
					}
				});
			}),
			forgetPasswordEmailOTP: createAuthEndpoint("/forget-password/email-otp", {
				method: "POST",
				body: z.object({ email: z.string().meta({ description: "Email address to send the OTP" }) }),
				metadata: { openapi: {
					operationId: "forgetPasswordWithEmailOTP",
					description: "Forget password with email and OTP",
					responses: { 200: {
						description: "Success",
						content: { "application/json": { schema: {
							type: "object",
							properties: { success: {
								type: "boolean",
								description: "Indicates if the OTP was sent successfully"
							} }
						} } }
					} }
				} }
			}, async (ctx) => {
				const email = ctx.body.email;
				const otp = opts.generateOTP({
					email,
					type: "forget-password"
				}, ctx) || defaultOTPGenerator(opts);
				let storedOTP = await storeOTP(ctx, otp);
				await ctx.context.internalAdapter.createVerificationValue({
					value: `${storedOTP}:0`,
					identifier: `forget-password-otp-${email}`,
					expiresAt: getDate(opts.expiresIn, "sec")
				});
				if (!await ctx.context.internalAdapter.findUserByEmail(email)) {
					await ctx.context.internalAdapter.deleteVerificationByIdentifier(`forget-password-otp-${email}`);
					return ctx.json({ success: true });
				}
				await options.sendVerificationOTP({
					email,
					otp,
					type: "forget-password"
				}, ctx).catch((e) => {
					ctx.context.logger.error("Failed to send OTP", e);
				});
				return ctx.json({ success: true });
			}),
			resetPasswordEmailOTP: createAuthEndpoint("/email-otp/reset-password", {
				method: "POST",
				body: z.object({
					email: z.string().meta({ description: "Email address to reset the password" }),
					otp: z.string().meta({ description: "OTP sent to the email" }),
					password: z.string().meta({ description: "New password" })
				}),
				metadata: { openapi: {
					operationId: "resetPasswordWithEmailOTP",
					description: "Reset password with email and OTP",
					responses: { 200: {
						description: "Success",
						contnt: { "application/json": { schema: {
							type: "object",
							properties: { success: { type: "boolean" } }
						} } }
					} }
				} }
			}, async (ctx) => {
				const email = ctx.body.email;
				const verificationValue = await ctx.context.internalAdapter.findVerificationValue(`forget-password-otp-${email}`);
				if (!verificationValue) throw new APIError("BAD_REQUEST", { message: ERROR_CODES.INVALID_OTP });
				if (verificationValue.expiresAt < /* @__PURE__ */ new Date()) {
					await ctx.context.internalAdapter.deleteVerificationValue(verificationValue.id);
					throw new APIError("BAD_REQUEST", { message: ERROR_CODES.OTP_EXPIRED });
				}
				const [otpValue, attempts] = splitAtLastColon(verificationValue.value);
				const allowedAttempts = options?.allowedAttempts || 3;
				if (attempts && parseInt(attempts) >= allowedAttempts) {
					await ctx.context.internalAdapter.deleteVerificationValue(verificationValue.id);
					throw new APIError("FORBIDDEN", { message: ERROR_CODES.TOO_MANY_ATTEMPTS });
				}
				if (!await verifyStoredOTP(ctx, otpValue, ctx.body.otp)) {
					await ctx.context.internalAdapter.updateVerificationValue(verificationValue.id, { value: `${otpValue}:${parseInt(attempts || "0") + 1}` });
					throw new APIError("BAD_REQUEST", { message: ERROR_CODES.INVALID_OTP });
				}
				await ctx.context.internalAdapter.deleteVerificationValue(verificationValue.id);
				const user = await ctx.context.internalAdapter.findUserByEmail(email, { includeAccounts: true });
				if (!user) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.USER_NOT_FOUND });
				const minPasswordLength = ctx.context.password.config.minPasswordLength;
				if (ctx.body.password.length < minPasswordLength) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.PASSWORD_TOO_SHORT });
				const maxPasswordLength = ctx.context.password.config.maxPasswordLength;
				if (ctx.body.password.length > maxPasswordLength) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.PASSWORD_TOO_LONG });
				const passwordHash = await ctx.context.password.hash(ctx.body.password);
				if (!user.accounts?.find((account) => account.providerId === "credential")) await ctx.context.internalAdapter.createAccount({
					userId: user.user.id,
					providerId: "credential",
					accountId: user.user.id,
					password: passwordHash
				});
				else await ctx.context.internalAdapter.updatePassword(user.user.id, passwordHash);
				if (ctx.context.options.emailAndPassword?.onPasswordReset) await ctx.context.options.emailAndPassword.onPasswordReset({ user: user.user }, ctx.request);
				if (!user.user.emailVerified) await ctx.context.internalAdapter.updateUser(user.user.id, { emailVerified: true });
				if (ctx.context.options.emailAndPassword?.revokeSessionsOnPasswordReset) await ctx.context.internalAdapter.deleteSessions(user.user.id);
				return ctx.json({ success: true });
			})
		},
		hooks: { after: [{
			matcher(context) {
				return !!(context.path?.startsWith("/sign-up") && opts.sendVerificationOnSignUp && !opts.overrideDefaultEmailVerification);
			},
			handler: createAuthMiddleware(async (ctx) => {
				const email = (await getEndpointResponse(ctx))?.user.email;
				if (email) {
					const otp = opts.generateOTP({
						email,
						type: ctx.body.type
					}, ctx) || defaultOTPGenerator(opts);
					let storedOTP = await storeOTP(ctx, otp);
					await ctx.context.internalAdapter.createVerificationValue({
						value: `${storedOTP}:0`,
						identifier: `email-verification-otp-${email}`,
						expiresAt: getDate(opts.expiresIn, "sec")
					});
					await options.sendVerificationOTP({
						email,
						otp,
						type: "email-verification"
					}, ctx);
				}
			})
		}] },
		$ERROR_CODES: ERROR_CODES,
		rateLimit: [
			{
				pathMatcher(path) {
					return path === "/email-otp/send-verification-otp";
				},
				window: 60,
				max: 3
			},
			{
				pathMatcher(path) {
					return path === "/email-otp/check-verification-otp";
				},
				window: 60,
				max: 3
			},
			{
				pathMatcher(path) {
					return path === "/email-otp/verify-email";
				},
				window: 60,
				max: 3
			},
			{
				pathMatcher(path) {
					return path === "/sign-in/email-otp";
				},
				window: 60,
				max: 3
			}
		]
	};
};

//#endregion
export { emailOTP as t };