import { t as createKyselyAdapter } from "./dialect-BvcuosDD.mjs";
import { a as getAuthTables, n as initGetFieldName, t as initGetModelName } from "./get-model-name-D4DUV7S2.mjs";
import { t as generateId } from "./utils-DBbaShi0.mjs";
import { l as parseUserOutput, s as parseSessionOutput, u as getDate } from "./schema-CSB7dlK0.mjs";
import { t as getIp } from "./get-request-ip-RYTz2Uba.mjs";
import { t as safeJSONParse } from "./json-_HMgPUVh.mjs";
import { getCurrentAdapter, getCurrentAuthContext, runWithTransaction } from "@better-auth/core/context";
import { createLogger, logger } from "@better-auth/core/env";
import { BetterAuthError } from "@better-auth/core/error";
import { sql } from "kysely";
import * as z from "zod";

//#region src/db/adapter-base.ts
async function getBaseAdapter(options, handleDirectDatabase) {
	let adapter;
	if (!options.database) {
		const tables = getAuthTables(options);
		const memoryDB = Object.keys(tables).reduce((acc, key) => {
			acc[key] = [];
			return acc;
		}, {});
		const { memoryAdapter } = await import("./adapters/memory-adapter/index.mjs");
		adapter = memoryAdapter(memoryDB)(options);
	} else if (typeof options.database === "function") adapter = options.database(options);
	else adapter = await handleDirectDatabase(options);
	if (!adapter.transaction) {
		logger.warn("Adapter does not correctly implement transaction function, patching it automatically. Please update your adapter implementation.");
		adapter.transaction = async (cb) => {
			return cb(adapter);
		};
	}
	return adapter;
}

//#endregion
//#region src/db/adapter-kysely.ts
async function getAdapter(options) {
	return getBaseAdapter(options, async (opts) => {
		const { createKyselyAdapter: createKyselyAdapter$1 } = await import("./adapters/kysely-adapter/index.mjs");
		const { kysely, databaseType, transaction } = await createKyselyAdapter$1(opts);
		if (!kysely) throw new BetterAuthError("Failed to initialize database adapter");
		const { kyselyAdapter } = await import("./adapters/kysely-adapter/index.mjs");
		return kyselyAdapter(kysely, {
			type: databaseType || "sqlite",
			debugLogs: opts.database && "debugLogs" in opts.database ? opts.database.debugLogs : false,
			transaction
		})(opts);
	});
}

//#endregion
//#region src/db/field.ts
const createFieldAttribute = (type, config) => {
	return {
		type,
		...config
	};
};

//#endregion
//#region src/db/field-converter.ts
function convertToDB(fields, values) {
	let result = values.id ? { id: values.id } : {};
	for (const key in fields) {
		const field = fields[key];
		const value = values[key];
		if (value === void 0) continue;
		result[field.fieldName || key] = value;
	}
	return result;
}
function convertFromDB(fields, values) {
	if (!values) return null;
	let result = { id: values.id };
	for (const [key, value] of Object.entries(fields)) result[key] = values[value.fieldName || key];
	return result;
}

