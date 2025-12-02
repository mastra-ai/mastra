import { l as parseUserOutput, t as mergeSchema, u as getDate } from "./schema-CSB7dlK0.mjs";
import { t as APIError } from "./api-q2sbQ7PT.mjs";
import { c as setSessionCookie, n as deleteSessionCookie } from "./cookies-D_dksn7B.mjs";
import { r as getSessionFromCtx } from "./session-CgfX4vv1.mjs";
import { t as hasPermission } from "./has-permission-DN8I_Icv.mjs";
import { t as getEndpointResponse } from "./plugin-helper-CA_Vvnl9.mjs";
import { BASE_ERROR_CODES } from "@better-auth/core/error";
import { defineErrorCodes } from "@better-auth/core/utils";
import * as z from "zod";
import { createAuthEndpoint, createAuthMiddleware } from "@better-auth/core/api";

//#region src/plugins/admin/error-codes.ts
const ADMIN_ERROR_CODES = defineErrorCodes({
	FAILED_TO_CREATE_USER: "Failed to create user",
	USER_ALREADY_EXISTS: "User already exists.",
	USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "User already exists. Use another email.",
	YOU_CANNOT_BAN_YOURSELF: "You cannot ban yourself",
	YOU_ARE_NOT_ALLOWED_TO_CHANGE_USERS_ROLE: "You are not allowed to change users role",
	YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS: "You are not allowed to create users",
	YOU_ARE_NOT_ALLOWED_TO_LIST_USERS: "You are not allowed to list users",
	YOU_ARE_NOT_ALLOWED_TO_LIST_USERS_SESSIONS: "You are not allowed to list users sessions",
	YOU_ARE_NOT_ALLOWED_TO_BAN_USERS: "You are not allowed to ban users",
	YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS: "You are not allowed to impersonate users",
	YOU_ARE_NOT_ALLOWED_TO_REVOKE_USERS_SESSIONS: "You are not allowed to revoke users sessions",
	YOU_ARE_NOT_ALLOWED_TO_DELETE_USERS: "You are not allowed to delete users",
	YOU_ARE_NOT_ALLOWED_TO_SET_USERS_PASSWORD: "You are not allowed to set users password",
	BANNED_USER: "You have been banned from this application",
	YOU_ARE_NOT_ALLOWED_TO_GET_USER: "You are not allowed to get user",
	NO_DATA_TO_UPDATE: "No data to update",
	YOU_ARE_NOT_ALLOWED_TO_UPDATE_USERS: "You are not allowed to update users",
	YOU_CANNOT_REMOVE_YOURSELF: "You cannot remove yourself",
	YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE: "You are not allowed to set a non-existent role value"
});

//#endregion
//#region src/plugins/admin/schema.ts
const schema = {
	user: { fields: {
		role: {
			type: "string",
			required: false,
			input: false
		},
		banned: {
			type: "boolean",
			defaultValue: false,
			required: false,
			input: false
		},
		banReason: {
			type: "string",
			required: false,
			input: false
		},
		banExpires: {
			type: "date",
			required: false,
			input: false
		}
	} },
	session: { fields: { impersonatedBy: {
		type: "string",
		required: false
	} } }
};

