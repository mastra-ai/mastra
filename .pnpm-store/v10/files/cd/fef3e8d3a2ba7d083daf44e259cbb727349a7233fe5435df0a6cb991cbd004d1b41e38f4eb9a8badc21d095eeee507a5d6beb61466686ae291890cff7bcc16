import { n as symmetricEncrypt, o as constantTimeEqual, r as generateRandomString, t as symmetricDecrypt } from "./crypto-BQxYXGGX.mjs";
import { t as mergeSchema } from "./schema-CSB7dlK0.mjs";
import { t as safeJSONParse } from "./json-_HMgPUVh.mjs";
import { c as setSessionCookie, n as deleteSessionCookie } from "./cookies-D_dksn7B.mjs";
import { r as getSessionFromCtx, u as sessionMiddleware } from "./session-CgfX4vv1.mjs";
import { n as validatePassword } from "./password-DBH2q5D6.mjs";
import { BASE_ERROR_CODES } from "@better-auth/core/error";
import { defineErrorCodes } from "@better-auth/core/utils";
import { APIError } from "better-call";
import * as z from "zod";
import { createHash } from "@better-auth/utils/hash";
import { createAuthEndpoint, createAuthMiddleware } from "@better-auth/core/api";
import { base64Url } from "@better-auth/utils/base64";
import { createHMAC } from "@better-auth/utils/hmac";
import { createOTP } from "@better-auth/utils/otp";

//#region src/plugins/two-factor/error-code.ts
const TWO_FACTOR_ERROR_CODES = defineErrorCodes({
	OTP_NOT_ENABLED: "OTP not enabled",
	OTP_HAS_EXPIRED: "OTP has expired",
	TOTP_NOT_ENABLED: "TOTP not enabled",
	TWO_FACTOR_NOT_ENABLED: "Two factor isn't enabled",
	BACKUP_CODES_NOT_ENABLED: "Backup codes aren't enabled",
	INVALID_BACKUP_CODE: "Invalid backup code",
	INVALID_CODE: "Invalid code",
	TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: "Too many attempts. Please request a new code.",
	INVALID_TWO_FACTOR_COOKIE: "Invalid two factor cookie"
});

//#endregion
//#region src/plugins/two-factor/constant.ts
const TWO_FACTOR_COOKIE_NAME = "two_factor";
const TRUST_DEVICE_COOKIE_NAME = "trust_device";
const TRUST_DEVICE_COOKIE_MAX_AGE = 720 * 60 * 60;