//#endregion
//#region src/db/with-hooks.ts
function getWithHooks(adapter, ctx) {
	const hooks = ctx.hooks;
	async function createWithHooks(data, model, customCreateFn) {
		const context = await getCurrentAuthContext();
		let actualData = data;
		for (const hook of hooks || []) {
			const toRun = hook[model]?.create?.before;
			if (toRun) {
				const result = await toRun(actualData, context);
				if (result === false) return null;
				if (typeof result === "object" && "data" in result) actualData = {
					...actualData,
					...result.data
				};
			}
		}
		const customCreated = customCreateFn ? await customCreateFn.fn(actualData) : null;
		const created = !customCreateFn || customCreateFn.executeMainFn ? await (await getCurrentAdapter(adapter)).create({
			model,
			data: actualData,
			forceAllowId: true
		}) : customCreated;
		for (const hook of hooks || []) {
			const toRun = hook[model]?.create?.after;
			if (toRun) await toRun(created, context);
		}
		return created;
	}
	async function updateWithHooks(data, where, model, customUpdateFn) {
		const context = await getCurrentAuthContext();
		let actualData = data;
		for (const hook of hooks || []) {
			const toRun = hook[model]?.update?.before;
			if (toRun) {
				const result = await toRun(data, context);
				if (result === false) return null;
				if (typeof result === "object" && "data" in result) actualData = {
					...actualData,
					...result.data
				};
			}
		}
		const customUpdated = customUpdateFn ? await customUpdateFn.fn(actualData) : null;
		const updated = !customUpdateFn || customUpdateFn.executeMainFn ? await (await getCurrentAdapter(adapter)).update({
			model,
			update: actualData,
			where
		}) : customUpdated;
		for (const hook of hooks || []) {
			const toRun = hook[model]?.update?.after;
			if (toRun) await toRun(updated, context);
		}
		return updated;
	}
	async function updateManyWithHooks(data, where, model, customUpdateFn) {
		const context = await getCurrentAuthContext();
		let actualData = data;
		for (const hook of hooks || []) {
			const toRun = hook[model]?.update?.before;
			if (toRun) {
				const result = await toRun(data, context);
				if (result === false) return null;
				if (typeof result === "object" && "data" in result) actualData = {
					...actualData,
					...result.data
				};
			}
		}
		const customUpdated = customUpdateFn ? await customUpdateFn.fn(actualData) : null;
		const updated = !customUpdateFn || customUpdateFn.executeMainFn ? await (await getCurrentAdapter(adapter)).updateMany({
			model,
			update: actualData,
			where
		}) : customUpdated;
		for (const hook of hooks || []) {
			const toRun = hook[model]?.update?.after;
			if (toRun) await toRun(updated, context);
		}
		return updated;
	}
	async function deleteWithHooks(where, model, customDeleteFn) {
		const context = await getCurrentAuthContext();
		let entityToDelete = null;
		try {
			entityToDelete = (await (await getCurrentAdapter(adapter)).findMany({
				model,
				where,
				limit: 1
			}))[0] || null;
		} catch (error) {}
		if (entityToDelete) for (const hook of hooks || []) {
			const toRun = hook[model]?.delete?.before;
			if (toRun) {
				if (await toRun(entityToDelete, context) === false) return null;
			}
		}
		const customDeleted = customDeleteFn ? await customDeleteFn.fn(where) : null;
		const deleted = !customDeleteFn || customDeleteFn.executeMainFn ? await (await getCurrentAdapter(adapter)).delete({
			model,
			where
		}) : customDeleted;
		if (entityToDelete) for (const hook of hooks || []) {
			const toRun = hook[model]?.delete?.after;
			if (toRun) await toRun(entityToDelete, context);
		}
		return deleted;
	}
	async function deleteManyWithHooks(where, model, customDeleteFn) {
		const context = await getCurrentAuthContext();
		let entitiesToDelete = [];
		try {
			entitiesToDelete = await (await getCurrentAdapter(adapter)).findMany({
				model,
				where
			});
		} catch (error) {}
		for (const entity of entitiesToDelete) for (const hook of hooks || []) {
			const toRun = hook[model]?.delete?.before;
			if (toRun) {
				if (await toRun(entity, context) === false) return null;
			}
		}
		const customDeleted = customDeleteFn ? await customDeleteFn.fn(where) : null;
		const deleted = !customDeleteFn || customDeleteFn.executeMainFn ? await (await getCurrentAdapter(adapter)).deleteMany({
			model,
			where
		}) : customDeleted;
		for (const entity of entitiesToDelete) for (const hook of hooks || []) {
			const toRun = hook[model]?.delete?.after;
			if (toRun) await toRun(entity, context);
		}
		return deleted;
	}
	return {
		createWithHooks,
		updateWithHooks,
		updateManyWithHooks,
		deleteWithHooks,
		deleteManyWithHooks
	};
}

