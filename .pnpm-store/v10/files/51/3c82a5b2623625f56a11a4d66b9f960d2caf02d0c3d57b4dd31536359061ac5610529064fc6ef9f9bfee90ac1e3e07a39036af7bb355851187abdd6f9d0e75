import { r as generateRandomString } from "./crypto-BQxYXGGX.mjs";
import { t as mergeSchema, u as getDate } from "./schema-CSB7dlK0.mjs";
import { c as setSessionCookie } from "./cookies-D_dksn7B.mjs";
import { r as getSessionFromCtx } from "./session-CgfX4vv1.mjs";
import { BASE_ERROR_CODES } from "@better-auth/core/error";
import { defineErrorCodes } from "@better-auth/core/utils";
import { APIError } from "better-call";
import * as z from "zod";
import { createAuthEndpoint, createAuthMiddleware } from "@better-auth/core/api";

//#region src/plugins/phone-number/error-codes.ts
const PHONE_NUMBER_ERROR_CODES = defineErrorCodes({
	INVALID_PHONE_NUMBER: "Invalid phone number",
	PHONE_NUMBER_EXIST: "Phone number already exists",
	PHONE_NUMBER_NOT_EXIST: "phone number isn't registered",
	INVALID_PHONE_NUMBER_OR_PASSWORD: "Invalid phone number or password",
	UNEXPECTED_ERROR: "Unexpected error",
	OTP_NOT_FOUND: "OTP not found",
	OTP_EXPIRED: "OTP expired",
	INVALID_OTP: "Invalid OTP",
	PHONE_NUMBER_NOT_VERIFIED: "Phone number not verified",
	PHONE_NUMBER_CANNOT_BE_UPDATED: "Phone number cannot be updated",
	SEND_OTP_NOT_IMPLEMENTED: "sendOTP not implemented",
	TOO_MANY_ATTEMPTS: "Too many attempts"
});

//#endregion
//#region src/plugins/phone-number/schema.ts
const schema = { user: { fields: {
	phoneNumber: {
		type: "string",
		required: false,
		unique: true,
		sortable: true,
		returned: true
	},
	phoneNumberVerified: {
		type: "boolean",
		required: false,
		returned: true,
		input: false
	}
} } };