//#endregion
//#region src/plugins/two-factor/verify-two-factor.ts
async function verifyTwoFactor(ctx) {
	const invalid = (errorKey) => {
		throw new APIError("UNAUTHORIZED", { message: TWO_FACTOR_ERROR_CODES[errorKey] });
	};
	const session = await getSessionFromCtx(ctx);
	if (!session) {
		const cookieName = ctx.context.createAuthCookie(TWO_FACTOR_COOKIE_NAME);
		const twoFactorCookie = await ctx.getSignedCookie(cookieName.name, ctx.context.secret);
		if (!twoFactorCookie) throw new APIError("UNAUTHORIZED", { message: TWO_FACTOR_ERROR_CODES.INVALID_TWO_FACTOR_COOKIE });
		const verificationToken = await ctx.context.internalAdapter.findVerificationValue(twoFactorCookie);
		if (!verificationToken) throw new APIError("UNAUTHORIZED", { message: TWO_FACTOR_ERROR_CODES.INVALID_TWO_FACTOR_COOKIE });
		const user = await ctx.context.internalAdapter.findUserById(verificationToken.value);
		if (!user) throw new APIError("UNAUTHORIZED", { message: TWO_FACTOR_ERROR_CODES.INVALID_TWO_FACTOR_COOKIE });
		const dontRememberMe = await ctx.getSignedCookie(ctx.context.authCookies.dontRememberToken.name, ctx.context.secret);
		return {
			valid: async (ctx$1) => {
				const session$1 = await ctx$1.context.internalAdapter.createSession(verificationToken.value, !!dontRememberMe);
				if (!session$1) throw new APIError("INTERNAL_SERVER_ERROR", { message: "failed to create session" });
				await setSessionCookie(ctx$1, {
					session: session$1,
					user
				});
				if (ctx$1.body.trustDevice) {
					const trustDeviceCookie = ctx$1.context.createAuthCookie(TRUST_DEVICE_COOKIE_NAME, { maxAge: TRUST_DEVICE_COOKIE_MAX_AGE });
					/**
					* create a token that will be used to
					* verify the device
					*/
					const token = await createHMAC("SHA-256", "base64urlnopad").sign(ctx$1.context.secret, `${user.id}!${session$1.token}`);
					await ctx$1.setSignedCookie(trustDeviceCookie.name, `${token}!${session$1.token}`, ctx$1.context.secret, trustDeviceCookie.attributes);
					ctx$1.setCookie(ctx$1.context.authCookies.dontRememberToken.name, "", { maxAge: 0 });
					ctx$1.setCookie(cookieName.name, "", { maxAge: 0 });
				}
				return ctx$1.json({
					token: session$1.token,
					user: {
						id: user.id,
						email: user.email,
						emailVerified: user.emailVerified,
						name: user.name,
						image: user.image,
						createdAt: user.createdAt,
						updatedAt: user.updatedAt
					}
				});
			},
			invalid,
			session: {
				session: null,
				user
			},
			key: twoFactorCookie
		};
	}
	return {
		valid: async (ctx$1) => {
			return ctx$1.json({
				token: session.session.token,
				user: {
					id: session.user.id,
					email: session.user.email,
					emailVerified: session.user.emailVerified,
					name: session.user.name,
					image: session.user.image,
					createdAt: session.user.createdAt,
					updatedAt: session.user.updatedAt
				}
			});
		},
		invalid,
		session,
		key: `${session.user.id}!${session.session.id}`
	};
}