//#endregion
//#region src/db/internal-adapter.ts
const createInternalAdapter = (adapter, ctx) => {
	const logger$1 = ctx.logger;
	const options = ctx.options;
	const secondaryStorage = options.secondaryStorage;
	const sessionExpiration = options.session?.expiresIn || 3600 * 24 * 7;
	const { createWithHooks, updateWithHooks, updateManyWithHooks, deleteWithHooks, deleteManyWithHooks } = getWithHooks(adapter, ctx);
	async function refreshUserSessions(user) {
		if (!secondaryStorage) return;
		const listRaw = await secondaryStorage.get(`active-sessions-${user.id}`);
		if (!listRaw) return;
		const now = Date.now();
		const validSessions = (safeJSONParse(listRaw) || []).filter((s) => s.expiresAt > now);
		await Promise.all(validSessions.map(async ({ token }) => {
			const cached = await secondaryStorage.get(token);
			if (!cached) return;
			const parsed = safeJSONParse(cached);
			if (!parsed) return;
			const sessionTTL = Math.max(Math.floor(new Date(parsed.session.expiresAt).getTime() - now) / 1e3, 0);
			await secondaryStorage.set(token, JSON.stringify({
				session: parsed.session,
				user
			}), Math.floor(sessionTTL));
		}));
	}
	return {
		createOAuthUser: async (user, account) => {
			return runWithTransaction(adapter, async () => {
				const createdUser = await createWithHooks({
					createdAt: /* @__PURE__ */ new Date(),
					updatedAt: /* @__PURE__ */ new Date(),
					...user
				}, "user", void 0);
				return {
					user: createdUser,
					account: await createWithHooks({
						...account,
						userId: createdUser.id,
						createdAt: /* @__PURE__ */ new Date(),
						updatedAt: /* @__PURE__ */ new Date()
					}, "account", void 0)
				};
			});
		},
		createUser: async (user) => {
			return await createWithHooks({
				createdAt: /* @__PURE__ */ new Date(),
				updatedAt: /* @__PURE__ */ new Date(),
				...user,
				email: user.email?.toLowerCase()
			}, "user", void 0);
		},
		createAccount: async (account) => {
			return await createWithHooks({
				createdAt: /* @__PURE__ */ new Date(),
				updatedAt: /* @__PURE__ */ new Date(),
				...account
			}, "account", void 0);
		},
		listSessions: async (userId) => {
			if (secondaryStorage) {
				const currentList = await secondaryStorage.get(`active-sessions-${userId}`);
				if (!currentList) return [];
				const list = safeJSONParse(currentList) || [];
				const now = Date.now();
				const validSessions = list.filter((s) => s.expiresAt > now);
				const sessions = [];
				for (const session of validSessions) {
					const sessionStringified = await secondaryStorage.get(session.token);
					if (sessionStringified) {
						const s = safeJSONParse(sessionStringified);
						if (!s) return [];
						const parsedSession = parseSessionOutput(ctx.options, {
							...s.session,
							expiresAt: new Date(s.session.expiresAt)
						});
						sessions.push(parsedSession);
					}
				}
				return sessions;
			}
			return await (await getCurrentAdapter(adapter)).findMany({
				model: "session",
				where: [{
					field: "userId",
					value: userId
				}]
			});
		},
		listUsers: async (limit, offset, sortBy, where) => {
			return await (await getCurrentAdapter(adapter)).findMany({
				model: "user",
				limit,
				offset,
				sortBy,
				where
			});
		},
		countTotalUsers: async (where) => {
			const total = await (await getCurrentAdapter(adapter)).count({
				model: "user",
				where
			});
			if (typeof total === "string") return parseInt(total);
			return total;
		},
		deleteUser: async (userId) => {
			if (secondaryStorage) await secondaryStorage.delete(`active-sessions-${userId}`);
			if (!secondaryStorage || options.session?.storeSessionInDatabase) await deleteManyWithHooks([{
				field: "userId",
				value: userId
			}], "session", void 0);
			await deleteManyWithHooks([{
				field: "userId",
				value: userId
			}], "account", void 0);
			await deleteWithHooks([{
				field: "id",
				value: userId
			}], "user", void 0);
		},
		createSession: async (userId, dontRememberMe, override, overrideAll) => {
			const ctx$1 = await getCurrentAuthContext();
			const headers = ctx$1.headers || ctx$1.request?.headers;
			const { id: _, ...rest } = override || {};
			const data = {
				ipAddress: ctx$1.request || ctx$1.headers ? getIp(ctx$1.request || ctx$1.headers, ctx$1.context.options) || "" : "",
				userAgent: headers?.get("user-agent") || "",
				...rest,
				expiresAt: dontRememberMe ? getDate(3600 * 24, "sec") : getDate(sessionExpiration, "sec"),
				userId,
				token: generateId(32),
				createdAt: /* @__PURE__ */ new Date(),
				updatedAt: /* @__PURE__ */ new Date(),
				...overrideAll ? rest : {}
			};
			return await createWithHooks(data, "session", secondaryStorage ? {
				fn: async (sessionData) => {
					/**
					* store the session token for the user
					* so we can retrieve it later for listing sessions
					*/
					const currentList = await secondaryStorage.get(`active-sessions-${userId}`);
					let list = [];
					const now = Date.now();
					if (currentList) {
						list = safeJSONParse(currentList) || [];
						list = list.filter((session) => session.expiresAt > now);
					}
					const sorted = list.sort((a, b) => a.expiresAt - b.expiresAt);
					let furthestSessionExp = sorted.at(-1)?.expiresAt;
					sorted.push({
						token: data.token,
						expiresAt: data.expiresAt.getTime()
					});
					if (!furthestSessionExp || furthestSessionExp < data.expiresAt.getTime()) furthestSessionExp = data.expiresAt.getTime();
					const furthestSessionTTL = Math.max(Math.floor((furthestSessionExp - now) / 1e3), 0);
					if (furthestSessionTTL > 0) await secondaryStorage.set(`active-sessions-${userId}`, JSON.stringify(sorted), furthestSessionTTL);
					const user = await adapter.findOne({
						model: "user",
						where: [{
							field: "id",
							value: userId
						}]
					});
					const sessionTTL = Math.max(Math.floor((data.expiresAt.getTime() - now) / 1e3), 0);
					if (sessionTTL > 0) await secondaryStorage.set(data.token, JSON.stringify({
						session: sessionData,
						user
					}), sessionTTL);
					return sessionData;
				},
				executeMainFn: options.session?.storeSessionInDatabase
			} : void 0);
		},
		findSession: async (token) => {
			if (secondaryStorage) {
				const sessionStringified = await secondaryStorage.get(token);
				if (!sessionStringified && !options.session?.storeSessionInDatabase) return null;
				if (sessionStringified) {
					const s = safeJSONParse(sessionStringified);
					if (!s) return null;
					return {
						session: parseSessionOutput(ctx.options, {
							...s.session,
							expiresAt: new Date(s.session.expiresAt),
							createdAt: new Date(s.session.createdAt),
							updatedAt: new Date(s.session.updatedAt)
						}),
						user: parseUserOutput(ctx.options, {
							...s.user,
							createdAt: new Date(s.user.createdAt),
							updatedAt: new Date(s.user.updatedAt)
						})
					};
				}
			}
			const result = await (await getCurrentAdapter(adapter)).findOne({
				model: "session",
				where: [{
					value: token,
					field: "token"
				}],
				join: { user: true }
			});
			if (!result) return null;
			const { user, ...session } = result;
			if (!user) return null;
			return {
				session: parseSessionOutput(ctx.options, session),
				user: parseUserOutput(ctx.options, user)
			};
		},
		findSessions: async (sessionTokens) => {
			if (secondaryStorage) {
				const sessions$1 = [];
				for (const sessionToken of sessionTokens) {
					const sessionStringified = await secondaryStorage.get(sessionToken);
					if (sessionStringified) {
						const s = safeJSONParse(sessionStringified);
						if (!s) return [];
						const session = {
							session: {
								...s.session,
								expiresAt: new Date(s.session.expiresAt)
							},
							user: {
								...s.user,
								createdAt: new Date(s.user.createdAt),
								updatedAt: new Date(s.user.updatedAt)
							}
						};
						sessions$1.push(session);
					}
				}
				return sessions$1;
			}
			const sessions = await (await getCurrentAdapter(adapter)).findMany({
				model: "session",
				where: [{
					field: "token",
					value: sessionTokens,
					operator: "in"
				}],
				join: { user: true }
			});
			if (!sessions.length) return [];
			if (sessions.some((session) => !session.user)) return [];
			return sessions.map((_session) => {
				const { user, ...session } = _session;
				return {
					session,
					user
				};
			});
		},
		updateSession: async (sessionToken, session) => {
			return await updateWithHooks(session, [{
				field: "token",
				value: sessionToken
			}], "session", secondaryStorage ? {
				async fn(data) {
					const currentSession = await secondaryStorage.get(sessionToken);
					let updatedSession = null;
					if (currentSession) {
						const parsedSession = safeJSONParse(currentSession);
						if (!parsedSession) return null;
						updatedSession = {
							...parsedSession.session,
							...data
						};
						return updatedSession;
					} else return null;
				},
				executeMainFn: options.session?.storeSessionInDatabase
			} : void 0);
		},
		deleteSession: async (token) => {
			if (secondaryStorage) {
				const data = await secondaryStorage.get(token);
				if (data) {
					const { session } = safeJSONParse(data) ?? {};
					if (!session) {
						logger$1.error("Session not found in secondary storage");
						return;
					}
					const userId = session.userId;
					const currentList = await secondaryStorage.get(`active-sessions-${userId}`);
					if (currentList) {
						let list = safeJSONParse(currentList) || [];
						const now = Date.now();
						const filtered = list.filter((session$1) => session$1.expiresAt > now && session$1.token !== token);
						const furthestSessionExp = filtered.sort((a, b) => a.expiresAt - b.expiresAt).at(-1)?.expiresAt;
						if (filtered.length > 0 && furthestSessionExp && furthestSessionExp > Date.now()) await secondaryStorage.set(`active-sessions-${userId}`, JSON.stringify(filtered), Math.floor((furthestSessionExp - now) / 1e3));
						else await secondaryStorage.delete(`active-sessions-${userId}`);
					} else logger$1.error("Active sessions list not found in secondary storage");
				}
				await secondaryStorage.delete(token);
				if (!options.session?.storeSessionInDatabase || ctx.options.session?.preserveSessionInDatabase) return;
			}
			await (await getCurrentAdapter(adapter)).delete({
				model: "session",
				where: [{
					field: "token",
					value: token
				}]
			});
		},
		deleteAccounts: async (userId) => {
			await deleteManyWithHooks([{
				field: "userId",
				value: userId
			}], "account", void 0);
		},
		deleteAccount: async (accountId) => {
			await deleteWithHooks([{
				field: "id",
				value: accountId
			}], "account", void 0);
		},
		deleteSessions: async (userIdOrSessionTokens) => {
			if (secondaryStorage) {
				if (typeof userIdOrSessionTokens === "string") {
					const activeSession = await secondaryStorage.get(`active-sessions-${userIdOrSessionTokens}`);
					const sessions = activeSession ? safeJSONParse(activeSession) : [];
					if (!sessions) return;
					for (const session of sessions) await secondaryStorage.delete(session.token);
				} else for (const sessionToken of userIdOrSessionTokens) if (await secondaryStorage.get(sessionToken)) await secondaryStorage.delete(sessionToken);
				if (!options.session?.storeSessionInDatabase || ctx.options.session?.preserveSessionInDatabase) return;
			}
			await deleteManyWithHooks([{
				field: Array.isArray(userIdOrSessionTokens) ? "token" : "userId",
				value: userIdOrSessionTokens,
				operator: Array.isArray(userIdOrSessionTokens) ? "in" : void 0
			}], "session", void 0);
		},
		findOAuthUser: async (email, accountId, providerId) => {
			const account = await (await getCurrentAdapter(adapter)).findMany({
				model: "account",
				where: [{
					value: accountId,
					field: "accountId"
				}],
				join: { user: true }
			}).then((accounts) => {
				return accounts.find((a) => a.providerId === providerId);
			});
			if (account) if (account.user) return {
				user: account.user,
				accounts: [account]
			};
			else {
				const user = await (await getCurrentAdapter(adapter)).findOne({
					model: "user",
					where: [{
						value: email.toLowerCase(),
						field: "email"
					}]
				});
				if (user) return {
					user,
					accounts: [account]
				};
				return null;
			}
			else {
				const user = await (await getCurrentAdapter(adapter)).findOne({
					model: "user",
					where: [{
						value: email.toLowerCase(),
						field: "email"
					}]
				});
				if (user) return {
					user,
					accounts: await (await getCurrentAdapter(adapter)).findMany({
						model: "account",
						where: [{
							value: user.id,
							field: "userId"
						}]
					}) || []
				};
				else return null;
			}
		},
		findUserByEmail: async (email, options$1) => {
			const result = await (await getCurrentAdapter(adapter)).findOne({
				model: "user",
				where: [{
					value: email.toLowerCase(),
					field: "email"
				}],
				join: { ...options$1?.includeAccounts ? { account: true } : {} }
			});
			if (!result) return null;
			const { account: accounts, ...user } = result;
			return {
				user,
				accounts: accounts ?? []
			};
		},
		findUserById: async (userId) => {
			return await (await getCurrentAdapter(adapter)).findOne({
				model: "user",
				where: [{
					field: "id",
					value: userId
				}]
			});
		},
		linkAccount: async (account) => {
			return await createWithHooks({
				createdAt: /* @__PURE__ */ new Date(),
				updatedAt: /* @__PURE__ */ new Date(),
				...account
			}, "account", void 0);
		},
		updateUser: async (userId, data) => {
			const user = await updateWithHooks(data, [{
				field: "id",
				value: userId
			}], "user", void 0);
			await refreshUserSessions(user);
			await refreshUserSessions(user);
			return user;
		},
		updateUserByEmail: async (email, data) => {
			const user = await updateWithHooks(data, [{
				field: "email",
				value: email.toLowerCase()
			}], "user", void 0);
			await refreshUserSessions(user);
			await refreshUserSessions(user);
			return user;
		},
		updatePassword: async (userId, password) => {
			await updateManyWithHooks({ password }, [{
				field: "userId",
				value: userId
			}, {
				field: "providerId",
				value: "credential"
			}], "account", void 0);
		},
		findAccounts: async (userId) => {
			return await (await getCurrentAdapter(adapter)).findMany({
				model: "account",
				where: [{
					field: "userId",
					value: userId
				}]
			});
		},
		findAccount: async (accountId) => {
			return await (await getCurrentAdapter(adapter)).findOne({
				model: "account",
				where: [{
					field: "accountId",
					value: accountId
				}]
			});
		},
		findAccountByProviderId: async (accountId, providerId) => {
			return await (await getCurrentAdapter(adapter)).findOne({
				model: "account",
				where: [{
					field: "accountId",
					value: accountId
				}, {
					field: "providerId",
					value: providerId
				}]
			});
		},
		findAccountByUserId: async (userId) => {
			return await (await getCurrentAdapter(adapter)).findMany({
				model: "account",
				where: [{
					field: "userId",
					value: userId
				}]
			});
		},
		updateAccount: async (id, data) => {
			return await updateWithHooks(data, [{
				field: "id",
				value: id
			}], "account", void 0);
		},
		createVerificationValue: async (data) => {
			return await createWithHooks({
				createdAt: /* @__PURE__ */ new Date(),
				updatedAt: /* @__PURE__ */ new Date(),
				...data
			}, "verification", void 0);
		},
		findVerificationValue: async (identifier) => {
			const verification = await (await getCurrentAdapter(adapter)).findMany({
				model: "verification",
				where: [{
					field: "identifier",
					value: identifier
				}],
				sortBy: {
					field: "createdAt",
					direction: "desc"
				},
				limit: 1
			});
			if (!options.verification?.disableCleanup) await (await getCurrentAdapter(adapter)).deleteMany({
				model: "verification",
				where: [{
					field: "expiresAt",
					value: /* @__PURE__ */ new Date(),
					operator: "lt"
				}]
			});
			return verification[0];
		},
		deleteVerificationValue: async (id) => {
			await (await getCurrentAdapter(adapter)).delete({
				model: "verification",
				where: [{
					field: "id",
					value: id
				}]
			});
		},
		deleteVerificationByIdentifier: async (identifier) => {
			await (await getCurrentAdapter(adapter)).delete({
				model: "verification",
				where: [{
					field: "identifier",
					value: identifier
				}]
			});
		},
		updateVerificationValue: async (id, data) => {
			return await updateWithHooks(data, [{
				field: "id",
				value: id
			}], "verification", void 0);
		}
	};
};