//#endregion
//#region src/plugins/admin/admin.ts
function parseRoles(roles) {
	return Array.isArray(roles) ? roles.join(",") : roles;
}
const admin = (options) => {
	const opts = {
		defaultRole: options?.defaultRole ?? "user",
		adminRoles: options?.adminRoles ?? ["admin"],
		bannedUserMessage: options?.bannedUserMessage ?? "You have been banned from this application. Please contact support if you believe this is an error.",
		...options
	};
	/**
	* Ensures a valid session, if not will throw.
	* Will also provide additional types on the user to include role types.
	*/
	const adminMiddleware = createAuthMiddleware(async (ctx) => {
		const session = await getSessionFromCtx(ctx);
		if (!session) throw new APIError("UNAUTHORIZED");
		return { session };
	});
	return {
		id: "admin",
		init() {
			return { options: { databaseHooks: {
				user: { create: { async before(user) {
					return { data: {
						role: options?.defaultRole ?? "user",
						...user
					} };
				} } },
				session: { create: { async before(session, ctx) {
					if (!ctx) return;
					const user = await ctx.context.internalAdapter.findUserById(session.userId);
					if (user.banned) {
						if (user.banExpires && new Date(user.banExpires).getTime() < Date.now()) {
							await ctx.context.internalAdapter.updateUser(session.userId, {
								banned: false,
								banReason: null,
								banExpires: null
							});
							return;
						}
						if (ctx && (ctx.path.startsWith("/callback") || ctx.path.startsWith("/oauth2/callback"))) {
							const redirectURI = ctx.context.options.onAPIError?.errorURL || `${ctx.context.baseURL}/error`;
							throw ctx.redirect(`${redirectURI}?error=banned&error_description=${opts.bannedUserMessage}`);
						}
						throw new APIError("FORBIDDEN", {
							message: opts.bannedUserMessage,
							code: "BANNED_USER"
						});
					}
				} } }
			} } };
		},
		hooks: { after: [{
			matcher(context) {
				return context.path === "/list-sessions";
			},
			handler: createAuthMiddleware(async (ctx) => {
				const response = await getEndpointResponse(ctx);
				if (!response) return;
				const newJson = response.filter((session) => {
					return !session.impersonatedBy;
				});
				return ctx.json(newJson);
			})
		}] },
		endpoints: {
			setRole: createAuthEndpoint("/admin/set-role", {
				method: "POST",
				body: z.object({
					userId: z.coerce.string().meta({ description: "The user id" }),
					role: z.union([z.string().meta({ description: "The role to set. `admin` or `user` by default" }), z.array(z.string().meta({ description: "The roles to set. `admin` or `user` by default" }))]).meta({ description: "The role to set, this can be a string or an array of strings. Eg: `admin` or `[admin, user]`" })
				}),
				requireHeaders: true,
				use: [adminMiddleware],
				metadata: {
					openapi: {
						operationId: "setUserRole",
						summary: "Set the role of a user",
						description: "Set the role of a user",
						responses: { 200: {
							description: "User role updated",
							content: { "application/json": { schema: {
								type: "object",
								properties: { user: { $ref: "#/components/schemas/User" } }
							} } }
						} }
					},
					$Infer: { body: {} }
				}
			}, async (ctx) => {
				if (!hasPermission({
					userId: ctx.context.session.user.id,
					role: ctx.context.session.user.role,
					options: opts,
					permissions: { user: ["set-role"] }
				})) throw new APIError("FORBIDDEN", { message: ADMIN_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_CHANGE_USERS_ROLE });
				const roles = opts.roles;
				if (roles) {
					const inputRoles = Array.isArray(ctx.body.role) ? ctx.body.role : [ctx.body.role];
					for (const role of inputRoles) if (!roles[role]) throw new APIError("BAD_REQUEST", { message: ADMIN_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE });
				}
				const updatedUser = await ctx.context.internalAdapter.updateUser(ctx.body.userId, { role: parseRoles(ctx.body.role) });
				return ctx.json({ user: updatedUser });
			}),
			getUser: createAuthEndpoint("/admin/get-user", {
				method: "GET",
				query: z.object({ id: z.string().meta({ description: "The id of the User" }) }),
				use: [adminMiddleware],
				metadata: { openapi: {
					operationId: "getUser",
					summary: "Get an existing user",
					description: "Get an existing user",
					responses: { 200: {
						description: "User",
						content: { "application/json": { schema: {
							type: "object",
							properties: { user: { $ref: "#/components/schemas/User" } }
						} } }
					} }
				} }
			}, async (ctx) => {
				const { id } = ctx.query;
				if (!hasPermission({
					userId: ctx.context.session.user.id,
					role: ctx.context.session.user.role,
					options: opts,
					permissions: { user: ["get"] }
				})) throw ctx.error("FORBIDDEN", {
					message: ADMIN_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_GET_USER,
					code: "YOU_ARE_NOT_ALLOWED_TO_GET_USER"
				});
				const user = await ctx.context.internalAdapter.findUserById(id);
				if (!user) throw new APIError("NOT_FOUND", { message: BASE_ERROR_CODES.USER_NOT_FOUND });
				return parseUserOutput(ctx.context.options, user);
			}),
			createUser: createAuthEndpoint("/admin/create-user", {
				method: "POST",
				body: z.object({
					email: z.string().meta({ description: "The email of the user" }),
					password: z.string().meta({ description: "The password of the user" }),
					name: z.string().meta({ description: "The name of the user" }),
					role: z.union([z.string().meta({ description: "The role of the user" }), z.array(z.string().meta({ description: "The roles of user" }))]).optional().meta({ description: `A string or array of strings representing the roles to apply to the new user. Eg: \"user\"` }),
					data: z.record(z.string(), z.any()).optional().meta({ description: "Extra fields for the user. Including custom additional fields." })
				}),
				metadata: {
					openapi: {
						operationId: "createUser",
						summary: "Create a new user",
						description: "Create a new user",
						responses: { 200: {
							description: "User created",
							content: { "application/json": { schema: {
								type: "object",
								properties: { user: { $ref: "#/components/schemas/User" } }
							} } }
						} }
					},
					$Infer: { body: {} }
				}
			}, async (ctx) => {
				const session = await getSessionFromCtx(ctx);
				if (!session && (ctx.request || ctx.headers)) throw ctx.error("UNAUTHORIZED");
				if (session) {
					if (!hasPermission({
						userId: session.user.id,
						role: session.user.role,
						options: opts,
						permissions: { user: ["create"] }
					})) throw new APIError("FORBIDDEN", { message: ADMIN_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS });
				}
				const email = ctx.body.email.toLowerCase();
				if (!z.email().safeParse(email).success) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.INVALID_EMAIL });
				if (await ctx.context.internalAdapter.findUserByEmail(email)) throw new APIError("BAD_REQUEST", { message: ADMIN_ERROR_CODES.USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL });
				const user = await ctx.context.internalAdapter.createUser({
					email,
					name: ctx.body.name,
					role: (ctx.body.role && parseRoles(ctx.body.role)) ?? options?.defaultRole ?? "user",
					...ctx.body.data
				});
				if (!user) throw new APIError("INTERNAL_SERVER_ERROR", { message: ADMIN_ERROR_CODES.FAILED_TO_CREATE_USER });
				const hashedPassword = await ctx.context.password.hash(ctx.body.password);
				await ctx.context.internalAdapter.linkAccount({
					accountId: user.id,
					providerId: "credential",
					password: hashedPassword,
					userId: user.id
				});
				return ctx.json({ user });
			}),
			adminUpdateUser: createAuthEndpoint("/admin/update-user", {
				method: "POST",
				body: z.object({
					userId: z.coerce.string().meta({ description: "The user id" }),
					data: z.record(z.any(), z.any()).meta({ description: "The user data to update" })
				}),
				use: [adminMiddleware],
				metadata: { openapi: {
					operationId: "updateUser",
					summary: "Update a user",
					description: "Update a user's details",
					responses: { 200: {
						description: "User updated",
						content: { "application/json": { schema: {
							type: "object",
							properties: { user: { $ref: "#/components/schemas/User" } }
						} } }
					} }
				} }
			}, async (ctx) => {
				if (!hasPermission({
					userId: ctx.context.session.user.id,
					role: ctx.context.session.user.role,
					options: opts,
					permissions: { user: ["update"] }
				})) throw ctx.error("FORBIDDEN", {
					message: ADMIN_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_UPDATE_USERS,
					code: "YOU_ARE_NOT_ALLOWED_TO_UPDATE_USERS"
				});
				if (Object.keys(ctx.body.data).length === 0) throw new APIError("BAD_REQUEST", { message: ADMIN_ERROR_CODES.NO_DATA_TO_UPDATE });
				if (ctx.body.data?.role) ctx.body.data.role = parseRoles(ctx.body.data.role);
				const updatedUser = await ctx.context.internalAdapter.updateUser(ctx.body.userId, ctx.body.data);
				return ctx.json(updatedUser);
			}),
			listUsers: createAuthEndpoint("/admin/list-users", {
				method: "GET",
				use: [adminMiddleware],
				query: z.object({
					searchValue: z.string().optional().meta({ description: "The value to search for. Eg: \"some name\"" }),
					searchField: z.enum(["email", "name"]).meta({ description: "The field to search in, defaults to email. Can be `email` or `name`. Eg: \"name\"" }).optional(),
					searchOperator: z.enum([
						"contains",
						"starts_with",
						"ends_with"
					]).meta({ description: "The operator to use for the search. Can be `contains`, `starts_with` or `ends_with`. Eg: \"contains\"" }).optional(),
					limit: z.string().meta({ description: "The number of users to return" }).or(z.number()).optional(),
					offset: z.string().meta({ description: "The offset to start from" }).or(z.number()).optional(),
					sortBy: z.string().meta({ description: "The field to sort by" }).optional(),
					sortDirection: z.enum(["asc", "desc"]).meta({ description: "The direction to sort by" }).optional(),
					filterField: z.string().meta({ description: "The field to filter by" }).optional(),
					filterValue: z.string().meta({ description: "The value to filter by" }).or(z.number()).or(z.boolean()).optional(),
					filterOperator: z.enum([
						"eq",
						"ne",
						"lt",
						"lte",
						"gt",
						"gte",
						"contains"
					]).meta({ description: "The operator to use for the filter" }).optional()
				}),
				metadata: { openapi: {
					operationId: "listUsers",
					summary: "List users",
					description: "List users",
					responses: { 200: {
						description: "List of users",
						content: { "application/json": { schema: {
							type: "object",
							properties: {
								users: {
									type: "array",
									items: { $ref: "#/components/schemas/User" }
								},
								total: { type: "number" },
								limit: { type: "number" },
								offset: { type: "number" }
							},
							required: ["users", "total"]
						} } }
					} }
				} }
			}, async (ctx) => {
				const session = ctx.context.session;
				if (!hasPermission({
					userId: ctx.context.session.user.id,
					role: session.user.role,
					options: opts,
					permissions: { user: ["list"] }
				})) throw new APIError("FORBIDDEN", { message: ADMIN_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_LIST_USERS });
				const where = [];
				if (ctx.query?.searchValue) where.push({
					field: ctx.query.searchField || "email",
					operator: ctx.query.searchOperator || "contains",
					value: ctx.query.searchValue
				});
				if (ctx.query?.filterValue) where.push({
					field: ctx.query.filterField || "email",
					operator: ctx.query.filterOperator || "eq",
					value: ctx.query.filterValue
				});
				try {
					const users = await ctx.context.internalAdapter.listUsers(Number(ctx.query?.limit) || void 0, Number(ctx.query?.offset) || void 0, ctx.query?.sortBy ? {
						field: ctx.query.sortBy,
						direction: ctx.query.sortDirection || "asc"
					} : void 0, where.length ? where : void 0);
					const total = await ctx.context.internalAdapter.countTotalUsers(where.length ? where : void 0);
					return ctx.json({
						users,
						total,
						limit: Number(ctx.query?.limit) || void 0,
						offset: Number(ctx.query?.offset) || void 0
					});
				} catch (e) {
					return ctx.json({
						users: [],
						total: 0
					});
				}
			}),
			listUserSessions: createAuthEndpoint("/admin/list-user-sessions", {
				method: "POST",
				use: [adminMiddleware],
				body: z.object({ userId: z.coerce.string().meta({ description: "The user id" }) }),
				metadata: { openapi: {
					operationId: "listUserSessions",
					summary: "List user sessions",
					description: "List user sessions",
					responses: { 200: {
						description: "List of user sessions",
						content: { "application/json": { schema: {
							type: "object",
							properties: { sessions: {
								type: "array",
								items: { $ref: "#/components/schemas/Session" }
							} }
						} } }
					} }
				} }
			}, async (ctx) => {
				const session = ctx.context.session;
				if (!hasPermission({
					userId: ctx.context.session.user.id,
					role: session.user.role,
					options: opts,
					permissions: { session: ["list"] }
				})) throw new APIError("FORBIDDEN", { message: ADMIN_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_LIST_USERS_SESSIONS });
				return { sessions: await ctx.context.internalAdapter.listSessions(ctx.body.userId) };
			}),
			unbanUser: createAuthEndpoint("/admin/unban-user", {
				method: "POST",
				body: z.object({ userId: z.coerce.string().meta({ description: "The user id" }) }),
				use: [adminMiddleware],
				metadata: { openapi: {
					operationId: "unbanUser",
					summary: "Unban a user",
					description: "Unban a user",
					responses: { 200: {
						description: "User unbanned",
						content: { "application/json": { schema: {
							type: "object",
							properties: { user: { $ref: "#/components/schemas/User" } }
						} } }
					} }
				} }
			}, async (ctx) => {
				const session = ctx.context.session;
				if (!hasPermission({
					userId: ctx.context.session.user.id,
					role: session.user.role,
					options: opts,
					permissions: { user: ["ban"] }
				})) throw new APIError("FORBIDDEN", { message: ADMIN_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_BAN_USERS });
				const user = await ctx.context.internalAdapter.updateUser(ctx.body.userId, {
					banned: false,
					banExpires: null,
					banReason: null,
					updatedAt: /* @__PURE__ */ new Date()
				});
				return ctx.json({ user });
			}),
			banUser: createAuthEndpoint("/admin/ban-user", {
				method: "POST",
				body: z.object({
					userId: z.coerce.string().meta({ description: "The user id" }),
					banReason: z.string().meta({ description: "The reason for the ban" }).optional(),
					banExpiresIn: z.number().meta({ description: "The number of seconds until the ban expires" }).optional()
				}),
				use: [adminMiddleware],
				metadata: { openapi: {
					operationId: "banUser",
					summary: "Ban a user",
					description: "Ban a user",
					responses: { 200: {
						description: "User banned",
						content: { "application/json": { schema: {
							type: "object",
							properties: { user: { $ref: "#/components/schemas/User" } }
						} } }
					} }
				} }
			}, async (ctx) => {
				const session = ctx.context.session;
				if (!hasPermission({
					userId: ctx.context.session.user.id,
					role: session.user.role,
					options: opts,
					permissions: { user: ["ban"] }
				})) throw new APIError("FORBIDDEN", { message: ADMIN_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_BAN_USERS });
				if (!await ctx.context.internalAdapter.findUserById(ctx.body.userId)) throw new APIError("NOT_FOUND", { message: BASE_ERROR_CODES.USER_NOT_FOUND });
				if (ctx.body.userId === ctx.context.session.user.id) throw new APIError("BAD_REQUEST", { message: ADMIN_ERROR_CODES.YOU_CANNOT_BAN_YOURSELF });
				const user = await ctx.context.internalAdapter.updateUser(ctx.body.userId, {
					banned: true,
					banReason: ctx.body.banReason || options?.defaultBanReason || "No reason",
					banExpires: ctx.body.banExpiresIn ? getDate(ctx.body.banExpiresIn, "sec") : options?.defaultBanExpiresIn ? getDate(options.defaultBanExpiresIn, "sec") : void 0,
					updatedAt: /* @__PURE__ */ new Date()
				});
				await ctx.context.internalAdapter.deleteSessions(ctx.body.userId);
				return ctx.json({ user });
			}),
			impersonateUser: createAuthEndpoint("/admin/impersonate-user", {
				method: "POST",
				body: z.object({ userId: z.coerce.string().meta({ description: "The user id" }) }),
				use: [adminMiddleware],
				metadata: { openapi: {
					operationId: "impersonateUser",
					summary: "Impersonate a user",
					description: "Impersonate a user",
					responses: { 200: {
						description: "Impersonation session created",
						content: { "application/json": { schema: {
							type: "object",
							properties: {
								session: { $ref: "#/components/schemas/Session" },
								user: { $ref: "#/components/schemas/User" }
							}
						} } }
					} }
				} }
			}, async (ctx) => {
				if (!hasPermission({
					userId: ctx.context.session.user.id,
					role: ctx.context.session.user.role,
					options: opts,
					permissions: { user: ["impersonate"] }
				})) throw new APIError("FORBIDDEN", { message: ADMIN_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS });
				const targetUser = await ctx.context.internalAdapter.findUserById(ctx.body.userId);
				if (!targetUser) throw new APIError("NOT_FOUND", { message: "User not found" });
				const session = await ctx.context.internalAdapter.createSession(targetUser.id, true, {
					impersonatedBy: ctx.context.session.user.id,
					expiresAt: options?.impersonationSessionDuration ? getDate(options.impersonationSessionDuration, "sec") : getDate(3600, "sec")
				}, true);
				if (!session) throw new APIError("INTERNAL_SERVER_ERROR", { message: ADMIN_ERROR_CODES.FAILED_TO_CREATE_USER });
				const authCookies = ctx.context.authCookies;
				deleteSessionCookie(ctx);
				const dontRememberMeCookie = await ctx.getSignedCookie(ctx.context.authCookies.dontRememberToken.name, ctx.context.secret);
				const adminCookieProp = ctx.context.createAuthCookie("admin_session");
				await ctx.setSignedCookie(adminCookieProp.name, `${ctx.context.session.session.token}:${dontRememberMeCookie || ""}`, ctx.context.secret, authCookies.sessionToken.options);
				await setSessionCookie(ctx, {
					session,
					user: targetUser
				}, true);
				return ctx.json({
					session,
					user: targetUser
				});
			}),
			stopImpersonating: createAuthEndpoint("/admin/stop-impersonating", {
				method: "POST",
				requireHeaders: true
			}, async (ctx) => {
				const session = await getSessionFromCtx(ctx);
				if (!session) throw new APIError("UNAUTHORIZED");
				if (!session.session.impersonatedBy) throw new APIError("BAD_REQUEST", { message: "You are not impersonating anyone" });
				const user = await ctx.context.internalAdapter.findUserById(session.session.impersonatedBy);
				if (!user) throw new APIError("INTERNAL_SERVER_ERROR", { message: "Failed to find user" });
				const adminCookieName = ctx.context.createAuthCookie("admin_session").name;
				const adminCookie = await ctx.getSignedCookie(adminCookieName, ctx.context.secret);
				if (!adminCookie) throw new APIError("INTERNAL_SERVER_ERROR", { message: "Failed to find admin session" });
				const [adminSessionToken, dontRememberMeCookie] = adminCookie?.split(":");
				const adminSession = await ctx.context.internalAdapter.findSession(adminSessionToken);
				if (!adminSession || adminSession.session.userId !== user.id) throw new APIError("INTERNAL_SERVER_ERROR", { message: "Failed to find admin session" });
				await ctx.context.internalAdapter.deleteSession(session.session.token);
				await setSessionCookie(ctx, adminSession, !!dontRememberMeCookie);
				return ctx.json(adminSession);
			}),
			revokeUserSession: createAuthEndpoint("/admin/revoke-user-session", {
				method: "POST",
				body: z.object({ sessionToken: z.string().meta({ description: "The session token" }) }),
				use: [adminMiddleware],
				metadata: { openapi: {
					operationId: "revokeUserSession",
					summary: "Revoke a user session",
					description: "Revoke a user session",
					responses: { 200: {
						description: "Session revoked",
						content: { "application/json": { schema: {
							type: "object",
							properties: { success: { type: "boolean" } }
						} } }
					} }
				} }
			}, async (ctx) => {
				const session = ctx.context.session;
				if (!hasPermission({
					userId: ctx.context.session.user.id,
					role: session.user.role,
					options: opts,
					permissions: { session: ["revoke"] }
				})) throw new APIError("FORBIDDEN", { message: ADMIN_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_REVOKE_USERS_SESSIONS });
				await ctx.context.internalAdapter.deleteSession(ctx.body.sessionToken);
				return ctx.json({ success: true });
			}),
			revokeUserSessions: createAuthEndpoint("/admin/revoke-user-sessions", {
				method: "POST",
				body: z.object({ userId: z.coerce.string().meta({ description: "The user id" }) }),
				use: [adminMiddleware],
				metadata: { openapi: {
					operationId: "revokeUserSessions",
					summary: "Revoke all user sessions",
					description: "Revoke all user sessions",
					responses: { 200: {
						description: "Sessions revoked",
						content: { "application/json": { schema: {
							type: "object",
							properties: { success: { type: "boolean" } }
						} } }
					} }
				} }
			}, async (ctx) => {
				const session = ctx.context.session;
				if (!hasPermission({
					userId: ctx.context.session.user.id,
					role: session.user.role,
					options: opts,
					permissions: { session: ["revoke"] }
				})) throw new APIError("FORBIDDEN", { message: ADMIN_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_REVOKE_USERS_SESSIONS });
				await ctx.context.internalAdapter.deleteSessions(ctx.body.userId);
				return ctx.json({ success: true });
			}),
			removeUser: createAuthEndpoint("/admin/remove-user", {
				method: "POST",
				body: z.object({ userId: z.coerce.string().meta({ description: "The user id" }) }),
				use: [adminMiddleware],
				metadata: { openapi: {
					operationId: "removeUser",
					summary: "Remove a user",
					description: "Delete a user and all their sessions and accounts. Cannot be undone.",
					responses: { 200: {
						description: "User removed",
						content: { "application/json": { schema: {
							type: "object",
							properties: { success: { type: "boolean" } }
						} } }
					} }
				} }
			}, async (ctx) => {
				const session = ctx.context.session;
				if (!hasPermission({
					userId: ctx.context.session.user.id,
					role: session.user.role,
					options: opts,
					permissions: { user: ["delete"] }
				})) throw new APIError("FORBIDDEN", { message: ADMIN_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_DELETE_USERS });
				if (ctx.body.userId === ctx.context.session.user.id) throw new APIError("BAD_REQUEST", { message: ADMIN_ERROR_CODES.YOU_CANNOT_REMOVE_YOURSELF });
				if (!await ctx.context.internalAdapter.findUserById(ctx.body.userId)) throw new APIError("NOT_FOUND", { message: "User not found" });
				await ctx.context.internalAdapter.deleteUser(ctx.body.userId);
				return ctx.json({ success: true });
			}),
			setUserPassword: createAuthEndpoint("/admin/set-user-password", {
				method: "POST",
				body: z.object({
					newPassword: z.string().nonempty("newPassword cannot be empty").meta({ description: "The new password" }),
					userId: z.coerce.string().nonempty("userId cannot be empty").meta({ description: "The user id" })
				}),
				use: [adminMiddleware],
				metadata: { openapi: {
					operationId: "setUserPassword",
					summary: "Set a user's password",
					description: "Set a user's password",
					responses: { 200: {
						description: "Password set",
						content: { "application/json": { schema: {
							type: "object",
							properties: { status: { type: "boolean" } }
						} } }
					} }
				} }
			}, async (ctx) => {
				if (!hasPermission({
					userId: ctx.context.session.user.id,
					role: ctx.context.session.user.role,
					options: opts,
					permissions: { user: ["set-password"] }
				})) throw new APIError("FORBIDDEN", { message: ADMIN_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_SET_USERS_PASSWORD });
				const { newPassword, userId } = ctx.body;
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
				const hashedPassword = await ctx.context.password.hash(newPassword);
				await ctx.context.internalAdapter.updatePassword(userId, hashedPassword);
				return ctx.json({ status: true });
			}),
			userHasPermission: createAuthEndpoint("/admin/has-permission", {
				method: "POST",
				body: z.object({
					userId: z.coerce.string().optional().meta({ description: `The user id. Eg: "user-id"` }),
					role: z.string().optional().meta({ description: `The role to check permission for. Eg: "admin"` })
				}).and(z.union([z.object({
					permission: z.record(z.string(), z.array(z.string())),
					permissions: z.undefined()
				}), z.object({
					permission: z.undefined(),
					permissions: z.record(z.string(), z.array(z.string()))
				})])),
				metadata: {
					openapi: {
						description: "Check if the user has permission",
						requestBody: { content: { "application/json": { schema: {
							type: "object",
							properties: {
								permission: {
									type: "object",
									description: "The permission to check",
									deprecated: true
								},
								permissions: {
									type: "object",
									description: "The permission to check"
								}
							},
							required: ["permissions"]
						} } } },
						responses: { "200": {
							description: "Success",
							content: { "application/json": { schema: {
								type: "object",
								properties: {
									error: { type: "string" },
									success: { type: "boolean" }
								},
								required: ["success"]
							} } }
						} }
					},
					$Infer: { body: {} }
				}
			}, async (ctx) => {
				if (!ctx.body?.permission && !ctx.body?.permissions) throw new APIError("BAD_REQUEST", { message: "invalid permission check. no permission(s) were passed." });
				const session = await getSessionFromCtx(ctx);
				if (!session && (ctx.request || ctx.headers)) throw new APIError("UNAUTHORIZED");
				if (!session && !ctx.body.userId && !ctx.body.role) throw new APIError("BAD_REQUEST", { message: "user id or role is required" });
				const user = session?.user || (ctx.body.role ? {
					id: ctx.body.userId || "",
					role: ctx.body.role
				} : null) || await ctx.context.internalAdapter.findUserById(ctx.body.userId);
				if (!user) throw new APIError("BAD_REQUEST", { message: "user not found" });
				const result = hasPermission({
					userId: user.id,
					role: user.role,
					options,
					permissions: ctx.body.permissions ?? ctx.body.permission
				});
				return ctx.json({
					error: null,
					success: result
				});
			})
		},
		$ERROR_CODES: ADMIN_ERROR_CODES,
		schema: mergeSchema(schema, opts.schema),
		options
	};
};

//#endregion
export { admin as t };