//#endregion
//#region src/plugins/two-factor/backup-codes/index.ts
function generateBackupCodesFn(options) {
	return Array.from({ length: options?.amount ?? 10 }).fill(null).map(() => generateRandomString(options?.length ?? 10, "a-z", "0-9", "A-Z")).map((code) => `${code.slice(0, 5)}-${code.slice(5)}`);
}
async function generateBackupCodes(secret, options) {
	const backupCodes = options?.customBackupCodesGenerate ? options.customBackupCodesGenerate() : generateBackupCodesFn(options);
	if (options?.storeBackupCodes === "encrypted") return {
		backupCodes,
		encryptedBackupCodes: await symmetricEncrypt({
			data: JSON.stringify(backupCodes),
			key: secret
		})
	};
	if (typeof options?.storeBackupCodes === "object" && "encrypt" in options?.storeBackupCodes) return {
		backupCodes,
		encryptedBackupCodes: await options?.storeBackupCodes.encrypt(JSON.stringify(backupCodes))
	};
	return {
		backupCodes,
		encryptedBackupCodes: JSON.stringify(backupCodes)
	};
}
async function verifyBackupCode(data, key, options) {
	const codes = await getBackupCodes(data.backupCodes, key, options);
	if (!codes) return {
		status: false,
		updated: null
	};
	return {
		status: codes.includes(data.code),
		updated: codes.filter((code) => code !== data.code)
	};
}
async function getBackupCodes(backupCodes, key, options) {
	if (options?.storeBackupCodes === "encrypted") return safeJSONParse(await symmetricDecrypt({
		key,
		data: backupCodes
	}));
	if (typeof options?.storeBackupCodes === "object" && "decrypt" in options?.storeBackupCodes) return safeJSONParse(await options?.storeBackupCodes.decrypt(backupCodes));
	return safeJSONParse(backupCodes);
}
const backupCode2fa = (opts) => {
	const twoFactorTable = "twoFactor";
	return {
		id: "backup_code",
		endpoints: {
			verifyBackupCode: createAuthEndpoint("/two-factor/verify-backup-code", {
				method: "POST",
				body: z.object({
					code: z.string().meta({ description: `A backup code to verify. Eg: "123456"` }),
					disableSession: z.boolean().meta({ description: "If true, the session cookie will not be set." }).optional(),
					trustDevice: z.boolean().meta({ description: "If true, the device will be trusted for 30 days. It'll be refreshed on every sign in request within this time. Eg: true" }).optional()
				}),
				metadata: { openapi: {
					description: "Verify a backup code for two-factor authentication",
					responses: { "200": {
						description: "Backup code verified successfully",
						content: { "application/json": { schema: {
							type: "object",
							properties: {
								user: {
									type: "object",
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
										twoFactorEnabled: {
											type: "boolean",
											description: "Whether two-factor authentication is enabled for the user"
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
										"twoFactorEnabled",
										"createdAt",
										"updatedAt"
									],
									description: "The authenticated user object with two-factor details"
								},
								session: {
									type: "object",
									properties: {
										token: {
											type: "string",
											description: "Session token"
										},
										userId: {
											type: "string",
											description: "ID of the user associated with the session"
										},
										createdAt: {
											type: "string",
											format: "date-time",
											description: "Timestamp when the session was created"
										},
										expiresAt: {
											type: "string",
											format: "date-time",
											description: "Timestamp when the session expires"
										}
									},
									required: [
										"token",
										"userId",
										"createdAt",
										"expiresAt"
									],
									description: "The current session object, included unless disableSession is true"
								}
							},
							required: ["user", "session"]
						} } }
					} }
				} }
			}, async (ctx) => {
				const { session, valid } = await verifyTwoFactor(ctx);
				const user = session.user;
				const twoFactor$1 = await ctx.context.adapter.findOne({
					model: twoFactorTable,
					where: [{
						field: "userId",
						value: user.id
					}]
				});
				if (!twoFactor$1) throw new APIError("BAD_REQUEST", { message: TWO_FACTOR_ERROR_CODES.BACKUP_CODES_NOT_ENABLED });
				const validate = await verifyBackupCode({
					backupCodes: twoFactor$1.backupCodes,
					code: ctx.body.code
				}, ctx.context.secret, opts);
				if (!validate.status) throw new APIError("UNAUTHORIZED", { message: TWO_FACTOR_ERROR_CODES.INVALID_BACKUP_CODE });
				const updatedBackupCodes = await symmetricEncrypt({
					key: ctx.context.secret,
					data: JSON.stringify(validate.updated)
				});
				if (!await ctx.context.adapter.updateMany({
					model: twoFactorTable,
					update: { backupCodes: updatedBackupCodes },
					where: [{
						field: "userId",
						value: user.id
					}, {
						field: "backupCodes",
						value: twoFactor$1.backupCodes
					}]
				})) throw new APIError("CONFLICT", { message: "Failed to verify backup code. Please try again." });
				if (!ctx.body.disableSession) return valid(ctx);
				return ctx.json({
					token: session.session?.token,
					user: {
						id: session.user?.id,
						email: session.user.email,
						emailVerified: session.user.emailVerified,
						name: session.user.name,
						image: session.user.image,
						createdAt: session.user.createdAt,
						updatedAt: session.user.updatedAt
					}
				});
			}),
			generateBackupCodes: createAuthEndpoint("/two-factor/generate-backup-codes", {
				method: "POST",
				body: z.object({ password: z.string().meta({ description: "The users password." }) }),
				use: [sessionMiddleware],
				metadata: { openapi: {
					description: "Generate new backup codes for two-factor authentication",
					responses: { "200": {
						description: "Backup codes generated successfully",
						content: { "application/json": { schema: {
							type: "object",
							properties: {
								status: {
									type: "boolean",
									description: "Indicates if the backup codes were generated successfully",
									enum: [true]
								},
								backupCodes: {
									type: "array",
									items: { type: "string" },
									description: "Array of generated backup codes in plain text"
								}
							},
							required: ["status", "backupCodes"]
						} } }
					} }
				} }
			}, async (ctx) => {
				const user = ctx.context.session.user;
				if (!user.twoFactorEnabled) throw new APIError("BAD_REQUEST", { message: TWO_FACTOR_ERROR_CODES.TWO_FACTOR_NOT_ENABLED });
				await ctx.context.password.checkPassword(user.id, ctx);
				const backupCodes = await generateBackupCodes(ctx.context.secret, opts);
				await ctx.context.adapter.updateMany({
					model: twoFactorTable,
					update: { backupCodes: backupCodes.encryptedBackupCodes },
					where: [{
						field: "userId",
						value: ctx.context.session.user.id
					}]
				});
				return ctx.json({
					status: true,
					backupCodes: backupCodes.backupCodes
				});
			}),
			viewBackupCodes: createAuthEndpoint("/two-factor/view-backup-codes", {
				method: "POST",
				body: z.object({ userId: z.coerce.string().meta({ description: `The user ID to view all backup codes. Eg: "user-id"` }) }),
				metadata: { SERVER_ONLY: true }
			}, async (ctx) => {
				const twoFactor$1 = await ctx.context.adapter.findOne({
					model: twoFactorTable,
					where: [{
						field: "userId",
						value: ctx.body.userId
					}]
				});
				if (!twoFactor$1) throw new APIError("BAD_REQUEST", { message: TWO_FACTOR_ERROR_CODES.BACKUP_CODES_NOT_ENABLED });
				const decryptedBackupCodes = await getBackupCodes(twoFactor$1.backupCodes, ctx.context.secret, opts);
				if (!decryptedBackupCodes) throw new APIError("BAD_REQUEST", { message: TWO_FACTOR_ERROR_CODES.INVALID_BACKUP_CODE });
				return ctx.json({
					status: true,
					backupCodes: decryptedBackupCodes
				});
			})
		}
	};
};