//#endregion
//#region src/db/to-zod.ts
function toZodSchema({ fields, isClientSide }) {
	const zodFields = Object.keys(fields).reduce((acc, key) => {
		const field = fields[key];
		if (!field) return acc;
		if (isClientSide && field.input === false) return acc;
		let schema;
		if (field.type === "json") schema = z.json ? z.json() : z.any();
		else if (field.type === "string[]" || field.type === "number[]") schema = z.array(field.type === "string[]" ? z.string() : z.number());
		else if (Array.isArray(field.type)) schema = z.any();
		else schema = z[field.type]();
		if (field?.required === false) schema = schema.optional();
		if (field?.returned === false) return acc;
		return {
			...acc,
			[key]: schema
		};
	}, {});
	return z.object(zodFields);
}

//#endregion
//#region src/db/get-schema.ts
function getSchema(config) {
	const tables = getAuthTables(config);
	let schema = {};
	for (const key in tables) {
		const table = tables[key];
		const fields = table.fields;
		let actualFields = {};
		Object.entries(fields).forEach(([key$1, field]) => {
			actualFields[field.fieldName || key$1] = field;
			if (field.references) {
				const refTable = tables[field.references.model];
				if (refTable) actualFields[field.fieldName || key$1].references = {
					...field.references,
					model: refTable.modelName,
					field: field.references.field
				};
			}
		});
		if (schema[table.modelName]) {
			schema[table.modelName].fields = {
				...schema[table.modelName].fields,
				...actualFields
			};
			continue;
		}
		schema[table.modelName] = {
			fields: actualFields,
			order: table.order || Infinity
		};
	}
	return schema;
}