//#endregion
//#region src/plugins/phone-number/index.ts
function generateOTP(size) {
	return generateRandomString(size, "0-9");
}
const phoneNumber = (options) => {
	const opts = {
		expiresIn: options?.expiresIn || 300,
		otpLength: options?.otpLength || 6,
		...options,
		phoneNumber: "phoneNumber",
		phoneNumberVerified: "phoneNumberVerified",
		code: "code",
		createdAt: "createdAt"
	};
	return {
		id: "phone-number",
		hooks: { before: [{
			matcher: (ctx) => ctx.path === "/update-user" && "phoneNumber" in ctx.body,
			handler: createAuthMiddleware(async (_ctx) => {
				throw new APIError("BAD_REQUEST", { message: PHONE_NUMBER_ERROR_CODES.PHONE_NUMBER_CANNOT_BE_UPDATED });
			})
		}] },
		endpoints: {
			signInPhoneNumber: createAuthEndpoint("/sign-in/phone-number", {
				method: "POST",
				body: z.object({
					phoneNumber: z.string().meta({ description: "Phone number to sign in. Eg: \"+1234567890\"" }),
					password: z.string().meta({ description: "Password to use for sign in." }),
					rememberMe: z.boolean().meta({ description: "Remember the session. Eg: true" }).optional()
				}),
				metadata: { openapi: {
					summary: "Sign in with phone number",
					description: "Use this endpoint to sign in with phone number",
					responses: {
						200: {
							description: "Success",
							content: { "application/json": { schema: {
								type: "object",
								properties: {
									user: { $ref: "#/components/schemas/User" },
									session: { $ref: "#/components/schemas/Session" }
								}
							} } }
						},
						400: { description: "Invalid phone number or password" }
					}
				} }
			}, async (ctx) => {
				const { password, phoneNumber: phoneNumber$1 } = ctx.body;
				if (opts.phoneNumberValidator) {
					if (!await opts.phoneNumberValidator(ctx.body.phoneNumber)) throw new APIError("BAD_REQUEST", { message: PHONE_NUMBER_ERROR_CODES.INVALID_PHONE_NUMBER });
				}
				const user = await ctx.context.adapter.findOne({
					model: "user",
					where: [{
						field: "phoneNumber",
						value: phoneNumber$1
					}]
				});
				if (!user) throw new APIError("UNAUTHORIZED", { message: PHONE_NUMBER_ERROR_CODES.INVALID_PHONE_NUMBER_OR_PASSWORD });
				if (opts.requireVerification) {
					if (!user.phoneNumberVerified) {
						const otp = generateOTP(opts.otpLength);
						await ctx.context.internalAdapter.createVerificationValue({
							value: otp,
							identifier: phoneNumber$1,
							expiresAt: getDate(opts.expiresIn, "sec")
						});
						await opts.sendOTP?.({
							phoneNumber: phoneNumber$1,
							code: otp
						}, ctx);
						throw new APIError("UNAUTHORIZED", { message: PHONE_NUMBER_ERROR_CODES.PHONE_NUMBER_NOT_VERIFIED });
					}
				}
				const credentialAccount = (await ctx.context.internalAdapter.findAccountByUserId(user.id)).find((a) => a.providerId === "credential");
				if (!credentialAccount) {
					ctx.context.logger.error("Credential account not found", { phoneNumber: phoneNumber$1 });
					throw new APIError("UNAUTHORIZED", { message: PHONE_NUMBER_ERROR_CODES.INVALID_PHONE_NUMBER_OR_PASSWORD });
				}
				const currentPassword = credentialAccount?.password;
				if (!currentPassword) {
					ctx.context.logger.error("Password not found", { phoneNumber: phoneNumber$1 });
					throw new APIError("UNAUTHORIZED", { message: PHONE_NUMBER_ERROR_CODES.UNEXPECTED_ERROR });
				}
				if (!await ctx.context.password.verify({
					hash: currentPassword,
					password
				})) {
					ctx.context.logger.error("Invalid password");
					throw new APIError("UNAUTHORIZED", { message: PHONE_NUMBER_ERROR_CODES.INVALID_PHONE_NUMBER_OR_PASSWORD });
				}
				const session = await ctx.context.internalAdapter.createSession(user.id, ctx.body.rememberMe === false);
				if (!session) {
					ctx.context.logger.error("Failed to create session");
					throw new APIError("UNAUTHORIZED", { message: BASE_ERROR_CODES.FAILED_TO_CREATE_SESSION });
				}
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
						name: user.name,
						image: user.image,
						phoneNumber: user.phoneNumber,
						phoneNumberVerified: user.phoneNumberVerified,
						createdAt: user.createdAt,
						updatedAt: user.updatedAt
					}
				});
			}),
			sendPhoneNumberOTP: createAuthEndpoint("/phone-number/send-otp", {
				method: "POST",
				body: z.object({ phoneNumber: z.string().meta({ description: "Phone number to send OTP. Eg: \"+1234567890\"" }) }),
				metadata: { openapi: {
					summary: "Send OTP to phone number",
					description: "Use this endpoint to send OTP to phone number",
					responses: { 200: {
						description: "Success",
						content: { "application/json": { schema: {
							type: "object",
							properties: { message: { type: "string" } }
						} } }
					} }
				} }
			}, async (ctx) => {
				if (!options?.sendOTP) {
					ctx.context.logger.warn("sendOTP not implemented");
					throw new APIError("NOT_IMPLEMENTED", { message: PHONE_NUMBER_ERROR_CODES.SEND_OTP_NOT_IMPLEMENTED });
				}
				if (opts.phoneNumberValidator) {
					if (!await opts.phoneNumberValidator(ctx.body.phoneNumber)) throw new APIError("BAD_REQUEST", { message: PHONE_NUMBER_ERROR_CODES.INVALID_PHONE_NUMBER });
				}
				const code = generateOTP(opts.otpLength);
				await ctx.context.internalAdapter.createVerificationValue({
					value: `${code}:0`,
					identifier: ctx.body.phoneNumber,
					expiresAt: getDate(opts.expiresIn, "sec")
				});
				await options.sendOTP({
					phoneNumber: ctx.body.phoneNumber,
					code
				}, ctx);
				return ctx.json({ message: "code sent" });
			}),
			verifyPhoneNumber: createAuthEndpoint("/phone-number/verify", {
				method: "POST",
				body: z.object({
					phoneNumber: z.string().meta({ description: "Phone number to verify. Eg: \"+1234567890\"" }),
					code: z.string().meta({ description: "OTP code. Eg: \"123456\"" }),
					disableSession: z.boolean().meta({ description: "Disable session creation after verification. Eg: false" }).optional(),
					updatePhoneNumber: z.boolean().meta({ description: "Check if there is a session and update the phone number. Eg: true" }).optional()
				}),
				metadata: { openapi: {
					summary: "Verify phone number",
					description: "Use this endpoint to verify phone number",
					responses: {
						"200": {
							description: "Phone number verified successfully",
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
										description: "Session token if session is created, null if disableSession is true or no session is created"
									},
									user: {
										type: "object",
										nullable: true,
										properties: {
											id: {
												type: "string",
												description: "Unique identifier of the user"
											},
											email: {
												type: "string",
												format: "email",
												nullable: true,
												description: "User's email address"
											},
											emailVerified: {
												type: "boolean",
												nullable: true,
												description: "Whether the email is verified"
											},
											name: {
												type: "string",
												nullable: true,
												description: "User's name"
											},
											image: {
												type: "string",
												format: "uri",
												nullable: true,
												description: "User's profile image URL"
											},
											phoneNumber: {
												type: "string",
												description: "User's phone number"
											},
											phoneNumberVerified: {
												type: "boolean",
												description: "Whether the phone number is verified"
											},
											createdAt: {
												type: "string",
												format: "date-time",
												description: "Timestamp when the user was created"
											},
											updatedAt: {
												type: "string",
												format: "date-time",
												description: "Timestamp when the user was last updated"
											}
										},
										required: [
											"id",
											"phoneNumber",
											"phoneNumberVerified",
											"createdAt",
											"updatedAt"
										],
										description: "User object with phone number details, null if no user is created or found"
									}
								},
								required: ["status"]
							} } }
						},
						400: { description: "Invalid OTP" }
					}
				} }
			}, async (ctx) => {
				if (options?.verifyOTP) {
					if (!await options.verifyOTP({
						phoneNumber: ctx.body.phoneNumber,
						code: ctx.body.code
					}, ctx)) throw new APIError("BAD_REQUEST", { message: PHONE_NUMBER_ERROR_CODES.INVALID_OTP });
					const otp = await ctx.context.internalAdapter.findVerificationValue(ctx.body.phoneNumber);
					if (otp) await ctx.context.internalAdapter.deleteVerificationValue(otp.id);
				} else {
					const otp = await ctx.context.internalAdapter.findVerificationValue(ctx.body.phoneNumber);
					if (!otp || otp.expiresAt < /* @__PURE__ */ new Date()) {
						if (otp && otp.expiresAt < /* @__PURE__ */ new Date()) throw new APIError("BAD_REQUEST", { message: PHONE_NUMBER_ERROR_CODES.OTP_EXPIRED });
						throw new APIError("BAD_REQUEST", { message: PHONE_NUMBER_ERROR_CODES.OTP_NOT_FOUND });
					}
					const [otpValue, attempts] = otp.value.split(":");
					const allowedAttempts = options?.allowedAttempts || 3;
					if (attempts && parseInt(attempts) >= allowedAttempts) {
						await ctx.context.internalAdapter.deleteVerificationValue(otp.id);
						throw new APIError("FORBIDDEN", { message: PHONE_NUMBER_ERROR_CODES.TOO_MANY_ATTEMPTS });
					}
					if (otpValue !== ctx.body.code) {
						await ctx.context.internalAdapter.updateVerificationValue(otp.id, { value: `${otpValue}:${parseInt(attempts || "0") + 1}` });
						throw new APIError("BAD_REQUEST", { message: PHONE_NUMBER_ERROR_CODES.INVALID_OTP });
					}
					await ctx.context.internalAdapter.deleteVerificationValue(otp.id);
				}
				if (ctx.body.updatePhoneNumber) {
					const session = await getSessionFromCtx(ctx);
					if (!session) throw new APIError("UNAUTHORIZED", { message: BASE_ERROR_CODES.USER_NOT_FOUND });
					if ((await ctx.context.adapter.findMany({
						model: "user",
						where: [{
							field: "phoneNumber",
							value: ctx.body.phoneNumber
						}]
					})).length) throw ctx.error("BAD_REQUEST", { message: PHONE_NUMBER_ERROR_CODES.PHONE_NUMBER_EXIST });
					let user$1 = await ctx.context.internalAdapter.updateUser(session.user.id, {
						[opts.phoneNumber]: ctx.body.phoneNumber,
						[opts.phoneNumberVerified]: true
					});
					return ctx.json({
						status: true,
						token: session.session.token,
						user: {
							id: user$1.id,
							email: user$1.email,
							emailVerified: user$1.emailVerified,
							name: user$1.name,
							image: user$1.image,
							phoneNumber: user$1.phoneNumber,
							phoneNumberVerified: user$1.phoneNumberVerified,
							createdAt: user$1.createdAt,
							updatedAt: user$1.updatedAt
						}
					});
				}
				let user = await ctx.context.adapter.findOne({
					model: "user",
					where: [{
						value: ctx.body.phoneNumber,
						field: opts.phoneNumber
					}]
				});
				if (!user) {
					if (options?.signUpOnVerification) {
						user = await ctx.context.internalAdapter.createUser({
							email: options.signUpOnVerification.getTempEmail(ctx.body.phoneNumber),
							name: options.signUpOnVerification.getTempName ? options.signUpOnVerification.getTempName(ctx.body.phoneNumber) : ctx.body.phoneNumber,
							[opts.phoneNumber]: ctx.body.phoneNumber,
							[opts.phoneNumberVerified]: true
						});
						if (!user) throw new APIError("INTERNAL_SERVER_ERROR", { message: BASE_ERROR_CODES.FAILED_TO_CREATE_USER });
					}
				} else user = await ctx.context.internalAdapter.updateUser(user.id, { [opts.phoneNumberVerified]: true });
				if (!user) throw new APIError("INTERNAL_SERVER_ERROR", { message: BASE_ERROR_CODES.FAILED_TO_UPDATE_USER });
				await options?.callbackOnVerification?.({
					phoneNumber: ctx.body.phoneNumber,
					user
				}, ctx);
				if (!ctx.body.disableSession) {
					const session = await ctx.context.internalAdapter.createSession(user.id);
					if (!session) throw new APIError("INTERNAL_SERVER_ERROR", { message: BASE_ERROR_CODES.FAILED_TO_CREATE_SESSION });
					await setSessionCookie(ctx, {
						session,
						user
					});
					return ctx.json({
						status: true,
						token: session.token,
						user: {
							id: user.id,
							email: user.email,
							emailVerified: user.emailVerified,
							name: user.name,
							image: user.image,
							phoneNumber: user.phoneNumber,
							phoneNumberVerified: user.phoneNumberVerified,
							createdAt: user.createdAt,
							updatedAt: user.updatedAt
						}
					});
				}
				return ctx.json({
					status: true,
					token: null,
					user: {
						id: user.id,
						email: user.email,
						emailVerified: user.emailVerified,
						name: user.name,
						image: user.image,
						phoneNumber: user.phoneNumber,
						phoneNumberVerified: user.phoneNumberVerified,
						createdAt: user.createdAt,
						updatedAt: user.updatedAt
					}
				});
			}),
			requestPasswordResetPhoneNumber: createAuthEndpoint("/phone-number/request-password-reset", {
				method: "POST",
				body: z.object({ phoneNumber: z.string() }),
				metadata: { openapi: {
					description: "Request OTP for password reset via phone number",
					responses: { "200": {
						description: "OTP sent successfully for password reset",
						content: { "application/json": { schema: {
							type: "object",
							properties: { status: {
								type: "boolean",
								description: "Indicates if the OTP was sent successfully",
								enum: [true]
							} },
							required: ["status"]
						} } }
					} }
				} }
			}, async (ctx) => {
				if (!await ctx.context.adapter.findOne({
					model: "user",
					where: [{
						value: ctx.body.phoneNumber,
						field: opts.phoneNumber
					}]
				})) throw new APIError("BAD_REQUEST", { message: PHONE_NUMBER_ERROR_CODES.PHONE_NUMBER_NOT_EXIST });
				const code = generateOTP(opts.otpLength);
				await ctx.context.internalAdapter.createVerificationValue({
					value: `${code}:0`,
					identifier: `${ctx.body.phoneNumber}-request-password-reset`,
					expiresAt: getDate(opts.expiresIn, "sec")
				});
				await options?.sendPasswordResetOTP?.({
					phoneNumber: ctx.body.phoneNumber,
					code
				}, ctx);
				return ctx.json({ status: true });
			}),
			resetPasswordPhoneNumber: createAuthEndpoint("/phone-number/reset-password", {
				method: "POST",
				body: z.object({
					otp: z.string().meta({ description: "The one time password to reset the password. Eg: \"123456\"" }),
					phoneNumber: z.string().meta({ description: "The phone number to the account which intends to reset the password for. Eg: \"+1234567890\"" }),
					newPassword: z.string().meta({ description: `The new password. Eg: "new-and-secure-password"` })
				}),
				metadata: { openapi: {
					description: "Reset password using phone number OTP",
					responses: { "200": {
						description: "Password reset successfully",
						content: { "application/json": { schema: {
							type: "object",
							properties: { status: {
								type: "boolean",
								description: "Indicates if the password was reset successfully",
								enum: [true]
							} },
							required: ["status"]
						} } }
					} }
				} }
			}, async (ctx) => {
				const verification = await ctx.context.internalAdapter.findVerificationValue(`${ctx.body.phoneNumber}-request-password-reset`);
				if (!verification) throw new APIError("BAD_REQUEST", { message: PHONE_NUMBER_ERROR_CODES.OTP_NOT_FOUND });
				if (verification.expiresAt < /* @__PURE__ */ new Date()) throw new APIError("BAD_REQUEST", { message: PHONE_NUMBER_ERROR_CODES.OTP_EXPIRED });
				const [otpValue, attempts] = verification.value.split(":");
				const allowedAttempts = options?.allowedAttempts || 3;
				if (attempts && parseInt(attempts) >= allowedAttempts) {
					await ctx.context.internalAdapter.deleteVerificationValue(verification.id);
					throw new APIError("FORBIDDEN", { message: PHONE_NUMBER_ERROR_CODES.TOO_MANY_ATTEMPTS });
				}
				if (ctx.body.otp !== otpValue) {
					await ctx.context.internalAdapter.updateVerificationValue(verification.id, { value: `${otpValue}:${parseInt(attempts || "0") + 1}` });
					throw new APIError("BAD_REQUEST", { message: PHONE_NUMBER_ERROR_CODES.INVALID_OTP });
				}
				const user = await ctx.context.adapter.findOne({
					model: "user",
					where: [{
						field: "phoneNumber",
						value: ctx.body.phoneNumber
					}]
				});
				if (!user) throw new APIError("BAD_REQUEST", { message: PHONE_NUMBER_ERROR_CODES.UNEXPECTED_ERROR });
				const hashedPassword = await ctx.context.password.hash(ctx.body.newPassword);
				await ctx.context.internalAdapter.updatePassword(user.id, hashedPassword);
				await ctx.context.internalAdapter.deleteVerificationValue(verification.id);
				return ctx.json({ status: true });
			})
		},
		schema: mergeSchema(schema, options?.schema),
		rateLimit: [{
			pathMatcher(path) {
				return path.startsWith("/phone-number");
			},
			window: 60 * 1e3,
			max: 10
		}],
		$ERROR_CODES: PHONE_NUMBER_ERROR_CODES
	};
};

//#endregion
export { phoneNumber as t };