//#endregion
//#region src/plugins/two-factor/utils.ts
const defaultKeyHasher = async (token) => {
	const hash = await createHash("SHA-256").digest(new TextEncoder().encode(token));
	return base64Url.encode(new Uint8Array(hash), { padding: false });
};

//#endregion
//#region src/plugins/two-factor/otp/index.ts
/**
* The otp adapter is created from the totp adapter.
*/
const otp2fa = (options) => {
	const opts = {
		storeOTP: "plain",
		digits: 6,
		...options,
		period: (options?.period || 3) * 60 * 1e3
	};
	async function storeOTP(ctx, otp) {
		if (opts.storeOTP === "hashed") return await defaultKeyHasher(otp);
		if (typeof opts.storeOTP === "object" && "hash" in opts.storeOTP) return await opts.storeOTP.hash(otp);
		if (typeof opts.storeOTP === "object" && "encrypt" in opts.storeOTP) return await opts.storeOTP.encrypt(otp);
		if (opts.storeOTP === "encrypted") return await symmetricEncrypt({
			key: ctx.context.secret,
			data: otp
		});
		return otp;
	}
	async function decryptOTP(ctx, otp) {
		if (opts.storeOTP === "hashed") return await defaultKeyHasher(otp);
		if (opts.storeOTP === "encrypted") return await symmetricDecrypt({
			key: ctx.context.secret,
			data: otp
		});
		if (typeof opts.storeOTP === "object" && "encrypt" in opts.storeOTP) return await opts.storeOTP.decrypt(otp);
		if (typeof opts.storeOTP === "object" && "hash" in opts.storeOTP) return await opts.storeOTP.hash(otp);
		return otp;
	}
	return {
		id: "otp",
		endpoints: {
			sendTwoFactorOTP: createAuthEndpoint("/two-factor/send-otp", {
				method: "POST",
				body: z.object({ trustDevice: z.boolean().optional().meta({ description: "If true, the device will be trusted for 30 days. It'll be refreshed on every sign in request within this time. Eg: true" }) }).optional(),
				metadata: { openapi: {
					summary: "Send two factor OTP",
					description: "Send two factor OTP to the user",
					responses: { 200: {
						description: "Successful response",
						content: { "application/json": { schema: {
							type: "object",
							properties: { status: { type: "boolean" } }
						} } }
					} }
				} }
			}, async (ctx) => {
				if (!options || !options.sendOTP) {
					ctx.context.logger.error("send otp isn't configured. Please configure the send otp function on otp options.");
					throw new APIError("BAD_REQUEST", { message: "otp isn't configured" });
				}
				const { session, key } = await verifyTwoFactor(ctx);
				const code = generateRandomString(opts.digits, "0-9");
				const hashedCode = await storeOTP(ctx, code);
				await ctx.context.internalAdapter.createVerificationValue({
					value: `${hashedCode}:0`,
					identifier: `2fa-otp-${key}`,
					expiresAt: new Date(Date.now() + opts.period)
				});
				await options.sendOTP({
					user: session.user,
					otp: code
				}, ctx);
				return ctx.json({ status: true });
			}),
			verifyTwoFactorOTP: createAuthEndpoint("/two-factor/verify-otp", {
				method: "POST",
				body: z.object({
					code: z.string().meta({ description: "The otp code to verify. Eg: \"012345\"" }),
					trustDevice: z.boolean().optional().meta({ description: "If true, the device will be trusted for 30 days. It'll be refreshed on every sign in request within this time. Eg: true" })
				}),
				metadata: { openapi: {
					summary: "Verify two factor OTP",
					description: "Verify two factor OTP",
					responses: { "200": {
						description: "Two-factor OTP verified successfully",
						content: { "application/json": { schema: {
							type: "object",
							properties: {
								token: {
									type: "string",
									description: "Session token for the authenticated session"
								},
								user: {
									type: "object",
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
										"createdAt",
										"updatedAt"
									],
									description: "The authenticated user object"
								}
							},
							required: ["token", "user"]
						} } }
					} }
				} }
			}, async (ctx) => {
				const { session, key, valid, invalid } = await verifyTwoFactor(ctx);
				const toCheckOtp = await ctx.context.internalAdapter.findVerificationValue(`2fa-otp-${key}`);
				const [otp, counter] = toCheckOtp?.value?.split(":") ?? [];
				const decryptedOtp = await decryptOTP(ctx, otp);
				if (!toCheckOtp || toCheckOtp.expiresAt < /* @__PURE__ */ new Date()) {
					if (toCheckOtp) await ctx.context.internalAdapter.deleteVerificationValue(toCheckOtp.id);
					throw new APIError("BAD_REQUEST", { message: TWO_FACTOR_ERROR_CODES.OTP_HAS_EXPIRED });
				}
				const allowedAttempts = options?.allowedAttempts || 5;
				if (parseInt(counter) >= allowedAttempts) {
					await ctx.context.internalAdapter.deleteVerificationValue(toCheckOtp.id);
					throw new APIError("BAD_REQUEST", { message: TWO_FACTOR_ERROR_CODES.TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE });
				}
				if (constantTimeEqual(new TextEncoder().encode(decryptedOtp), new TextEncoder().encode(ctx.body.code))) {
					if (!session.user.twoFactorEnabled) {
						if (!session.session) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.FAILED_TO_CREATE_SESSION });
						const updatedUser = await ctx.context.internalAdapter.updateUser(session.user.id, { twoFactorEnabled: true });
						const newSession = await ctx.context.internalAdapter.createSession(session.user.id, false, session.session);
						await ctx.context.internalAdapter.deleteSession(session.session.token);
						await setSessionCookie(ctx, {
							session: newSession,
							user: updatedUser
						});
						return ctx.json({
							token: newSession.token,
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
					return valid(ctx);
				} else {
					await ctx.context.internalAdapter.updateVerificationValue(toCheckOtp.id, { value: `${otp}:${(parseInt(counter, 10) || 0) + 1}` });
					return invalid("INVALID_CODE");
				}
			})
		}
	};
};