//#endregion
//#region src/db/get-migration.ts
const map = {
	postgres: {
		string: [
			"character varying",
			"varchar",
			"text",
			"uuid"
		],
		number: [
			"int4",
			"integer",
			"bigint",
			"smallint",
			"numeric",
			"real",
			"double precision"
		],
		boolean: ["bool", "boolean"],
		date: [
			"timestamptz",
			"timestamp",
			"date"
		],
		json: ["json", "jsonb"]
	},
	mysql: {
		string: [
			"varchar",
			"text",
			"uuid"
		],
		number: [
			"integer",
			"int",
			"bigint",
			"smallint",
			"decimal",
			"float",
			"double"
		],
		boolean: ["boolean", "tinyint"],
		date: [
			"timestamp",
			"datetime",
			"date"
		],
		json: ["json"]
	},
	sqlite: {
		string: ["TEXT"],
		number: ["INTEGER", "REAL"],
		boolean: ["INTEGER", "BOOLEAN"],
		date: ["DATE", "INTEGER"],
		json: ["TEXT"]
	},
	mssql: {
		string: [
			"varchar",
			"nvarchar",
			"uniqueidentifier"
		],
		number: [
			"int",
			"bigint",
			"smallint",
			"decimal",
			"float",
			"double"
		],
		boolean: ["bit", "smallint"],
		date: [
			"datetime2",
			"date",
			"datetime"
		],
		json: ["varchar", "nvarchar"]
	}
};
function matchType(columnDataType, fieldType, dbType) {
	function normalize(type) {
		return type.toLowerCase().split("(")[0].trim();
	}
	if (fieldType === "string[]" || fieldType === "number[]") return columnDataType.toLowerCase().includes("json");
	const types = map[dbType];
	return (Array.isArray(fieldType) ? types["string"].map((t) => t.toLowerCase()) : types[fieldType].map((t) => t.toLowerCase())).includes(normalize(columnDataType));
}
/**
* Get the current PostgreSQL schema (search_path) for the database connection
* Returns the first schema in the search_path, defaulting to 'public' if not found
*/
async function getPostgresSchema(db) {
	try {
		const result = await sql`SHOW search_path`.execute(db);
		if (result.rows[0]?.search_path) return result.rows[0].search_path.split(",").map((s) => s.trim()).map((s) => s.replace(/^["']|["']$/g, "")).filter((s) => !s.startsWith("$"))[0] || "public";
	} catch (error) {}
	return "public";
}
async function getMigrations(config) {
	const betterAuthSchema = getSchema(config);
	const logger$1 = createLogger(config.logger);
	let { kysely: db, databaseType: dbType } = await createKyselyAdapter(config);
	if (!dbType) {
		logger$1.warn("Could not determine database type, defaulting to sqlite. Please provide a type in the database options to avoid this.");
		dbType = "sqlite";
	}
	if (!db) {
		logger$1.error("Only kysely adapter is supported for migrations. You can use `generate` command to generate the schema, if you're using a different adapter.");
		process.exit(1);
	}
	let currentSchema = "public";
	if (dbType === "postgres") {
		currentSchema = await getPostgresSchema(db);
		logger$1.debug(`PostgreSQL migration: Using schema '${currentSchema}' (from search_path)`);
		try {
			if (!(await sql`
				SELECT schema_name 
				FROM information_schema.schemata 
				WHERE schema_name = ${currentSchema}
			`.execute(db)).rows[0]) logger$1.warn(`Schema '${currentSchema}' does not exist. Tables will be inspected from available schemas. Consider creating the schema first or checking your database configuration.`);
		} catch (error) {
			logger$1.debug(`Could not verify schema existence: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	const allTableMetadata = await db.introspection.getTables();
	let tableMetadata = allTableMetadata;
	if (dbType === "postgres") try {
		const tablesInSchema = await sql`
				SELECT table_name 
				FROM information_schema.tables 
				WHERE table_schema = ${currentSchema}
				AND table_type = 'BASE TABLE'
			`.execute(db);
		const tableNamesInSchema = new Set(tablesInSchema.rows.map((row) => row.table_name));
		tableMetadata = allTableMetadata.filter((table) => table.schema === currentSchema && tableNamesInSchema.has(table.name));
		logger$1.debug(`Found ${tableMetadata.length} table(s) in schema '${currentSchema}': ${tableMetadata.map((t) => t.name).join(", ") || "(none)"}`);
	} catch (error) {
		logger$1.warn(`Could not filter tables by schema. Using all discovered tables. Error: ${error instanceof Error ? error.message : String(error)}`);
	}
	const toBeCreated = [];
	const toBeAdded = [];
	for (const [key, value] of Object.entries(betterAuthSchema)) {
		const table = tableMetadata.find((t) => t.name === key);
		if (!table) {
			const tIndex = toBeCreated.findIndex((t) => t.table === key);
			const tableData = {
				table: key,
				fields: value.fields,
				order: value.order || Infinity
			};
			const insertIndex = toBeCreated.findIndex((t) => (t.order || Infinity) > tableData.order);
			if (insertIndex === -1) if (tIndex === -1) toBeCreated.push(tableData);
			else toBeCreated[tIndex].fields = {
				...toBeCreated[tIndex].fields,
				...value.fields
			};
			else toBeCreated.splice(insertIndex, 0, tableData);
			continue;
		}
		let toBeAddedFields = {};
		for (const [fieldName, field] of Object.entries(value.fields)) {
			const column = table.columns.find((c) => c.name === fieldName);
			if (!column) {
				toBeAddedFields[fieldName] = field;
				continue;
			}
			if (matchType(column.dataType, field.type, dbType)) continue;
			else logger$1.warn(`Field ${fieldName} in table ${key} has a different type in the database. Expected ${field.type} but got ${column.dataType}.`);
		}
		if (Object.keys(toBeAddedFields).length > 0) toBeAdded.push({
			table: key,
			fields: toBeAddedFields,
			order: value.order || Infinity
		});
	}
	const migrations = [];
	const useUUIDs = config.advanced?.database?.generateId === "uuid";
	const useNumberId = config.advanced?.database?.useNumberId || config.advanced?.database?.generateId === "serial";
	function getType(field, fieldName) {
		const type = field.type;
		const typeMap = {
			string: {
				sqlite: "text",
				postgres: "text",
				mysql: field.unique ? "varchar(255)" : field.references ? "varchar(36)" : field.sortable ? "varchar(255)" : field.index ? "varchar(255)" : "text",
				mssql: field.unique || field.sortable ? "varchar(255)" : field.references ? "varchar(36)" : "varchar(8000)"
			},
			boolean: {
				sqlite: "integer",
				postgres: "boolean",
				mysql: "boolean",
				mssql: "smallint"
			},
			number: {
				sqlite: field.bigint ? "bigint" : "integer",
				postgres: field.bigint ? "bigint" : "integer",
				mysql: field.bigint ? "bigint" : "integer",
				mssql: field.bigint ? "bigint" : "integer"
			},
			date: {
				sqlite: "date",
				postgres: "timestamptz",
				mysql: "timestamp(3)",
				mssql: sql`datetime2(3)`
			},
			json: {
				sqlite: "text",
				postgres: "jsonb",
				mysql: "json",
				mssql: "varchar(8000)"
			},
			id: {
				postgres: useNumberId ? sql`integer GENERATED BY DEFAULT AS IDENTITY` : useUUIDs ? "uuid" : "text",
				mysql: useNumberId ? "integer" : useUUIDs ? "varchar(36)" : "varchar(36)",
				mssql: useNumberId ? "integer" : useUUIDs ? "varchar(36)" : "varchar(36)",
				sqlite: useNumberId ? "integer" : "text"
			},
			foreignKeyId: {
				postgres: useNumberId ? "integer" : useUUIDs ? "uuid" : "text",
				mysql: useNumberId ? "integer" : useUUIDs ? "varchar(36)" : "varchar(36)",
				mssql: useNumberId ? "integer" : useUUIDs ? "varchar(36)" : "varchar(36)",
				sqlite: useNumberId ? "integer" : "text"
			}
		};
		if (fieldName === "id" || field.references?.field === "id") {
			if (fieldName === "id") return typeMap.id[dbType];
			return typeMap.foreignKeyId[dbType];
		}
		if (dbType === "sqlite" && (type === "string[]" || type === "number[]")) return "text";
		if (type === "string[]" || type === "number[]") return "jsonb";
		if (Array.isArray(type)) return "text";
		return typeMap[type][dbType || "sqlite"];
	}
	const getModelName = initGetModelName({
		schema: getAuthTables(config),
		usePlural: false
	});
	const getFieldName = initGetFieldName({
		schema: getAuthTables(config),
		usePlural: false
	});
	function getReferencePath(model, field) {
		try {
			return `${getModelName(model)}.${getFieldName({
				model,
				field
			})}`;
		} catch {
			return `${model}.${field}`;
		}
	}
	if (toBeAdded.length) for (const table of toBeAdded) for (const [fieldName, field] of Object.entries(table.fields)) {
		const type = getType(field, fieldName);
		let builder = db.schema.alterTable(table.table);
		if (field.index) {
			const index = db.schema.alterTable(table.table).addIndex(`${table.table}_${fieldName}_idx`);
			migrations.push(index);
		}
		let built = builder.addColumn(fieldName, type, (col) => {
			col = field.required !== false ? col.notNull() : col;
			if (field.references) col = col.references(getReferencePath(field.references.model, field.references.field)).onDelete(field.references.onDelete || "cascade");
			if (field.unique) col = col.unique();
			if (field.type === "date" && typeof field.defaultValue === "function" && (dbType === "postgres" || dbType === "mysql" || dbType === "mssql")) if (dbType === "mysql") col = col.defaultTo(sql`CURRENT_TIMESTAMP(3)`);
			else col = col.defaultTo(sql`CURRENT_TIMESTAMP`);
			return col;
		});
		migrations.push(built);
	}
	let toBeIndexed = [];
	if (config.advanced?.database?.useNumberId) logger$1.warn("`useNumberId` is deprecated. Please use `generateId` with `serial` instead.");
	if (toBeCreated.length) for (const table of toBeCreated) {
		const idType = getType({ type: useNumberId ? "number" : "string" }, "id");
		let dbT = db.schema.createTable(table.table).addColumn("id", idType, (col) => {
			if (useNumberId) {
				if (dbType === "postgres") return col.primaryKey().notNull();
				else if (dbType === "sqlite") return col.primaryKey().notNull();
				else if (dbType === "mssql") return col.identity().primaryKey().notNull();
				return col.autoIncrement().primaryKey().notNull();
			}
			if (useUUIDs) {
				if (dbType === "postgres") return col.primaryKey().defaultTo(sql`pg_catalog.gen_random_uuid()`).notNull();
				return col.primaryKey().notNull();
			}
			return col.primaryKey().notNull();
		});
		for (const [fieldName, field] of Object.entries(table.fields)) {
			const type = getType(field, fieldName);
			dbT = dbT.addColumn(fieldName, type, (col) => {
				col = field.required !== false ? col.notNull() : col;
				if (field.references) col = col.references(getReferencePath(field.references.model, field.references.field)).onDelete(field.references.onDelete || "cascade");
				if (field.unique) col = col.unique();
				if (field.type === "date" && typeof field.defaultValue === "function" && (dbType === "postgres" || dbType === "mysql" || dbType === "mssql")) if (dbType === "mysql") col = col.defaultTo(sql`CURRENT_TIMESTAMP(3)`);
				else col = col.defaultTo(sql`CURRENT_TIMESTAMP`);
				return col;
			});
			if (field.index) {
				let builder = db.schema.createIndex(`${table.table}_${fieldName}_${field.unique ? "uidx" : "idx"}`).on(table.table).columns([fieldName]);
				toBeIndexed.push(field.unique ? builder.unique() : builder);
			}
		}
		migrations.push(dbT);
	}
	if (toBeIndexed.length) for (const index of toBeIndexed) migrations.push(index);
	async function runMigrations() {
		for (const migration of migrations) await migration.execute();
	}
	async function compileMigrations() {
		return migrations.map((m) => m.compile().sql).join(";\n\n") + ";";
	}
	return {
		toBeCreated,
		toBeAdded,
		runMigrations,
		compileMigrations
	};
}

//#endregion
export { createInternalAdapter as a, convertToDB as c, getBaseAdapter as d, toZodSchema as i, createFieldAttribute as l, matchType as n, getWithHooks as o, getSchema as r, convertFromDB as s, getMigrations as t, getAdapter as u };