//#endregion
//#region src/plugins/two-factor/schema.ts
const schema = {
	user: { fields: { twoFactorEnabled: {
		type: "boolean",
		required: false,
		defaultValue: false,
		input: false
	} } },
	twoFactor: { fields: {
		secret: {
			type: "string",
			required: true,
			returned: false,
			index: true
		},
		backupCodes: {
			type: "string",
			required: true,
			returned: false
		},
		userId: {
			type: "string",
			required: true,
			returned: false,
			references: {
				model: "user",
				field: "id"
			},
			index: true
		}
	} }
};

//#endregion
//#region src/plugins/two-factor/totp/index.ts
const totp2fa = (options) => {
	const opts = {
		...options,
		digits: options?.digits || 6,
		period: options?.period || 30
	};
	const twoFactorTable = "twoFactor";
	return {
		id: "totp",
		endpoints: {
			generateTOTP: createAuthEndpoint("/totp/generate", {
				method: "POST",
				body: z.object({ secret: z.string().meta({ description: "The secret to generate the TOTP code" }) }),
				metadata: {
					openapi: {
						summary: "Generate TOTP code",
						description: "Use this endpoint to generate a TOTP code",
						responses: { 200: {
							description: "Successful response",
							content: { "application/json": { schema: {
								type: "object",
								properties: { code: { type: "string" } }
							} } }
						} }
					},
					SERVER_ONLY: true
				}
			}, async (ctx) => {
				if (options?.disable) {
					ctx.context.logger.error("totp isn't configured. please pass totp option on two factor plugin to enable totp");
					throw new APIError("BAD_REQUEST", { message: "totp isn't configured" });
				}
				return { code: await createOTP(ctx.body.secret, {
					period: opts.period,
					digits: opts.digits
				}).totp() };
			}),
			getTOTPURI: createAuthEndpoint("/two-factor/get-totp-uri", {
				method: "POST",
				use: [sessionMiddleware],
				body: z.object({ password: z.string().meta({ description: "User password" }) }),
				metadata: { openapi: {
					summary: "Get TOTP URI",
					description: "Use this endpoint to get the TOTP URI",
					responses: { 200: {
						description: "Successful response",
						content: { "application/json": { schema: {
							type: "object",
							properties: { totpURI: { type: "string" } }
						} } }
					} }
				} }
			}, async (ctx) => {
				if (options?.disable) {
					ctx.context.logger.error("totp isn't configured. please pass totp option on two factor plugin to enable totp");
					throw new APIError("BAD_REQUEST", { message: "totp isn't configured" });
				}
				const user = ctx.context.session.user;
				const twoFactor$1 = await ctx.context.adapter.findOne({
					model: twoFactorTable,
					where: [{
						field: "userId",
						value: user.id
					}]
				});
				if (!twoFactor$1) throw new APIError("BAD_REQUEST", { message: TWO_FACTOR_ERROR_CODES.TOTP_NOT_ENABLED });
				const secret = await symmetricDecrypt({
					key: ctx.context.secret,
					data: twoFactor$1.secret
				});
				await ctx.context.password.checkPassword(user.id, ctx);
				return { totpURI: createOTP(secret, {
					digits: opts.digits,
					period: opts.period
				}).url(options?.issuer || ctx.context.appName, user.email) };
			}),
			verifyTOTP: createAuthEndpoint("/two-factor/verify-totp", {
				method: "POST",
				body: z.object({
					code: z.string().meta({ description: "The otp code to verify. Eg: \"012345\"" }),
					trustDevice: z.boolean().meta({ description: "If true, the device will be trusted for 30 days. It'll be refreshed on every sign in request within this time. Eg: true" }).optional()
				}),
				metadata: { openapi: {
					summary: "Verify two factor TOTP",
					description: "Verify two factor TOTP",
					responses: { 200: {
						description: "Successful response",
						content: { "application/json": { schema: {
							type: "object",
							properties: { status: { type: "boolean" } }
						} } }
					} }
				} }
			}, async (ctx) => {
				if (options?.disable) {
					ctx.context.logger.error("totp isn't configured. please pass totp option on two factor plugin to enable totp");
					throw new APIError("BAD_REQUEST", { message: "totp isn't configured" });
				}
				const { session, valid, invalid } = await verifyTwoFactor(ctx);
				const user = session.user;
				const twoFactor$1 = await ctx.context.adapter.findOne({
					model: twoFactorTable,
					where: [{
						field: "userId",
						value: user.id
					}]
				});
				if (!twoFactor$1) throw new APIError("BAD_REQUEST", { message: TWO_FACTOR_ERROR_CODES.TOTP_NOT_ENABLED });
				if (!await createOTP(await symmetricDecrypt({
					key: ctx.context.secret,
					data: twoFactor$1.secret
				}), {
					period: opts.period,
					digits: opts.digits
				}).verify(ctx.body.code)) return invalid("INVALID_CODE");
				if (!user.twoFactorEnabled) {
					if (!session.session) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.FAILED_TO_CREATE_SESSION });
					const updatedUser = await ctx.context.internalAdapter.updateUser(user.id, { twoFactorEnabled: true });
					const newSession = await ctx.context.internalAdapter.createSession(user.id, false, session.session).catch((e) => {
						throw e;
					});
					await ctx.context.internalAdapter.deleteSession(session.session.token);
					await setSessionCookie(ctx, {
						session: newSession,
						user: updatedUser
					});
				}
				return valid(ctx);
			})
		}
	};
};

//#endregion
//#region src/plugins/two-factor/index.ts
const twoFactor = (options) => {
	const opts = { twoFactorTable: "twoFactor" };
	const backupCodeOptions = {
		storeBackupCodes: "encrypted",
		...options?.backupCodeOptions
	};
	const totp = totp2fa(options?.totpOptions);
	const backupCode = backupCode2fa(backupCodeOptions);
	const otp = otp2fa(options?.otpOptions);
	return {
		id: "two-factor",
		endpoints: {
			...totp.endpoints,
			...otp.endpoints,
			...backupCode.endpoints,
			enableTwoFactor: createAuthEndpoint("/two-factor/enable", {
				method: "POST",
				body: z.object({
					password: z.string().meta({ description: "User password" }),
					issuer: z.string().meta({ description: "Custom issuer for the TOTP URI" }).optional()
				}),
				use: [sessionMiddleware],
				metadata: { openapi: {
					summary: "Enable two factor authentication",
					description: "Use this endpoint to enable two factor authentication. This will generate a TOTP URI and backup codes. Once the user verifies the TOTP URI, the two factor authentication will be enabled.",
					responses: { 200: {
						description: "Successful response",
						content: { "application/json": { schema: {
							type: "object",
							properties: {
								totpURI: {
									type: "string",
									description: "TOTP URI"
								},
								backupCodes: {
									type: "array",
									items: { type: "string" },
									description: "Backup codes"
								}
							}
						} } }
					} }
				} }
			}, async (ctx) => {
				const user = ctx.context.session.user;
				const { password, issuer } = ctx.body;
				if (!await validatePassword(ctx, {
					password,
					userId: user.id
				})) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.INVALID_PASSWORD });
				const secret = generateRandomString(32);
				const encryptedSecret = await symmetricEncrypt({
					key: ctx.context.secret,
					data: secret
				});
				const backupCodes = await generateBackupCodes(ctx.context.secret, backupCodeOptions);
				if (options?.skipVerificationOnEnable) {
					const updatedUser = await ctx.context.internalAdapter.updateUser(user.id, { twoFactorEnabled: true });
					/**
					* Update the session cookie with the new user data
					*/
					await setSessionCookie(ctx, {
						session: await ctx.context.internalAdapter.createSession(updatedUser.id, false, ctx.context.session.session),
						user: updatedUser
					});
					await ctx.context.internalAdapter.deleteSession(ctx.context.session.session.token);
				}
				await ctx.context.adapter.deleteMany({
					model: opts.twoFactorTable,
					where: [{
						field: "userId",
						value: user.id
					}]
				});
				await ctx.context.adapter.create({
					model: opts.twoFactorTable,
					data: {
						secret: encryptedSecret,
						backupCodes: backupCodes.encryptedBackupCodes,
						userId: user.id
					}
				});
				const totpURI = createOTP(secret, {
					digits: options?.totpOptions?.digits || 6,
					period: options?.totpOptions?.period
				}).url(issuer || options?.issuer || ctx.context.appName, user.email);
				return ctx.json({
					totpURI,
					backupCodes: backupCodes.backupCodes
				});
			}),
			disableTwoFactor: createAuthEndpoint("/two-factor/disable", {
				method: "POST",
				body: z.object({ password: z.string().meta({ description: "User password" }) }),
				use: [sessionMiddleware],
				metadata: { openapi: {
					summary: "Disable two factor authentication",
					description: "Use this endpoint to disable two factor authentication.",
					responses: { 200: {
						description: "Successful response",
						content: { "application/json": { schema: {
							type: "object",
							properties: { status: { type: "boolean" } }
						} } }
					} }
				} }
			}, async (ctx) => {
				const user = ctx.context.session.user;
				const { password } = ctx.body;
				if (!await validatePassword(ctx, {
					password,
					userId: user.id
				})) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.INVALID_PASSWORD });
				const updatedUser = await ctx.context.internalAdapter.updateUser(user.id, { twoFactorEnabled: false });
				await ctx.context.adapter.delete({
					model: opts.twoFactorTable,
					where: [{
						field: "userId",
						value: updatedUser.id
					}]
				});
				/**
				* Update the session cookie with the new user data
				*/
				await setSessionCookie(ctx, {
					session: await ctx.context.internalAdapter.createSession(updatedUser.id, false, ctx.context.session.session),
					user: updatedUser
				});
				await ctx.context.internalAdapter.deleteSession(ctx.context.session.session.token);
				return ctx.json({ status: true });
			})
		},
		options,
		hooks: { after: [{
			matcher(context) {
				return context.path === "/sign-in/email" || context.path === "/sign-in/username" || context.path === "/sign-in/phone-number";
			},
			handler: createAuthMiddleware(async (ctx) => {
				const data = ctx.context.newSession;
				if (!data) return;
				if (!data?.user.twoFactorEnabled) return;
				const trustDeviceCookieAttrs = ctx.context.createAuthCookie(TRUST_DEVICE_COOKIE_NAME, { maxAge: TRUST_DEVICE_COOKIE_MAX_AGE });
				const trustDeviceCookie = await ctx.getSignedCookie(trustDeviceCookieAttrs.name, ctx.context.secret);
				if (trustDeviceCookie) {
					const [token, sessionToken] = trustDeviceCookie.split("!");
					if (token === await createHMAC("SHA-256", "base64urlnopad").sign(ctx.context.secret, `${data.user.id}!${sessionToken}`)) {
						const newTrustDeviceCookie = ctx.context.createAuthCookie(TRUST_DEVICE_COOKIE_NAME, { maxAge: TRUST_DEVICE_COOKIE_MAX_AGE });
						const newToken = await createHMAC("SHA-256", "base64urlnopad").sign(ctx.context.secret, `${data.user.id}!${data.session.token}`);
						await ctx.setSignedCookie(newTrustDeviceCookie.name, `${newToken}!${data.session.token}`, ctx.context.secret, trustDeviceCookieAttrs.attributes);
						return;
					}
				}
				/**
				* remove the session cookie. It's set by the sign in credential
				*/
				deleteSessionCookie(ctx, true);
				await ctx.context.internalAdapter.deleteSession(data.session.token);
				const maxAge = (options?.otpOptions?.period ?? 3) * 60;
				const twoFactorCookie = ctx.context.createAuthCookie(TWO_FACTOR_COOKIE_NAME, { maxAge });
				const identifier = `2fa-${generateRandomString(20)}`;
				await ctx.context.internalAdapter.createVerificationValue({
					value: data.user.id,
					identifier,
					expiresAt: new Date(Date.now() + maxAge * 1e3)
				});
				await ctx.setSignedCookie(twoFactorCookie.name, identifier, ctx.context.secret, twoFactorCookie.attributes);
				return ctx.json({ twoFactorRedirect: true });
			})
		}] },
		schema: mergeSchema(schema, options?.schema),
		rateLimit: [{
			pathMatcher(path) {
				return path.startsWith("/two-factor/");
			},
			window: 10,
			max: 3
		}],
		$ERROR_CODES: TWO_FACTOR_ERROR_CODES
	};
};

//#endregion
export { TWO_FACTOR_ERROR_CODES as n, twoFactor as t };