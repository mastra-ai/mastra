import { t as generateId } from "./utils-DBbaShi0.mjs";
import { r as generateRandomString } from "./crypto-BQxYXGGX.mjs";
import { t as mergeSchema, u as getDate } from "./schema-CSB7dlK0.mjs";
import { t as getIp } from "./get-request-ip-RYTz2Uba.mjs";
import { t as safeJSONParse } from "./json-_HMgPUVh.mjs";
import { t as getBaseURL } from "./url-BLNRhCPO.mjs";
import { t as APIError$1 } from "./api-q2sbQ7PT.mjs";
import { l as parseSetCookieHeader } from "./cookies-D_dksn7B.mjs";
import { r as getSessionFromCtx, u as sessionMiddleware } from "./session-CgfX4vv1.mjs";
import { n as parser_default } from "./parser-kwbb5q_C.mjs";
import { n as role } from "./access-DXuPG0DH.mjs";
import { a as parsePrompt, i as schema, r as oidcProvider } from "./oidc-provider-CBEpaKIt.mjs";
import { isProduction, logger } from "@better-auth/core/env";
import { defineErrorCodes } from "@better-auth/core/utils";
import { APIError } from "better-call";
import * as z from "zod";
import { createHash } from "@better-auth/utils/hash";
import { SignJWT } from "jose";
import { createAuthEndpoint, createAuthEndpoint as createAuthEndpoint$1, createAuthMiddleware, createAuthMiddleware as createAuthMiddleware$1, optionsMiddleware } from "@better-auth/core/api";
import { base64, base64Url } from "@better-auth/utils/base64";
import { getWebcryptoSubtle } from "@better-auth/utils";

//#region src/plugins/api-key/adapter.ts
/**
* Generate storage key for API key by hashed key
*/
function getStorageKeyByHashedKey(hashedKey) {
	return `api-key:${hashedKey}`;
}
/**
* Generate storage key for API key by ID
*/
function getStorageKeyById(id) {
	return `api-key:by-id:${id}`;
}
/**
* Generate storage key for user's API key list
*/
function getStorageKeyByUserId(userId) {
	return `api-key:by-user:${userId}`;
}
/**
* Serialize API key for storage
*/
function serializeApiKey(apiKey$1) {
	return JSON.stringify({
		...apiKey$1,
		createdAt: apiKey$1.createdAt.toISOString(),
		updatedAt: apiKey$1.updatedAt.toISOString(),
		expiresAt: apiKey$1.expiresAt?.toISOString() ?? null,
		lastRefillAt: apiKey$1.lastRefillAt?.toISOString() ?? null,
		lastRequest: apiKey$1.lastRequest?.toISOString() ?? null
	});
}
/**
* Deserialize API key from storage
*/
function deserializeApiKey(data) {
	if (!data || typeof data !== "string") return null;
	try {
		const parsed = JSON.parse(data);
		return {
			...parsed,
			createdAt: new Date(parsed.createdAt),
			updatedAt: new Date(parsed.updatedAt),
			expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
			lastRefillAt: parsed.lastRefillAt ? new Date(parsed.lastRefillAt) : null,
			lastRequest: parsed.lastRequest ? new Date(parsed.lastRequest) : null
		};
	} catch {
		return null;
	}
}
/**
* Get the storage instance to use (custom methods take precedence)
*/
function getStorageInstance(ctx, opts) {
	if (opts.customStorage) return opts.customStorage;
	return ctx.context.secondaryStorage || null;
}
/**
* Calculate TTL in seconds for an API key
*/
function calculateTTL(apiKey$1) {
	if (apiKey$1.expiresAt) {
		const now = Date.now();
		const expiresAt = new Date(apiKey$1.expiresAt).getTime();
		const ttlSeconds = Math.floor((expiresAt - now) / 1e3);
		if (ttlSeconds > 0) return ttlSeconds;
	}
}
/**
* Get API key from secondary storage by hashed key
*/
async function getApiKeyFromStorage(ctx, hashedKey, storage) {
	const key = getStorageKeyByHashedKey(hashedKey);
	return deserializeApiKey(await storage.get(key));
}
/**
* Get API key from secondary storage by ID
*/
async function getApiKeyByIdFromStorage(ctx, id, storage) {
	const key = getStorageKeyById(id);
	return deserializeApiKey(await storage.get(key));
}
/**
* Store API key in secondary storage
*/
async function setApiKeyInStorage(ctx, apiKey$1, storage, ttl) {
	const serialized = serializeApiKey(apiKey$1);
	const hashedKey = apiKey$1.key;
	const id = apiKey$1.id;
	await storage.set(getStorageKeyByHashedKey(hashedKey), serialized, ttl);
	await storage.set(getStorageKeyById(id), serialized, ttl);
	const userKey = getStorageKeyByUserId(apiKey$1.userId);
	const userListData = await storage.get(userKey);
	let userIds = [];
	if (userListData && typeof userListData === "string") try {
		userIds = JSON.parse(userListData);
	} catch {
		userIds = [];
	}
	else if (Array.isArray(userListData)) userIds = userListData;
	if (!userIds.includes(id)) {
		userIds.push(id);
		await storage.set(userKey, JSON.stringify(userIds));
	}
}
/**
* Delete API key from secondary storage
*/
async function deleteApiKeyFromStorage(ctx, apiKey$1, storage) {
	const hashedKey = apiKey$1.key;
	const id = apiKey$1.id;
	const userId = apiKey$1.userId;
	await storage.delete(getStorageKeyByHashedKey(hashedKey));
	await storage.delete(getStorageKeyById(id));
	const userKey = getStorageKeyByUserId(userId);
	const userListData = await storage.get(userKey);
	let userIds = [];
	if (userListData && typeof userListData === "string") try {
		userIds = JSON.parse(userListData);
	} catch {
		userIds = [];
	}
	else if (Array.isArray(userListData)) userIds = userListData;
	const filteredIds = userIds.filter((keyId) => keyId !== id);
	if (filteredIds.length === 0) await storage.delete(userKey);
	else await storage.set(userKey, JSON.stringify(filteredIds));
}
/**
* Unified getter for API keys with support for all storage modes
*/
async function getApiKey$1(ctx, hashedKey, opts) {
	const storage = getStorageInstance(ctx, opts);
	if (opts.storage === "database") return await ctx.context.adapter.findOne({
		model: "apikey",
		where: [{
			field: "key",
			value: hashedKey
		}]
	});
	if (opts.storage === "secondary-storage" && opts.fallbackToDatabase) {
		if (storage) {
			const cached = await getApiKeyFromStorage(ctx, hashedKey, storage);
			if (cached) return cached;
		}
		const dbKey = await ctx.context.adapter.findOne({
			model: "apikey",
			where: [{
				field: "key",
				value: hashedKey
			}]
		});
		if (dbKey && storage) await setApiKeyInStorage(ctx, dbKey, storage, calculateTTL(dbKey));
		return dbKey;
	}
	if (opts.storage === "secondary-storage") {
		if (!storage) return null;
		return await getApiKeyFromStorage(ctx, hashedKey, storage);
	}
	return await ctx.context.adapter.findOne({
		model: "apikey",
		where: [{
			field: "key",
			value: hashedKey
		}]
	});
}
/**
* Unified getter for API keys by ID
*/
async function getApiKeyById(ctx, id, opts) {
	const storage = getStorageInstance(ctx, opts);
	if (opts.storage === "database") return await ctx.context.adapter.findOne({
		model: "apikey",
		where: [{
			field: "id",
			value: id
		}]
	});
	if (opts.storage === "secondary-storage" && opts.fallbackToDatabase) {
		if (storage) {
			const cached = await getApiKeyByIdFromStorage(ctx, id, storage);
			if (cached) return cached;
		}
		const dbKey = await ctx.context.adapter.findOne({
			model: "apikey",
			where: [{
				field: "id",
				value: id
			}]
		});
		if (dbKey && storage) await setApiKeyInStorage(ctx, dbKey, storage, calculateTTL(dbKey));
		return dbKey;
	}
	if (opts.storage === "secondary-storage") {
		if (!storage) return null;
		return await getApiKeyByIdFromStorage(ctx, id, storage);
	}
	return await ctx.context.adapter.findOne({
		model: "apikey",
		where: [{
			field: "id",
			value: id
		}]
	});
}
/**
* Unified setter for API keys with support for all storage modes
*/
async function setApiKey(ctx, apiKey$1, opts) {
	const storage = getStorageInstance(ctx, opts);
	const ttl = calculateTTL(apiKey$1);
	if (opts.storage === "database") return;
	if (opts.storage === "secondary-storage") {
		if (!storage) throw new Error("Secondary storage is required when storage mode is 'secondary-storage'");
		await setApiKeyInStorage(ctx, apiKey$1, storage, ttl);
		return;
	}
}
/**
* Unified deleter for API keys with support for all storage modes
*/
async function deleteApiKey$1(ctx, apiKey$1, opts) {
	const storage = getStorageInstance(ctx, opts);
	if (opts.storage === "database") return;
	if (opts.storage === "secondary-storage") {
		if (!storage) throw new Error("Secondary storage is required when storage mode is 'secondary-storage'");
		await deleteApiKeyFromStorage(ctx, apiKey$1, storage);
		return;
	}
}
/**
* List API keys for a user with support for all storage modes
*/
async function listApiKeys$1(ctx, userId, opts) {
	const storage = getStorageInstance(ctx, opts);
	if (opts.storage === "database") return await ctx.context.adapter.findMany({
		model: "apikey",
		where: [{
			field: "userId",
			value: userId
		}]
	});
	if (opts.storage === "secondary-storage" && opts.fallbackToDatabase) {
		const userKey = getStorageKeyByUserId(userId);
		if (storage) {
			const userListData = await storage.get(userKey);
			let userIds = [];
			if (userListData && typeof userListData === "string") try {
				userIds = JSON.parse(userListData);
			} catch {
				userIds = [];
			}
			else if (Array.isArray(userListData)) userIds = userListData;
			if (userIds.length > 0) {
				const apiKeys = [];
				for (const id of userIds) {
					const apiKey$1 = await getApiKeyByIdFromStorage(ctx, id, storage);
					if (apiKey$1) apiKeys.push(apiKey$1);
				}
				return apiKeys;
			}
		}
		const dbKeys = await ctx.context.adapter.findMany({
			model: "apikey",
			where: [{
				field: "userId",
				value: userId
			}]
		});
		if (storage && dbKeys.length > 0) {
			const userIds = [];
			for (const apiKey$1 of dbKeys) {
				await setApiKeyInStorage(ctx, apiKey$1, storage, calculateTTL(apiKey$1));
				userIds.push(apiKey$1.id);
			}
			await storage.set(userKey, JSON.stringify(userIds));
		}
		return dbKeys;
	}
	if (opts.storage === "secondary-storage") {
		if (!storage) return [];
		const userKey = getStorageKeyByUserId(userId);
		const userListData = await storage.get(userKey);
		let userIds = [];
		if (userListData && typeof userListData === "string") try {
			userIds = JSON.parse(userListData);
		} catch {
			return [];
		}
		else if (Array.isArray(userListData)) userIds = userListData;
		else return [];
		const apiKeys = [];
		for (const id of userIds) {
			const apiKey$1 = await getApiKeyByIdFromStorage(ctx, id, storage);
			if (apiKey$1) apiKeys.push(apiKey$1);
		}
		return apiKeys;
	}
	return await ctx.context.adapter.findMany({
		model: "apikey",
		where: [{
			field: "userId",
			value: userId
		}]
	});
}

//#endregion
//#region src/plugins/api-key/routes/create-api-key.ts
function createApiKey({ keyGenerator, opts, schema: schema$1, deleteAllExpiredApiKeys: deleteAllExpiredApiKeys$1 }) {
	return createAuthEndpoint("/api-key/create", {
		method: "POST",
		body: z.object({
			name: z.string().meta({ description: "Name of the Api Key" }).optional(),
			expiresIn: z.number().meta({ description: "Expiration time of the Api Key in seconds" }).min(1).optional().nullable().default(null),
			userId: z.coerce.string().meta({ description: "User Id of the user that the Api Key belongs to. server-only. Eg: \"user-id\"" }).optional(),
			prefix: z.string().meta({ description: "Prefix of the Api Key" }).regex(/^[a-zA-Z0-9_-]+$/, { message: "Invalid prefix format, must be alphanumeric and contain only underscores and hyphens." }).optional(),
			remaining: z.number().meta({ description: "Remaining number of requests. Server side only" }).min(0).optional().nullable().default(null),
			metadata: z.any().optional(),
			refillAmount: z.number().meta({ description: "Amount to refill the remaining count of the Api Key. server-only. Eg: 100" }).min(1).optional(),
			refillInterval: z.number().meta({ description: "Interval to refill the Api Key in milliseconds. server-only. Eg: 1000" }).optional(),
			rateLimitTimeWindow: z.number().meta({ description: "The duration in milliseconds where each request is counted. Once the `maxRequests` is reached, the request will be rejected until the `timeWindow` has passed, at which point the `timeWindow` will be reset. server-only. Eg: 1000" }).optional(),
			rateLimitMax: z.number().meta({ description: "Maximum amount of requests allowed within a window. Once the `maxRequests` is reached, the request will be rejected until the `timeWindow` has passed, at which point the `timeWindow` will be reset. server-only. Eg: 100" }).optional(),
			rateLimitEnabled: z.boolean().meta({ description: "Whether the key has rate limiting enabled. server-only. Eg: true" }).optional(),
			permissions: z.record(z.string(), z.array(z.string())).meta({ description: "Permissions of the Api Key." }).optional()
		}),
		metadata: { openapi: {
			description: "Create a new API key for a user",
			responses: { "200": {
				description: "API key created successfully",
				content: { "application/json": { schema: {
					type: "object",
					properties: {
						id: {
							type: "string",
							description: "Unique identifier of the API key"
						},
						createdAt: {
							type: "string",
							format: "date-time",
							description: "Creation timestamp"
						},
						updatedAt: {
							type: "string",
							format: "date-time",
							description: "Last update timestamp"
						},
						name: {
							type: "string",
							nullable: true,
							description: "Name of the API key"
						},
						prefix: {
							type: "string",
							nullable: true,
							description: "Prefix of the API key"
						},
						start: {
							type: "string",
							nullable: true,
							description: "Starting characters of the key (if configured)"
						},
						key: {
							type: "string",
							description: "The full API key (only returned on creation)"
						},
						enabled: {
							type: "boolean",
							description: "Whether the key is enabled"
						},
						expiresAt: {
							type: "string",
							format: "date-time",
							nullable: true,
							description: "Expiration timestamp"
						},
						userId: {
							type: "string",
							description: "ID of the user owning the key"
						},
						lastRefillAt: {
							type: "string",
							format: "date-time",
							nullable: true,
							description: "Last refill timestamp"
						},
						lastRequest: {
							type: "string",
							format: "date-time",
							nullable: true,
							description: "Last request timestamp"
						},
						metadata: {
							type: "object",
							nullable: true,
							additionalProperties: true,
							description: "Metadata associated with the key"
						},
						rateLimitMax: {
							type: "number",
							nullable: true,
							description: "Maximum requests in time window"
						},
						rateLimitTimeWindow: {
							type: "number",
							nullable: true,
							description: "Rate limit time window in milliseconds"
						},
						remaining: {
							type: "number",
							nullable: true,
							description: "Remaining requests"
						},
						refillAmount: {
							type: "number",
							nullable: true,
							description: "Amount to refill"
						},
						refillInterval: {
							type: "number",
							nullable: true,
							description: "Refill interval in milliseconds"
						},
						rateLimitEnabled: {
							type: "boolean",
							description: "Whether rate limiting is enabled"
						},
						requestCount: {
							type: "number",
							description: "Current request count in window"
						},
						permissions: {
							type: "object",
							nullable: true,
							additionalProperties: {
								type: "array",
								items: { type: "string" }
							},
							description: "Permissions associated with the key"
						}
					},
					required: [
						"id",
						"createdAt",
						"updatedAt",
						"key",
						"enabled",
						"userId",
						"rateLimitEnabled",
						"requestCount"
					]
				} } }
			} }
		} }
	}, async (ctx) => {
		const { name, expiresIn, prefix, remaining, metadata, refillAmount, refillInterval, permissions, rateLimitMax, rateLimitTimeWindow, rateLimitEnabled } = ctx.body;
		const session = await getSessionFromCtx(ctx);
		const authRequired = ctx.request || ctx.headers;
		const user = authRequired && !session ? null : session?.user || { id: ctx.body.userId };
		if (!user?.id) throw new APIError$1("UNAUTHORIZED", { message: ERROR_CODES.UNAUTHORIZED_SESSION });
		if (session && ctx.body.userId && session?.user.id !== ctx.body.userId) throw new APIError$1("UNAUTHORIZED", { message: ERROR_CODES.UNAUTHORIZED_SESSION });
		if (authRequired) {
			if (refillAmount !== void 0 || refillInterval !== void 0 || rateLimitMax !== void 0 || rateLimitTimeWindow !== void 0 || rateLimitEnabled !== void 0 || permissions !== void 0 || remaining !== null) throw new APIError$1("BAD_REQUEST", { message: ERROR_CODES.SERVER_ONLY_PROPERTY });
		}
		if (metadata) {
			if (opts.enableMetadata === false) throw new APIError$1("BAD_REQUEST", { message: ERROR_CODES.METADATA_DISABLED });
			if (typeof metadata !== "object") throw new APIError$1("BAD_REQUEST", { message: ERROR_CODES.INVALID_METADATA_TYPE });
		}
		if (refillAmount && !refillInterval) throw new APIError$1("BAD_REQUEST", { message: ERROR_CODES.REFILL_AMOUNT_AND_INTERVAL_REQUIRED });
		if (refillInterval && !refillAmount) throw new APIError$1("BAD_REQUEST", { message: ERROR_CODES.REFILL_INTERVAL_AND_AMOUNT_REQUIRED });
		if (expiresIn) {
			if (opts.keyExpiration.disableCustomExpiresTime === true) throw new APIError$1("BAD_REQUEST", { message: ERROR_CODES.KEY_DISABLED_EXPIRATION });
			const expiresIn_in_days = expiresIn / (3600 * 24);
			if (opts.keyExpiration.minExpiresIn > expiresIn_in_days) throw new APIError$1("BAD_REQUEST", { message: ERROR_CODES.EXPIRES_IN_IS_TOO_SMALL });
			else if (opts.keyExpiration.maxExpiresIn < expiresIn_in_days) throw new APIError$1("BAD_REQUEST", { message: ERROR_CODES.EXPIRES_IN_IS_TOO_LARGE });
		}
		if (prefix) {
			if (prefix.length < opts.minimumPrefixLength) throw new APIError$1("BAD_REQUEST", { message: ERROR_CODES.INVALID_PREFIX_LENGTH });
			if (prefix.length > opts.maximumPrefixLength) throw new APIError$1("BAD_REQUEST", { message: ERROR_CODES.INVALID_PREFIX_LENGTH });
		}
		if (name) {
			if (name.length < opts.minimumNameLength) throw new APIError$1("BAD_REQUEST", { message: ERROR_CODES.INVALID_NAME_LENGTH });
			if (name.length > opts.maximumNameLength) throw new APIError$1("BAD_REQUEST", { message: ERROR_CODES.INVALID_NAME_LENGTH });
		} else if (opts.requireName) throw new APIError$1("BAD_REQUEST", { message: ERROR_CODES.NAME_REQUIRED });
		deleteAllExpiredApiKeys$1(ctx.context);
		const key = await keyGenerator({
			length: opts.defaultKeyLength,
			prefix: prefix || opts.defaultPrefix
		});
		const hashed = opts.disableKeyHashing ? key : await defaultKeyHasher(key);
		let start = null;
		if (opts.startingCharactersConfig.shouldStore) start = key.substring(0, opts.startingCharactersConfig.charactersLength);
		const defaultPermissions = opts.permissions?.defaultPermissions ? typeof opts.permissions.defaultPermissions === "function" ? await opts.permissions.defaultPermissions(user.id, ctx) : opts.permissions.defaultPermissions : void 0;
		const permissionsToApply = permissions ? JSON.stringify(permissions) : defaultPermissions ? JSON.stringify(defaultPermissions) : void 0;
		let data = {
			createdAt: /* @__PURE__ */ new Date(),
			updatedAt: /* @__PURE__ */ new Date(),
			name: name ?? null,
			prefix: prefix ?? opts.defaultPrefix ?? null,
			start,
			key: hashed,
			enabled: true,
			expiresAt: expiresIn ? getDate(expiresIn, "sec") : opts.keyExpiration.defaultExpiresIn ? getDate(opts.keyExpiration.defaultExpiresIn, "sec") : null,
			userId: user.id,
			lastRefillAt: null,
			lastRequest: null,
			metadata: null,
			rateLimitMax: rateLimitMax ?? opts.rateLimit.maxRequests ?? null,
			rateLimitTimeWindow: rateLimitTimeWindow ?? opts.rateLimit.timeWindow ?? null,
			remaining: remaining === null ? remaining : remaining ?? refillAmount ?? null,
			refillAmount: refillAmount ?? null,
			refillInterval: refillInterval ?? null,
			rateLimitEnabled: rateLimitEnabled === void 0 ? opts.rateLimit.enabled ?? true : rateLimitEnabled,
			requestCount: 0,
			permissions: permissionsToApply
		};
		if (metadata) data.metadata = schema$1.apikey.fields.metadata.transform.input(metadata);
		let apiKey$1;
		if (opts.storage === "secondary-storage" && opts.fallbackToDatabase) {
			apiKey$1 = await ctx.context.adapter.create({
				model: API_KEY_TABLE_NAME,
				data
			});
			await setApiKey(ctx, apiKey$1, opts);
		} else if (opts.storage === "secondary-storage") {
			const id = ctx.context.generateId({ model: API_KEY_TABLE_NAME }) ?? generateId();
			apiKey$1 = {
				...data,
				id
			};
			await setApiKey(ctx, apiKey$1, opts);
		} else apiKey$1 = await ctx.context.adapter.create({
			model: API_KEY_TABLE_NAME,
			data
		});
		return ctx.json({
			...apiKey$1,
			key,
			metadata: metadata ?? null,
			permissions: apiKey$1.permissions ? safeJSONParse(apiKey$1.permissions) : null
		});
	});
}

//#endregion
//#region src/plugins/api-key/routes/delete-all-expired-api-keys.ts
function deleteAllExpiredApiKeysEndpoint({ deleteAllExpiredApiKeys: deleteAllExpiredApiKeys$1 }) {
	return createAuthEndpoint("/api-key/delete-all-expired-api-keys", {
		method: "POST",
		metadata: {
			SERVER_ONLY: true,
			client: false
		}
	}, async (ctx) => {
		try {
			await deleteAllExpiredApiKeys$1(ctx.context, true);
		} catch (error) {
			ctx.context.logger.error("[API KEY PLUGIN] Failed to delete expired API keys:", error);
			return ctx.json({
				success: false,
				error
			});
		}
		return ctx.json({
			success: true,
			error: null
		});
	});
}

//#endregion
//#region src/plugins/api-key/routes/delete-api-key.ts
function deleteApiKey({ opts, schema: schema$1, deleteAllExpiredApiKeys: deleteAllExpiredApiKeys$1 }) {
	return createAuthEndpoint("/api-key/delete", {
		method: "POST",
		body: z.object({ keyId: z.string().meta({ description: "The id of the Api Key" }) }),
		use: [sessionMiddleware],
		metadata: { openapi: {
			description: "Delete an existing API key",
			requestBody: { content: { "application/json": { schema: {
				type: "object",
				properties: { keyId: {
					type: "string",
					description: "The id of the API key to delete"
				} },
				required: ["keyId"]
			} } } },
			responses: { "200": {
				description: "API key deleted successfully",
				content: { "application/json": { schema: {
					type: "object",
					properties: { success: {
						type: "boolean",
						description: "Indicates if the API key was successfully deleted"
					} },
					required: ["success"]
				} } }
			} }
		} }
	}, async (ctx) => {
		const { keyId } = ctx.body;
		const session = ctx.context.session;
		if (session.user.banned === true) throw new APIError$1("UNAUTHORIZED", { message: ERROR_CODES.USER_BANNED });
		let apiKey$1 = null;
		apiKey$1 = await getApiKeyById(ctx, keyId, opts);
		if (!apiKey$1 || apiKey$1.userId !== session.user.id) throw new APIError$1("NOT_FOUND", { message: ERROR_CODES.KEY_NOT_FOUND });
		try {
			if (opts.storage === "secondary-storage" && opts.fallbackToDatabase) {
				await deleteApiKey$1(ctx, apiKey$1, opts);
				await ctx.context.adapter.delete({
					model: API_KEY_TABLE_NAME,
					where: [{
						field: "id",
						value: apiKey$1.id
					}]
				});
			} else if (opts.storage === "database") await ctx.context.adapter.delete({
				model: API_KEY_TABLE_NAME,
				where: [{
					field: "id",
					value: apiKey$1.id
				}]
			});
			else await deleteApiKey$1(ctx, apiKey$1, opts);
		} catch (error) {
			throw new APIError$1("INTERNAL_SERVER_ERROR", { message: error?.message });
		}
		deleteAllExpiredApiKeys$1(ctx.context);
		return ctx.json({ success: true });
	});
}

//#endregion
//#region src/plugins/api-key/routes/get-api-key.ts
function getApiKey({ opts, schema: schema$1, deleteAllExpiredApiKeys: deleteAllExpiredApiKeys$1 }) {
	return createAuthEndpoint("/api-key/get", {
		method: "GET",
		query: z.object({ id: z.string().meta({ description: "The id of the Api Key" }) }),
		use: [sessionMiddleware],
		metadata: { openapi: {
			description: "Retrieve an existing API key by ID",
			responses: { "200": {
				description: "API key retrieved successfully",
				content: { "application/json": { schema: {
					type: "object",
					properties: {
						id: {
							type: "string",
							description: "ID"
						},
						name: {
							type: "string",
							nullable: true,
							description: "The name of the key"
						},
						start: {
							type: "string",
							nullable: true,
							description: "Shows the first few characters of the API key, including the prefix. This allows you to show those few characters in the UI to make it easier for users to identify the API key."
						},
						prefix: {
							type: "string",
							nullable: true,
							description: "The API Key prefix. Stored as plain text."
						},
						userId: {
							type: "string",
							description: "The owner of the user id"
						},
						refillInterval: {
							type: "number",
							nullable: true,
							description: "The interval in milliseconds between refills of the `remaining` count. Example: 3600000 // refill every hour (3600000ms = 1h)"
						},
						refillAmount: {
							type: "number",
							nullable: true,
							description: "The amount to refill"
						},
						lastRefillAt: {
							type: "string",
							format: "date-time",
							nullable: true,
							description: "The last refill date"
						},
						enabled: {
							type: "boolean",
							description: "Sets if key is enabled or disabled",
							default: true
						},
						rateLimitEnabled: {
							type: "boolean",
							description: "Whether the key has rate limiting enabled"
						},
						rateLimitTimeWindow: {
							type: "number",
							nullable: true,
							description: "The duration in milliseconds"
						},
						rateLimitMax: {
							type: "number",
							nullable: true,
							description: "Maximum amount of requests allowed within a window"
						},
						requestCount: {
							type: "number",
							description: "The number of requests made within the rate limit time window"
						},
						remaining: {
							type: "number",
							nullable: true,
							description: "Remaining requests (every time api key is used this should updated and should be updated on refill as well)"
						},
						lastRequest: {
							type: "string",
							format: "date-time",
							nullable: true,
							description: "When last request occurred"
						},
						expiresAt: {
							type: "string",
							format: "date-time",
							nullable: true,
							description: "Expiry date of a key"
						},
						createdAt: {
							type: "string",
							format: "date-time",
							description: "created at"
						},
						updatedAt: {
							type: "string",
							format: "date-time",
							description: "updated at"
						},
						metadata: {
							type: "object",
							nullable: true,
							additionalProperties: true,
							description: "Extra metadata about the apiKey"
						},
						permissions: {
							type: "string",
							nullable: true,
							description: "Permissions for the api key (stored as JSON string)"
						}
					},
					required: [
						"id",
						"userId",
						"enabled",
						"rateLimitEnabled",
						"requestCount",
						"createdAt",
						"updatedAt"
					]
				} } }
			} }
		} }
	}, async (ctx) => {
		const { id } = ctx.query;
		const session = ctx.context.session;
		let apiKey$1 = null;
		apiKey$1 = await getApiKeyById(ctx, id, opts);
		if (apiKey$1 && apiKey$1.userId !== session.user.id) apiKey$1 = null;
		if (!apiKey$1) throw new APIError$1("NOT_FOUND", { message: ERROR_CODES.KEY_NOT_FOUND });
		deleteAllExpiredApiKeys$1(ctx.context);
		apiKey$1.metadata = schema$1.apikey.fields.metadata.transform.output(apiKey$1.metadata);
		const { key, ...returningApiKey } = apiKey$1;
		return ctx.json({
			...returningApiKey,
			permissions: returningApiKey.permissions ? safeJSONParse(returningApiKey.permissions) : null
		});
	});
}

//#endregion
//#region src/plugins/api-key/routes/list-api-keys.ts
function listApiKeys({ opts, schema: schema$1, deleteAllExpiredApiKeys: deleteAllExpiredApiKeys$1 }) {
	return createAuthEndpoint("/api-key/list", {
		method: "GET",
		use: [sessionMiddleware],
		metadata: { openapi: {
			description: "List all API keys for the authenticated user",
			responses: { "200": {
				description: "API keys retrieved successfully",
				content: { "application/json": { schema: {
					type: "array",
					items: {
						type: "object",
						properties: {
							id: {
								type: "string",
								description: "ID"
							},
							name: {
								type: "string",
								nullable: true,
								description: "The name of the key"
							},
							start: {
								type: "string",
								nullable: true,
								description: "Shows the first few characters of the API key, including the prefix. This allows you to show those few characters in the UI to make it easier for users to identify the API key."
							},
							prefix: {
								type: "string",
								nullable: true,
								description: "The API Key prefix. Stored as plain text."
							},
							userId: {
								type: "string",
								description: "The owner of the user id"
							},
							refillInterval: {
								type: "number",
								nullable: true,
								description: "The interval in milliseconds between refills of the `remaining` count. Example: 3600000 // refill every hour (3600000ms = 1h)"
							},
							refillAmount: {
								type: "number",
								nullable: true,
								description: "The amount to refill"
							},
							lastRefillAt: {
								type: "string",
								format: "date-time",
								nullable: true,
								description: "The last refill date"
							},
							enabled: {
								type: "boolean",
								description: "Sets if key is enabled or disabled",
								default: true
							},
							rateLimitEnabled: {
								type: "boolean",
								description: "Whether the key has rate limiting enabled"
							},
							rateLimitTimeWindow: {
								type: "number",
								nullable: true,
								description: "The duration in milliseconds"
							},
							rateLimitMax: {
								type: "number",
								nullable: true,
								description: "Maximum amount of requests allowed within a window"
							},
							requestCount: {
								type: "number",
								description: "The number of requests made within the rate limit time window"
							},
							remaining: {
								type: "number",
								nullable: true,
								description: "Remaining requests (every time api key is used this should updated and should be updated on refill as well)"
							},
							lastRequest: {
								type: "string",
								format: "date-time",
								nullable: true,
								description: "When last request occurred"
							},
							expiresAt: {
								type: "string",
								format: "date-time",
								nullable: true,
								description: "Expiry date of a key"
							},
							createdAt: {
								type: "string",
								format: "date-time",
								description: "created at"
							},
							updatedAt: {
								type: "string",
								format: "date-time",
								description: "updated at"
							},
							metadata: {
								type: "object",
								nullable: true,
								additionalProperties: true,
								description: "Extra metadata about the apiKey"
							},
							permissions: {
								type: "string",
								nullable: true,
								description: "Permissions for the api key (stored as JSON string)"
							}
						},
						required: [
							"id",
							"userId",
							"enabled",
							"rateLimitEnabled",
							"requestCount",
							"createdAt",
							"updatedAt"
						]
					}
				} } }
			} }
		} }
	}, async (ctx) => {
		const session = ctx.context.session;
		let apiKeys;
		apiKeys = await listApiKeys$1(ctx, session.user.id, opts);
		deleteAllExpiredApiKeys$1(ctx.context);
		apiKeys = apiKeys.map((apiKey$1) => {
			return {
				...apiKey$1,
				metadata: schema$1.apikey.fields.metadata.transform.output(apiKey$1.metadata)
			};
		});
		let returningApiKey = apiKeys.map((x) => {
			const { key, ...returningApiKey$1 } = x;
			return {
				...returningApiKey$1,
				permissions: returningApiKey$1.permissions ? safeJSONParse(returningApiKey$1.permissions) : null
			};
		});
		return ctx.json(returningApiKey);
	});
}

//#endregion
//#region src/plugins/api-key/routes/update-api-key.ts
function updateApiKey({ opts, schema: schema$1, deleteAllExpiredApiKeys: deleteAllExpiredApiKeys$1 }) {
	return createAuthEndpoint("/api-key/update", {
		method: "POST",
		body: z.object({
			keyId: z.string().meta({ description: "The id of the Api Key" }),
			userId: z.coerce.string().meta({ description: "The id of the user which the api key belongs to. server-only. Eg: \"some-user-id\"" }).optional(),
			name: z.string().meta({ description: "The name of the key" }).optional(),
			enabled: z.boolean().meta({ description: "Whether the Api Key is enabled or not" }).optional(),
			remaining: z.number().meta({ description: "The number of remaining requests" }).min(1).optional(),
			refillAmount: z.number().meta({ description: "The refill amount" }).optional(),
			refillInterval: z.number().meta({ description: "The refill interval" }).optional(),
			metadata: z.any().optional(),
			expiresIn: z.number().meta({ description: "Expiration time of the Api Key in seconds" }).min(1).optional().nullable(),
			rateLimitEnabled: z.boolean().meta({ description: "Whether the key has rate limiting enabled." }).optional(),
			rateLimitTimeWindow: z.number().meta({ description: "The duration in milliseconds where each request is counted. server-only. Eg: 1000" }).optional(),
			rateLimitMax: z.number().meta({ description: "Maximum amount of requests allowed within a window. Once the `maxRequests` is reached, the request will be rejected until the `timeWindow` has passed, at which point the `timeWindow` will be reset. server-only. Eg: 100" }).optional(),
			permissions: z.record(z.string(), z.array(z.string())).meta({ description: "Update the permissions on the API Key. server-only." }).optional().nullable()
		}),
		metadata: { openapi: {
			description: "Update an existing API key by ID",
			responses: { "200": {
				description: "API key updated successfully",
				content: { "application/json": { schema: {
					type: "object",
					properties: {
						id: {
							type: "string",
							description: "ID"
						},
						name: {
							type: "string",
							nullable: true,
							description: "The name of the key"
						},
						start: {
							type: "string",
							nullable: true,
							description: "Shows the first few characters of the API key, including the prefix. This allows you to show those few characters in the UI to make it easier for users to identify the API key."
						},
						prefix: {
							type: "string",
							nullable: true,
							description: "The API Key prefix. Stored as plain text."
						},
						userId: {
							type: "string",
							description: "The owner of the user id"
						},
						refillInterval: {
							type: "number",
							nullable: true,
							description: "The interval in milliseconds between refills of the `remaining` count. Example: 3600000 // refill every hour (3600000ms = 1h)"
						},
						refillAmount: {
							type: "number",
							nullable: true,
							description: "The amount to refill"
						},
						lastRefillAt: {
							type: "string",
							format: "date-time",
							nullable: true,
							description: "The last refill date"
						},
						enabled: {
							type: "boolean",
							description: "Sets if key is enabled or disabled",
							default: true
						},
						rateLimitEnabled: {
							type: "boolean",
							description: "Whether the key has rate limiting enabled"
						},
						rateLimitTimeWindow: {
							type: "number",
							nullable: true,
							description: "The duration in milliseconds"
						},
						rateLimitMax: {
							type: "number",
							nullable: true,
							description: "Maximum amount of requests allowed within a window"
						},
						requestCount: {
							type: "number",
							description: "The number of requests made within the rate limit time window"
						},
						remaining: {
							type: "number",
							nullable: true,
							description: "Remaining requests (every time api key is used this should updated and should be updated on refill as well)"
						},
						lastRequest: {
							type: "string",
							format: "date-time",
							nullable: true,
							description: "When last request occurred"
						},
						expiresAt: {
							type: "string",
							format: "date-time",
							nullable: true,
							description: "Expiry date of a key"
						},
						createdAt: {
							type: "string",
							format: "date-time",
							description: "created at"
						},
						updatedAt: {
							type: "string",
							format: "date-time",
							description: "updated at"
						},
						metadata: {
							type: "object",
							nullable: true,
							additionalProperties: true,
							description: "Extra metadata about the apiKey"
						},
						permissions: {
							type: "string",
							nullable: true,
							description: "Permissions for the api key (stored as JSON string)"
						}
					},
					required: [
						"id",
						"userId",
						"enabled",
						"rateLimitEnabled",
						"requestCount",
						"createdAt",
						"updatedAt"
					]
				} } }
			} }
		} }
	}, async (ctx) => {
		const { keyId, expiresIn, enabled, metadata, refillAmount, refillInterval, remaining, name, permissions, rateLimitEnabled, rateLimitTimeWindow, rateLimitMax } = ctx.body;
		const session = await getSessionFromCtx(ctx);
		const authRequired = ctx.request || ctx.headers;
		const user = authRequired && !session ? null : session?.user || { id: ctx.body.userId };
		if (!user?.id) throw new APIError$1("UNAUTHORIZED", { message: ERROR_CODES.UNAUTHORIZED_SESSION });
		if (session && ctx.body.userId && session?.user.id !== ctx.body.userId) throw new APIError$1("UNAUTHORIZED", { message: ERROR_CODES.UNAUTHORIZED_SESSION });
		if (authRequired) {
			if (refillAmount !== void 0 || refillInterval !== void 0 || rateLimitMax !== void 0 || rateLimitTimeWindow !== void 0 || rateLimitEnabled !== void 0 || remaining !== void 0 || permissions !== void 0) throw new APIError$1("BAD_REQUEST", { message: ERROR_CODES.SERVER_ONLY_PROPERTY });
		}
		let apiKey$1 = null;
		apiKey$1 = await getApiKeyById(ctx, keyId, opts);
		if (apiKey$1 && apiKey$1.userId !== user.id) apiKey$1 = null;
		if (!apiKey$1) throw new APIError$1("NOT_FOUND", { message: ERROR_CODES.KEY_NOT_FOUND });
		let newValues = {};
		if (name !== void 0) {
			if (name.length < opts.minimumNameLength) throw new APIError$1("BAD_REQUEST", { message: ERROR_CODES.INVALID_NAME_LENGTH });
			else if (name.length > opts.maximumNameLength) throw new APIError$1("BAD_REQUEST", { message: ERROR_CODES.INVALID_NAME_LENGTH });
			newValues.name = name;
		}
		if (enabled !== void 0) newValues.enabled = enabled;
		if (expiresIn !== void 0) {
			if (opts.keyExpiration.disableCustomExpiresTime === true) throw new APIError$1("BAD_REQUEST", { message: ERROR_CODES.KEY_DISABLED_EXPIRATION });
			if (expiresIn !== null) {
				const expiresIn_in_days = expiresIn / (3600 * 24);
				if (expiresIn_in_days < opts.keyExpiration.minExpiresIn) throw new APIError$1("BAD_REQUEST", { message: ERROR_CODES.EXPIRES_IN_IS_TOO_SMALL });
				else if (expiresIn_in_days > opts.keyExpiration.maxExpiresIn) throw new APIError$1("BAD_REQUEST", { message: ERROR_CODES.EXPIRES_IN_IS_TOO_LARGE });
			}
			newValues.expiresAt = expiresIn ? getDate(expiresIn, "sec") : null;
		}
		if (metadata !== void 0) {
			if (typeof metadata !== "object") throw new APIError$1("BAD_REQUEST", { message: ERROR_CODES.INVALID_METADATA_TYPE });
			newValues.metadata = schema$1.apikey.fields.metadata.transform.input(metadata);
		}
		if (remaining !== void 0) newValues.remaining = remaining;
		if (refillAmount !== void 0 || refillInterval !== void 0) {
			if (refillAmount !== void 0 && refillInterval === void 0) throw new APIError$1("BAD_REQUEST", { message: ERROR_CODES.REFILL_AMOUNT_AND_INTERVAL_REQUIRED });
			else if (refillInterval !== void 0 && refillAmount === void 0) throw new APIError$1("BAD_REQUEST", { message: ERROR_CODES.REFILL_INTERVAL_AND_AMOUNT_REQUIRED });
			newValues.refillAmount = refillAmount;
			newValues.refillInterval = refillInterval;
		}
		if (rateLimitEnabled !== void 0) newValues.rateLimitEnabled = rateLimitEnabled;
		if (rateLimitTimeWindow !== void 0) newValues.rateLimitTimeWindow = rateLimitTimeWindow;
		if (rateLimitMax !== void 0) newValues.rateLimitMax = rateLimitMax;
		if (permissions !== void 0) newValues.permissions = JSON.stringify(permissions);
		if (Object.keys(newValues).length === 0) throw new APIError$1("BAD_REQUEST", { message: ERROR_CODES.NO_VALUES_TO_UPDATE });
		let newApiKey = apiKey$1;
		try {
			if (opts.storage === "secondary-storage" && opts.fallbackToDatabase) {
				const dbUpdated = await ctx.context.adapter.update({
					model: API_KEY_TABLE_NAME,
					where: [{
						field: "id",
						value: apiKey$1.id
					}],
					update: newValues
				});
				if (dbUpdated) {
					await setApiKey(ctx, dbUpdated, opts);
					newApiKey = dbUpdated;
				}
			} else if (opts.storage === "database") {
				const result = await ctx.context.adapter.update({
					model: API_KEY_TABLE_NAME,
					where: [{
						field: "id",
						value: apiKey$1.id
					}],
					update: newValues
				});
				if (result) newApiKey = result;
			} else {
				const updated = {
					...apiKey$1,
					...newValues,
					updatedAt: /* @__PURE__ */ new Date()
				};
				await setApiKey(ctx, updated, opts);
				newApiKey = updated;
			}
		} catch (error) {
			throw new APIError$1("INTERNAL_SERVER_ERROR", { message: error?.message });
		}
		deleteAllExpiredApiKeys$1(ctx.context);
		newApiKey.metadata = schema$1.apikey.fields.metadata.transform.output(newApiKey.metadata);
		const { key, ...returningApiKey } = newApiKey;
		return ctx.json({
			...returningApiKey,
			permissions: returningApiKey.permissions ? safeJSONParse(returningApiKey.permissions) : null
		});
	});
}

//#endregion
//#region src/plugins/api-key/rate-limit.ts
/**
* Determines if a request is allowed based on rate limiting parameters.
*
* @returns An object indicating whether the request is allowed and, if not,
*          a message and updated ApiKey data.
*/
function isRateLimited(apiKey$1, opts) {
	const now = /* @__PURE__ */ new Date();
	const lastRequest = apiKey$1.lastRequest;
	const rateLimitTimeWindow = apiKey$1.rateLimitTimeWindow;
	const rateLimitMax = apiKey$1.rateLimitMax;
	let requestCount = apiKey$1.requestCount;
	if (opts.rateLimit.enabled === false) return {
		success: true,
		message: null,
		update: { lastRequest: now },
		tryAgainIn: null
	};
	if (apiKey$1.rateLimitEnabled === false) return {
		success: true,
		message: null,
		update: { lastRequest: now },
		tryAgainIn: null
	};
	if (rateLimitTimeWindow === null || rateLimitMax === null) return {
		success: true,
		message: null,
		update: null,
		tryAgainIn: null
	};
	if (lastRequest === null) return {
		success: true,
		message: null,
		update: {
			lastRequest: now,
			requestCount: 1
		},
		tryAgainIn: null
	};
	const timeSinceLastRequest = now.getTime() - new Date(lastRequest).getTime();
	if (timeSinceLastRequest > rateLimitTimeWindow) return {
		success: true,
		message: null,
		update: {
			lastRequest: now,
			requestCount: 1
		},
		tryAgainIn: null
	};
	if (requestCount >= rateLimitMax) return {
		success: false,
		message: ERROR_CODES.RATE_LIMIT_EXCEEDED,
		update: null,
		tryAgainIn: Math.ceil(rateLimitTimeWindow - timeSinceLastRequest)
	};
	requestCount++;
	return {
		success: true,
		message: null,
		tryAgainIn: null,
		update: {
			lastRequest: now,
			requestCount
		}
	};
}

//#endregion
//#region src/plugins/api-key/routes/verify-api-key.ts
async function validateApiKey({ hashedKey, ctx, opts, schema: schema$1, permissions }) {
	const apiKey$1 = await getApiKey$1(ctx, hashedKey, opts);
	if (!apiKey$1) throw new APIError$1("UNAUTHORIZED", { message: ERROR_CODES.INVALID_API_KEY });
	if (apiKey$1.enabled === false) throw new APIError$1("UNAUTHORIZED", {
		message: ERROR_CODES.KEY_DISABLED,
		code: "KEY_DISABLED"
	});
	if (apiKey$1.expiresAt) {
		if (Date.now() > new Date(apiKey$1.expiresAt).getTime()) {
			try {
				if (opts.storage === "secondary-storage" && opts.fallbackToDatabase) {
					await deleteApiKey$1(ctx, apiKey$1, opts);
					await ctx.context.adapter.delete({
						model: API_KEY_TABLE_NAME,
						where: [{
							field: "id",
							value: apiKey$1.id
						}]
					});
				} else if (opts.storage === "secondary-storage") await deleteApiKey$1(ctx, apiKey$1, opts);
				else await ctx.context.adapter.delete({
					model: API_KEY_TABLE_NAME,
					where: [{
						field: "id",
						value: apiKey$1.id
					}]
				});
			} catch (error) {
				ctx.context.logger.error(`Failed to delete expired API keys:`, error);
			}
			throw new APIError$1("UNAUTHORIZED", {
				message: ERROR_CODES.KEY_EXPIRED,
				code: "KEY_EXPIRED"
			});
		}
	}
	if (permissions) {
		const apiKeyPermissions = apiKey$1.permissions ? safeJSONParse(apiKey$1.permissions) : null;
		if (!apiKeyPermissions) throw new APIError$1("UNAUTHORIZED", {
			message: ERROR_CODES.KEY_NOT_FOUND,
			code: "KEY_NOT_FOUND"
		});
		if (!role(apiKeyPermissions).authorize(permissions).success) throw new APIError$1("UNAUTHORIZED", {
			message: ERROR_CODES.KEY_NOT_FOUND,
			code: "KEY_NOT_FOUND"
		});
	}
	let remaining = apiKey$1.remaining;
	let lastRefillAt = apiKey$1.lastRefillAt;
	if (apiKey$1.remaining === 0 && apiKey$1.refillAmount === null) {
		try {
			if (opts.storage === "secondary-storage") await deleteApiKey$1(ctx, apiKey$1, opts);
			else await ctx.context.adapter.delete({
				model: API_KEY_TABLE_NAME,
				where: [{
					field: "id",
					value: apiKey$1.id
				}]
			});
		} catch (error) {
			ctx.context.logger.error(`Failed to delete expired API keys:`, error);
		}
		throw new APIError$1("TOO_MANY_REQUESTS", {
			message: ERROR_CODES.USAGE_EXCEEDED,
			code: "USAGE_EXCEEDED"
		});
	} else if (remaining !== null) {
		let now = Date.now();
		const refillInterval = apiKey$1.refillInterval;
		const refillAmount = apiKey$1.refillAmount;
		let lastTime = new Date(lastRefillAt ?? apiKey$1.createdAt).getTime();
		if (refillInterval && refillAmount) {
			if (now - lastTime > refillInterval) {
				remaining = refillAmount;
				lastRefillAt = /* @__PURE__ */ new Date();
			}
		}
		if (remaining === 0) throw new APIError$1("TOO_MANY_REQUESTS", {
			message: ERROR_CODES.USAGE_EXCEEDED,
			code: "USAGE_EXCEEDED"
		});
		else remaining--;
	}
	const { message, success, update, tryAgainIn } = isRateLimited(apiKey$1, opts);
	let newApiKey = null;
	const updated = {
		...apiKey$1,
		...update,
		remaining,
		lastRefillAt,
		updatedAt: /* @__PURE__ */ new Date()
	};
	if (opts.storage === "database") newApiKey = await ctx.context.adapter.update({
		model: API_KEY_TABLE_NAME,
		where: [{
			field: "id",
			value: apiKey$1.id
		}],
		update: updated
	});
	else {
		await setApiKey(ctx, updated, opts);
		newApiKey = updated;
	}
	if (!newApiKey) throw new APIError$1("INTERNAL_SERVER_ERROR", {
		message: ERROR_CODES.FAILED_TO_UPDATE_API_KEY,
		code: "INTERNAL_SERVER_ERROR"
	});
	if (success === false) throw new APIError$1("UNAUTHORIZED", {
		message: message ?? void 0,
		code: "RATE_LIMITED",
		details: { tryAgainIn }
	});
	return newApiKey;
}
function verifyApiKey({ opts, schema: schema$1, deleteAllExpiredApiKeys: deleteAllExpiredApiKeys$1 }) {
	return createAuthEndpoint("/api-key/verify", {
		method: "POST",
		body: z.object({
			key: z.string().meta({ description: "The key to verify" }),
			permissions: z.record(z.string(), z.array(z.string())).meta({ description: "The permissions to verify." }).optional()
		}),
		metadata: { SERVER_ONLY: true }
	}, async (ctx) => {
		const { key } = ctx.body;
		if (key.length < opts.defaultKeyLength) return ctx.json({
			valid: false,
			error: {
				message: ERROR_CODES.INVALID_API_KEY,
				code: "KEY_NOT_FOUND"
			},
			key: null
		});
		if (opts.customAPIKeyValidator) {
			if (!await opts.customAPIKeyValidator({
				ctx,
				key
			})) return ctx.json({
				valid: false,
				error: {
					message: ERROR_CODES.INVALID_API_KEY,
					code: "KEY_NOT_FOUND"
				},
				key: null
			});
		}
		const hashed = opts.disableKeyHashing ? key : await defaultKeyHasher(key);
		let apiKey$1 = null;
		try {
			apiKey$1 = await validateApiKey({
				hashedKey: hashed,
				permissions: ctx.body.permissions,
				ctx,
				opts,
				schema: schema$1
			});
			await deleteAllExpiredApiKeys$1(ctx.context);
		} catch (error) {
			if (error instanceof APIError$1) return ctx.json({
				valid: false,
				error: {
					message: error.body?.message,
					code: error.body?.code
				},
				key: null
			});
			return ctx.json({
				valid: false,
				error: {
					message: ERROR_CODES.INVALID_API_KEY,
					code: "INVALID_API_KEY"
				},
				key: null
			});
		}
		const { key: _, ...returningApiKey } = apiKey$1 ?? {
			key: 1,
			permissions: void 0
		};
		if ("metadata" in returningApiKey) returningApiKey.metadata = schema$1.apikey.fields.metadata.transform.output(returningApiKey.metadata);
		returningApiKey.permissions = returningApiKey.permissions ? safeJSONParse(returningApiKey.permissions) : null;
		return ctx.json({
			valid: true,
			error: null,
			key: apiKey$1 === null ? null : returningApiKey
		});
	});
}

//#endregion
//#region src/plugins/api-key/routes/index.ts
let lastChecked = null;
async function deleteAllExpiredApiKeys(ctx, byPassLastCheckTime = false) {
	if (lastChecked && !byPassLastCheckTime) {
		if ((/* @__PURE__ */ new Date()).getTime() - lastChecked.getTime() < 1e4) return;
	}
	lastChecked = /* @__PURE__ */ new Date();
	await ctx.adapter.deleteMany({
		model: API_KEY_TABLE_NAME,
		where: [{
			field: "expiresAt",
			operator: "lt",
			value: /* @__PURE__ */ new Date()
		}, {
			field: "expiresAt",
			operator: "ne",
			value: null
		}]
	}).catch((error) => {
		ctx.logger.error(`Failed to delete expired API keys:`, error);
	});
}
function createApiKeyRoutes({ keyGenerator, opts, schema: schema$1 }) {
	return {
		createApiKey: createApiKey({
			keyGenerator,
			opts,
			schema: schema$1,
			deleteAllExpiredApiKeys
		}),
		verifyApiKey: verifyApiKey({
			opts,
			schema: schema$1,
			deleteAllExpiredApiKeys
		}),
		getApiKey: getApiKey({
			opts,
			schema: schema$1,
			deleteAllExpiredApiKeys
		}),
		updateApiKey: updateApiKey({
			opts,
			schema: schema$1,
			deleteAllExpiredApiKeys
		}),
		deleteApiKey: deleteApiKey({
			opts,
			schema: schema$1,
			deleteAllExpiredApiKeys
		}),
		listApiKeys: listApiKeys({
			opts,
			schema: schema$1,
			deleteAllExpiredApiKeys
		}),
		deleteAllExpiredApiKeys: deleteAllExpiredApiKeysEndpoint({ deleteAllExpiredApiKeys })
	};
}

//#endregion
//#region src/plugins/api-key/schema.ts
const apiKeySchema = ({ timeWindow, rateLimitMax }) => ({ apikey: { fields: {
	name: {
		type: "string",
		required: false,
		input: false
	},
	start: {
		type: "string",
		required: false,
		input: false
	},
	prefix: {
		type: "string",
		required: false,
		input: false
	},
	key: {
		type: "string",
		required: true,
		input: false,
		index: true
	},
	userId: {
		type: "string",
		references: {
			model: "user",
			field: "id",
			onDelete: "cascade"
		},
		required: true,
		input: false,
		index: true
	},
	refillInterval: {
		type: "number",
		required: false,
		input: false
	},
	refillAmount: {
		type: "number",
		required: false,
		input: false
	},
	lastRefillAt: {
		type: "date",
		required: false,
		input: false
	},
	enabled: {
		type: "boolean",
		required: false,
		input: false,
		defaultValue: true
	},
	rateLimitEnabled: {
		type: "boolean",
		required: false,
		input: false,
		defaultValue: true
	},
	rateLimitTimeWindow: {
		type: "number",
		required: false,
		input: false,
		defaultValue: timeWindow
	},
	rateLimitMax: {
		type: "number",
		required: false,
		input: false,
		defaultValue: rateLimitMax
	},
	requestCount: {
		type: "number",
		required: false,
		input: false,
		defaultValue: 0
	},
	remaining: {
		type: "number",
		required: false,
		input: false
	},
	lastRequest: {
		type: "date",
		required: false,
		input: false
	},
	expiresAt: {
		type: "date",
		required: false,
		input: false
	},
	createdAt: {
		type: "date",
		required: true,
		input: false
	},
	updatedAt: {
		type: "date",
		required: true,
		input: false
	},
	permissions: {
		type: "string",
		required: false,
		input: false
	},
	metadata: {
		type: "string",
		required: false,
		input: true,
		transform: {
			input(value) {
				return JSON.stringify(value);
			},
			output(value) {
				if (!value) return null;
				return parser_default(value);
			}
		}
	}
} } });

//#endregion
//#region src/plugins/api-key/index.ts
const defaultKeyHasher = async (key) => {
	const hash = await createHash("SHA-256").digest(new TextEncoder().encode(key));
	return base64Url.encode(new Uint8Array(hash), { padding: false });
};
const ERROR_CODES = defineErrorCodes({
	INVALID_METADATA_TYPE: "metadata must be an object or undefined",
	REFILL_AMOUNT_AND_INTERVAL_REQUIRED: "refillAmount is required when refillInterval is provided",
	REFILL_INTERVAL_AND_AMOUNT_REQUIRED: "refillInterval is required when refillAmount is provided",
	USER_BANNED: "User is banned",
	UNAUTHORIZED_SESSION: "Unauthorized or invalid session",
	KEY_NOT_FOUND: "API Key not found",
	KEY_DISABLED: "API Key is disabled",
	KEY_EXPIRED: "API Key has expired",
	USAGE_EXCEEDED: "API Key has reached its usage limit",
	KEY_NOT_RECOVERABLE: "API Key is not recoverable",
	EXPIRES_IN_IS_TOO_SMALL: "The expiresIn is smaller than the predefined minimum value.",
	EXPIRES_IN_IS_TOO_LARGE: "The expiresIn is larger than the predefined maximum value.",
	INVALID_REMAINING: "The remaining count is either too large or too small.",
	INVALID_PREFIX_LENGTH: "The prefix length is either too large or too small.",
	INVALID_NAME_LENGTH: "The name length is either too large or too small.",
	METADATA_DISABLED: "Metadata is disabled.",
	RATE_LIMIT_EXCEEDED: "Rate limit exceeded.",
	NO_VALUES_TO_UPDATE: "No values to update.",
	KEY_DISABLED_EXPIRATION: "Custom key expiration values are disabled.",
	INVALID_API_KEY: "Invalid API key.",
	INVALID_USER_ID_FROM_API_KEY: "The user id from the API key is invalid.",
	INVALID_API_KEY_GETTER_RETURN_TYPE: "API Key getter returned an invalid key type. Expected string.",
	SERVER_ONLY_PROPERTY: "The property you're trying to set can only be set from the server auth instance only.",
	FAILED_TO_UPDATE_API_KEY: "Failed to update API key",
	NAME_REQUIRED: "API Key name is required."
});
const API_KEY_TABLE_NAME = "apikey";
const apiKey = (options) => {
	const opts = {
		...options,
		apiKeyHeaders: options?.apiKeyHeaders ?? "x-api-key",
		defaultKeyLength: options?.defaultKeyLength || 64,
		maximumPrefixLength: options?.maximumPrefixLength ?? 32,
		minimumPrefixLength: options?.minimumPrefixLength ?? 1,
		maximumNameLength: options?.maximumNameLength ?? 32,
		minimumNameLength: options?.minimumNameLength ?? 1,
		enableMetadata: options?.enableMetadata ?? false,
		disableKeyHashing: options?.disableKeyHashing ?? false,
		requireName: options?.requireName ?? false,
		storage: options?.storage ?? "database",
		rateLimit: {
			enabled: options?.rateLimit?.enabled === void 0 ? true : options?.rateLimit?.enabled,
			timeWindow: options?.rateLimit?.timeWindow ?? 1e3 * 60 * 60 * 24,
			maxRequests: options?.rateLimit?.maxRequests ?? 10
		},
		keyExpiration: {
			defaultExpiresIn: options?.keyExpiration?.defaultExpiresIn ?? null,
			disableCustomExpiresTime: options?.keyExpiration?.disableCustomExpiresTime ?? false,
			maxExpiresIn: options?.keyExpiration?.maxExpiresIn ?? 365,
			minExpiresIn: options?.keyExpiration?.minExpiresIn ?? 1
		},
		startingCharactersConfig: {
			shouldStore: options?.startingCharactersConfig?.shouldStore ?? true,
			charactersLength: options?.startingCharactersConfig?.charactersLength ?? 6
		},
		enableSessionForAPIKeys: options?.enableSessionForAPIKeys ?? false,
		fallbackToDatabase: options?.fallbackToDatabase ?? false,
		customStorage: options?.customStorage
	};
	const schema$1 = mergeSchema(apiKeySchema({
		rateLimitMax: opts.rateLimit.maxRequests,
		timeWindow: opts.rateLimit.timeWindow
	}), opts.schema);
	const getter = opts.customAPIKeyGetter || ((ctx) => {
		if (Array.isArray(opts.apiKeyHeaders)) for (const header of opts.apiKeyHeaders) {
			const value = ctx.headers?.get(header);
			if (value) return value;
		}
		else return ctx.headers?.get(opts.apiKeyHeaders);
	});
	const routes = createApiKeyRoutes({
		keyGenerator: opts.customKeyGenerator || (async (options$1) => {
			const key = generateRandomString(options$1.length, "a-z", "A-Z");
			return `${options$1.prefix || ""}${key}`;
		}),
		opts,
		schema: schema$1
	});
	return {
		id: "api-key",
		$ERROR_CODES: ERROR_CODES,
		hooks: { before: [{
			matcher: (ctx) => !!getter(ctx) && opts.enableSessionForAPIKeys,
			handler: createAuthMiddleware(async (ctx) => {
				const key = getter(ctx);
				if (typeof key !== "string") throw new APIError$1("BAD_REQUEST", { message: ERROR_CODES.INVALID_API_KEY_GETTER_RETURN_TYPE });
				if (key.length < opts.defaultKeyLength) throw new APIError$1("FORBIDDEN", { message: ERROR_CODES.INVALID_API_KEY });
				if (opts.customAPIKeyValidator) {
					if (!await opts.customAPIKeyValidator({
						ctx,
						key
					})) throw new APIError$1("FORBIDDEN", { message: ERROR_CODES.INVALID_API_KEY });
				}
				const apiKey$1 = await validateApiKey({
					hashedKey: opts.disableKeyHashing ? key : await defaultKeyHasher(key),
					ctx,
					opts,
					schema: schema$1
				});
				deleteAllExpiredApiKeys(ctx.context).catch((err) => {
					ctx.context.logger.error("Failed to delete expired API keys:", err);
				});
				const user = await ctx.context.internalAdapter.findUserById(apiKey$1.userId);
				if (!user) throw new APIError$1("UNAUTHORIZED", { message: ERROR_CODES.INVALID_USER_ID_FROM_API_KEY });
				const session = {
					user,
					session: {
						id: apiKey$1.id,
						token: key,
						userId: apiKey$1.userId,
						userAgent: ctx.request?.headers.get("user-agent") ?? null,
						ipAddress: ctx.request ? getIp(ctx.request, ctx.context.options) : null,
						createdAt: /* @__PURE__ */ new Date(),
						updatedAt: /* @__PURE__ */ new Date(),
						expiresAt: apiKey$1.expiresAt || getDate(ctx.context.options.session?.expiresIn || 3600 * 24 * 7, "ms")
					}
				};
				ctx.context.session = session;
				if (ctx.path === "/get-session") return session;
				else return { context: ctx };
			})
		}] },
		endpoints: {
			createApiKey: routes.createApiKey,
			verifyApiKey: routes.verifyApiKey,
			getApiKey: routes.getApiKey,
			updateApiKey: routes.updateApiKey,
			deleteApiKey: routes.deleteApiKey,
			listApiKeys: routes.listApiKeys,
			deleteAllExpiredApiKeys: routes.deleteAllExpiredApiKeys
		},
		schema: schema$1
	};
};

//#endregion
//#region src/plugins/last-login-method/index.ts
/**
* Plugin to track the last used login method
*/
const lastLoginMethod = (userConfig) => {
	const paths = [
		"/callback/:id",
		"/oauth2/callback/:providerId",
		"/sign-in/email",
		"/sign-up/email"
	];
	const defaultResolveMethod = (ctx) => {
		if (paths.includes(ctx.path)) return ctx.params?.id || ctx.params?.providerId || ctx.path.split("/").pop();
		if (ctx.path.includes("siwe")) return "siwe";
		if (ctx.path.includes("/passkey/verify-authentication")) return "passkey";
		return null;
	};
	const config = {
		cookieName: "better-auth.last_used_login_method",
		maxAge: 3600 * 24 * 30,
		...userConfig
	};
	return {
		id: "last-login-method",
		init(ctx) {
			return { options: { databaseHooks: {
				user: { create: { async before(user, context) {
					if (!config.storeInDatabase) return;
					if (!context) return;
					const lastUsedLoginMethod = config.customResolveMethod?.(context) ?? defaultResolveMethod(context);
					if (lastUsedLoginMethod) return { data: {
						...user,
						lastLoginMethod: lastUsedLoginMethod
					} };
				} } },
				session: { create: { async after(session, context) {
					if (!config.storeInDatabase) return;
					if (!context) return;
					const lastUsedLoginMethod = config.customResolveMethod?.(context) ?? defaultResolveMethod(context);
					if (lastUsedLoginMethod && session?.userId) try {
						await ctx.internalAdapter.updateUser(session.userId, { lastLoginMethod: lastUsedLoginMethod });
					} catch (error) {
						ctx.logger.error("Failed to update lastLoginMethod", error);
					}
				} } }
			} } };
		},
		hooks: { after: [{
			matcher() {
				return true;
			},
			handler: createAuthMiddleware(async (ctx) => {
				const lastUsedLoginMethod = config.customResolveMethod?.(ctx) ?? defaultResolveMethod(ctx);
				if (lastUsedLoginMethod) {
					const setCookie = ctx.context.responseHeaders?.get("set-cookie");
					const sessionTokenName = ctx.context.authCookies.sessionToken.name;
					if (setCookie && setCookie.includes(sessionTokenName)) {
						const cookieAttributes = {
							...ctx.context.authCookies.sessionToken.options,
							maxAge: config.maxAge,
							httpOnly: false
						};
						ctx.setCookie(config.cookieName, lastUsedLoginMethod, cookieAttributes);
					}
				}
			})
		}] },
		schema: config.storeInDatabase ? { user: { fields: { lastLoginMethod: {
			type: "string",
			input: false,
			required: false,
			fieldName: config.schema?.user?.lastLoginMethod || "lastLoginMethod"
		} } } } : void 0
	};
};

//#endregion
//#region src/plugins/mcp/authorize.ts
function redirectErrorURL(url, error, description) {
	return `${url.includes("?") ? "&" : "?"}error=${error}&error_description=${description}`;
}
async function authorizeMCPOAuth(ctx, options) {
	ctx.setHeader("Access-Control-Allow-Origin", "*");
	ctx.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
	ctx.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
	ctx.setHeader("Access-Control-Max-Age", "86400");
	const opts = {
		codeExpiresIn: 600,
		defaultScope: "openid",
		...options,
		scopes: [
			"openid",
			"profile",
			"email",
			"offline_access",
			...options?.scopes || []
		]
	};
	if (!ctx.request) throw new APIError("UNAUTHORIZED", {
		error_description: "request not found",
		error: "invalid_request"
	});
	const session = await getSessionFromCtx(ctx);
	if (!session) {
		/**
		* If the user is not logged in, we need to redirect them to the
		* login page.
		*/
		await ctx.setSignedCookie("oidc_login_prompt", JSON.stringify(ctx.query), ctx.context.secret, {
			maxAge: 600,
			path: "/",
			sameSite: "lax"
		});
		const queryFromURL = ctx.request.url?.split("?")[1];
		throw ctx.redirect(`${options.loginPage}?${queryFromURL}`);
	}
	const query = ctx.query;
	if (!query.client_id) throw ctx.redirect(`${ctx.context.baseURL}/error?error=invalid_client`);
	if (!query.response_type) throw ctx.redirect(redirectErrorURL(`${ctx.context.baseURL}/error`, "invalid_request", "response_type is required"));
	const client = await ctx.context.adapter.findOne({
		model: "oauthApplication",
		where: [{
			field: "clientId",
			value: ctx.query.client_id
		}]
	}).then((res) => {
		if (!res) return null;
		return {
			...res,
			redirectUrls: res.redirectUrls.split(","),
			metadata: res.metadata ? JSON.parse(res.metadata) : {}
		};
	});
	if (!client) throw ctx.redirect(`${ctx.context.baseURL}/error?error=invalid_client`);
	const redirectURI = client.redirectUrls.find((url) => url === ctx.query.redirect_uri);
	if (!redirectURI || !query.redirect_uri)
 /**
	* show UI error here warning the user that the redirect URI is invalid
	*/
	throw new APIError("BAD_REQUEST", { message: "Invalid redirect URI" });
	if (client.disabled) throw ctx.redirect(`${ctx.context.baseURL}/error?error=client_disabled`);
	if (query.response_type !== "code") throw ctx.redirect(`${ctx.context.baseURL}/error?error=unsupported_response_type`);
	const requestScope = query.scope?.split(" ").filter((s) => s) || opts.defaultScope.split(" ");
	const invalidScopes = requestScope.filter((scope) => {
		return !opts.scopes.includes(scope);
	});
	if (invalidScopes.length) throw ctx.redirect(redirectErrorURL(query.redirect_uri, "invalid_scope", `The following scopes are invalid: ${invalidScopes.join(", ")}`));
	if ((!query.code_challenge || !query.code_challenge_method) && options.requirePKCE) throw ctx.redirect(redirectErrorURL(query.redirect_uri, "invalid_request", "pkce is required"));
	if (!query.code_challenge_method) query.code_challenge_method = "plain";
	if (!["s256", options.allowPlainCodeChallengeMethod ? "plain" : "s256"].includes(query.code_challenge_method?.toLowerCase() || "")) throw ctx.redirect(redirectErrorURL(query.redirect_uri, "invalid_request", "invalid code_challenge method"));
	const code = generateRandomString(32, "a-z", "A-Z", "0-9");
	const codeExpiresInMs = opts.codeExpiresIn * 1e3;
	const expiresAt = new Date(Date.now() + codeExpiresInMs);
	try {
		/**
		* Save the code in the database
		*/
		await ctx.context.internalAdapter.createVerificationValue({
			value: JSON.stringify({
				clientId: client.clientId,
				redirectURI: query.redirect_uri,
				scope: requestScope,
				userId: session.user.id,
				authTime: new Date(session.session.createdAt).getTime(),
				requireConsent: query.prompt === "consent",
				state: query.prompt === "consent" ? query.state : null,
				codeChallenge: query.code_challenge,
				codeChallengeMethod: query.code_challenge_method,
				nonce: query.nonce
			}),
			identifier: code,
			expiresAt
		});
	} catch (e) {
		throw ctx.redirect(redirectErrorURL(query.redirect_uri, "server_error", "An error occurred while processing the request"));
	}
	if (query.prompt !== "consent") {
		const redirectURIWithCode$1 = new URL(redirectURI);
		redirectURIWithCode$1.searchParams.set("code", code);
		redirectURIWithCode$1.searchParams.set("state", ctx.query.state);
		throw ctx.redirect(redirectURIWithCode$1.toString());
	}
	if (options?.consentPage) {
		await ctx.setSignedCookie("oidc_consent_prompt", code, ctx.context.secret, {
			maxAge: 600,
			path: "/",
			sameSite: "lax"
		});
		const urlParams = new URLSearchParams();
		urlParams.set("consent_code", code);
		urlParams.set("client_id", client.clientId);
		urlParams.set("scope", requestScope.join(" "));
		const consentURI = `${options.consentPage}?${urlParams.toString()}`;
		throw ctx.redirect(consentURI);
	}
	const redirectURIWithCode = new URL(redirectURI);
	redirectURIWithCode.searchParams.set("code", code);
	redirectURIWithCode.searchParams.set("state", ctx.query.state);
	throw ctx.redirect(redirectURIWithCode.toString());
}

//#endregion
//#region src/plugins/mcp/index.ts
const getMCPProviderMetadata = (ctx, options) => {
	const issuer = ctx.context.options.baseURL;
	const baseURL = ctx.context.baseURL;
	if (!issuer || !baseURL) throw new APIError$1("INTERNAL_SERVER_ERROR", {
		error: "invalid_issuer",
		error_description: "issuer or baseURL is not set. If you're the app developer, please make sure to set the `baseURL` in your auth config."
	});
	return {
		issuer,
		authorization_endpoint: `${baseURL}/mcp/authorize`,
		token_endpoint: `${baseURL}/mcp/token`,
		userinfo_endpoint: `${baseURL}/mcp/userinfo`,
		jwks_uri: `${baseURL}/mcp/jwks`,
		registration_endpoint: `${baseURL}/mcp/register`,
		scopes_supported: [
			"openid",
			"profile",
			"email",
			"offline_access"
		],
		response_types_supported: ["code"],
		response_modes_supported: ["query"],
		grant_types_supported: ["authorization_code", "refresh_token"],
		acr_values_supported: ["urn:mace:incommon:iap:silver", "urn:mace:incommon:iap:bronze"],
		subject_types_supported: ["public"],
		id_token_signing_alg_values_supported: ["RS256", "none"],
		token_endpoint_auth_methods_supported: [
			"client_secret_basic",
			"client_secret_post",
			"none"
		],
		code_challenge_methods_supported: ["S256"],
		claims_supported: [
			"sub",
			"iss",
			"aud",
			"exp",
			"nbf",
			"iat",
			"jti",
			"email",
			"email_verified",
			"name"
		],
		...options?.metadata
	};
};
const getMCPProtectedResourceMetadata = (ctx, options) => {
	const baseURL = ctx.context.baseURL;
	return {
		resource: options?.resource ?? new URL(baseURL).origin,
		authorization_servers: [baseURL],
		jwks_uri: options?.oidcConfig?.metadata?.jwks_uri ?? `${baseURL}/mcp/jwks`,
		scopes_supported: options?.oidcConfig?.metadata?.scopes_supported ?? [
			"openid",
			"profile",
			"email",
			"offline_access"
		],
		bearer_methods_supported: ["header"],
		resource_signing_alg_values_supported: ["RS256", "none"]
	};
};
const mcp = (options) => {
	const opts = {
		codeExpiresIn: 600,
		defaultScope: "openid",
		accessTokenExpiresIn: 3600,
		refreshTokenExpiresIn: 604800,
		allowPlainCodeChallengeMethod: true,
		...options.oidcConfig,
		loginPage: options.loginPage,
		scopes: [
			"openid",
			"profile",
			"email",
			"offline_access",
			...options.oidcConfig?.scopes || []
		]
	};
	const modelName = {
		oauthClient: "oauthApplication",
		oauthAccessToken: "oauthAccessToken",
		oauthConsent: "oauthConsent"
	};
	const provider = oidcProvider(opts);
	return {
		id: "mcp",
		hooks: { after: [{
			matcher() {
				return true;
			},
			handler: createAuthMiddleware(async (ctx) => {
				const cookie = await ctx.getSignedCookie("oidc_login_prompt", ctx.context.secret);
				const cookieName = ctx.context.authCookies.sessionToken.name;
				const parsedSetCookieHeader = parseSetCookieHeader(ctx.context.responseHeaders?.get("set-cookie") || "");
				const hasSessionToken = parsedSetCookieHeader.has(cookieName);
				if (!cookie || !hasSessionToken) return;
				ctx.setCookie("oidc_login_prompt", "", { maxAge: 0 });
				const sessionToken = (parsedSetCookieHeader.get(cookieName)?.value)?.split(".")[0];
				if (!sessionToken) return;
				const session = await ctx.context.internalAdapter.findSession(sessionToken) || ctx.context.newSession;
				if (!session) return;
				const promptSet = parsePrompt(String(ctx.query?.prompt));
				if (promptSet.has("login")) {
					const newPromptSet = new Set(promptSet);
					newPromptSet.delete("login");
					ctx.query = {
						...ctx.query,
						prompt: Array.from(newPromptSet).join(" ")
					};
				}
				ctx.context.session = session;
				return await authorizeMCPOAuth(ctx, opts);
			})
		}] },
		endpoints: {
			oAuthConsent: provider.endpoints.oAuthConsent,
			getMcpOAuthConfig: createAuthEndpoint("/.well-known/oauth-authorization-server", {
				method: "GET",
				metadata: { client: false }
			}, async (c) => {
				try {
					const metadata = getMCPProviderMetadata(c, options);
					return c.json(metadata);
				} catch (e) {
					console.log(e);
					return c.json(null);
				}
			}),
			getMCPProtectedResource: createAuthEndpoint("/.well-known/oauth-protected-resource", {
				method: "GET",
				metadata: { client: false }
			}, async (c) => {
				const metadata = getMCPProtectedResourceMetadata(c, options);
				return c.json(metadata);
			}),
			mcpOAuthAuthorize: createAuthEndpoint("/mcp/authorize", {
				method: "GET",
				query: z.record(z.string(), z.any()),
				metadata: { openapi: {
					description: "Authorize an OAuth2 request using MCP",
					responses: { "200": {
						description: "Authorization response generated successfully",
						content: { "application/json": { schema: {
							type: "object",
							additionalProperties: true,
							description: "Authorization response, contents depend on the authorize function implementation"
						} } }
					} }
				} }
			}, async (ctx) => {
				return authorizeMCPOAuth(ctx, opts);
			}),
			mcpOAuthToken: createAuthEndpoint("/mcp/token", {
				method: "POST",
				body: z.record(z.any(), z.any()),
				metadata: {
					isAction: false,
					allowedMediaTypes: ["application/x-www-form-urlencoded", "application/json"]
				}
			}, async (ctx) => {
				ctx.setHeader("Access-Control-Allow-Origin", "*");
				ctx.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
				ctx.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
				ctx.setHeader("Access-Control-Max-Age", "86400");
				let { body } = ctx;
				if (!body) throw ctx.error("BAD_REQUEST", {
					error_description: "request body not found",
					error: "invalid_request"
				});
				if (body instanceof FormData) body = Object.fromEntries(body.entries());
				if (!(body instanceof Object)) throw new APIError$1("BAD_REQUEST", {
					error_description: "request body is not an object",
					error: "invalid_request"
				});
				let { client_id, client_secret } = body;
				const authorization = ctx.request?.headers.get("authorization") || null;
				if (authorization && !client_id && !client_secret && authorization.startsWith("Basic ")) try {
					const encoded = authorization.replace("Basic ", "");
					const decoded = new TextDecoder().decode(base64.decode(encoded));
					if (!decoded.includes(":")) throw new APIError$1("UNAUTHORIZED", {
						error_description: "invalid authorization header format",
						error: "invalid_client"
					});
					const [id, secret] = decoded.split(":");
					if (!id || !secret) throw new APIError$1("UNAUTHORIZED", {
						error_description: "invalid authorization header format",
						error: "invalid_client"
					});
					client_id = id;
					client_secret = secret;
				} catch (error) {
					throw new APIError$1("UNAUTHORIZED", {
						error_description: "invalid authorization header format",
						error: "invalid_client"
					});
				}
				const { grant_type, code, redirect_uri, refresh_token, code_verifier } = body;
				if (grant_type === "refresh_token") {
					if (!refresh_token) throw new APIError$1("BAD_REQUEST", {
						error_description: "refresh_token is required",
						error: "invalid_request"
					});
					const token = await ctx.context.adapter.findOne({
						model: "oauthAccessToken",
						where: [{
							field: "refreshToken",
							value: refresh_token.toString()
						}]
					});
					if (!token) throw new APIError$1("UNAUTHORIZED", {
						error_description: "invalid refresh token",
						error: "invalid_grant"
					});
					if (token.clientId !== client_id?.toString()) throw new APIError$1("UNAUTHORIZED", {
						error_description: "invalid client_id",
						error: "invalid_client"
					});
					if (token.refreshTokenExpiresAt < /* @__PURE__ */ new Date()) throw new APIError$1("UNAUTHORIZED", {
						error_description: "refresh token expired",
						error: "invalid_grant"
					});
					const accessToken$1 = generateRandomString(32, "a-z", "A-Z");
					const newRefreshToken = generateRandomString(32, "a-z", "A-Z");
					const accessTokenExpiresAt$1 = new Date(Date.now() + opts.accessTokenExpiresIn * 1e3);
					const refreshTokenExpiresAt$1 = new Date(Date.now() + opts.refreshTokenExpiresIn * 1e3);
					await ctx.context.adapter.create({
						model: modelName.oauthAccessToken,
						data: {
							accessToken: accessToken$1,
							refreshToken: newRefreshToken,
							accessTokenExpiresAt: accessTokenExpiresAt$1,
							refreshTokenExpiresAt: refreshTokenExpiresAt$1,
							clientId: client_id.toString(),
							userId: token.userId,
							scopes: token.scopes,
							createdAt: /* @__PURE__ */ new Date(),
							updatedAt: /* @__PURE__ */ new Date()
						}
					});
					return ctx.json({
						access_token: accessToken$1,
						token_type: "bearer",
						expires_in: opts.accessTokenExpiresIn,
						refresh_token: newRefreshToken,
						scope: token.scopes
					});
				}
				if (!code) throw new APIError$1("BAD_REQUEST", {
					error_description: "code is required",
					error: "invalid_request"
				});
				if (opts.requirePKCE && !code_verifier) throw new APIError$1("BAD_REQUEST", {
					error_description: "code verifier is missing",
					error: "invalid_request"
				});
				/**
				* We need to check if the code is valid before we can proceed
				* with the rest of the request.
				*/
				const verificationValue = await ctx.context.internalAdapter.findVerificationValue(code.toString());
				if (!verificationValue) throw new APIError$1("UNAUTHORIZED", {
					error_description: "invalid code",
					error: "invalid_grant"
				});
				if (verificationValue.expiresAt < /* @__PURE__ */ new Date()) throw new APIError$1("UNAUTHORIZED", {
					error_description: "code expired",
					error: "invalid_grant"
				});
				await ctx.context.internalAdapter.deleteVerificationValue(verificationValue.id);
				if (!client_id) throw new APIError$1("UNAUTHORIZED", {
					error_description: "client_id is required",
					error: "invalid_client"
				});
				if (!grant_type) throw new APIError$1("BAD_REQUEST", {
					error_description: "grant_type is required",
					error: "invalid_request"
				});
				if (grant_type !== "authorization_code") throw new APIError$1("BAD_REQUEST", {
					error_description: "grant_type must be 'authorization_code'",
					error: "unsupported_grant_type"
				});
				if (!redirect_uri) throw new APIError$1("BAD_REQUEST", {
					error_description: "redirect_uri is required",
					error: "invalid_request"
				});
				const client = await ctx.context.adapter.findOne({
					model: modelName.oauthClient,
					where: [{
						field: "clientId",
						value: client_id.toString()
					}]
				}).then((res) => {
					if (!res) return null;
					return {
						...res,
						redirectUrls: res.redirectUrls.split(","),
						metadata: res.metadata ? JSON.parse(res.metadata) : {}
					};
				});
				if (!client) throw new APIError$1("UNAUTHORIZED", {
					error_description: "invalid client_id",
					error: "invalid_client"
				});
				if (client.disabled) throw new APIError$1("UNAUTHORIZED", {
					error_description: "client is disabled",
					error: "invalid_client"
				});
				if (client.type === "public") {
					if (!code_verifier) throw new APIError$1("BAD_REQUEST", {
						error_description: "code verifier is required for public clients",
						error: "invalid_request"
					});
				} else {
					if (!client_secret) throw new APIError$1("UNAUTHORIZED", {
						error_description: "client_secret is required for confidential clients",
						error: "invalid_client"
					});
					if (!(client.clientSecret === client_secret.toString())) throw new APIError$1("UNAUTHORIZED", {
						error_description: "invalid client_secret",
						error: "invalid_client"
					});
				}
				const value = JSON.parse(verificationValue.value);
				if (value.clientId !== client_id.toString()) throw new APIError$1("UNAUTHORIZED", {
					error_description: "invalid client_id",
					error: "invalid_client"
				});
				if (value.redirectURI !== redirect_uri.toString()) throw new APIError$1("UNAUTHORIZED", {
					error_description: "invalid redirect_uri",
					error: "invalid_client"
				});
				if (value.codeChallenge && !code_verifier) throw new APIError$1("BAD_REQUEST", {
					error_description: "code verifier is missing",
					error: "invalid_request"
				});
				if ((value.codeChallengeMethod === "plain" ? code_verifier : await createHash("SHA-256", "base64urlnopad").digest(code_verifier)) !== value.codeChallenge) throw new APIError$1("UNAUTHORIZED", {
					error_description: "code verification failed",
					error: "invalid_request"
				});
				const requestedScopes = value.scope;
				await ctx.context.internalAdapter.deleteVerificationValue(verificationValue.id);
				const accessToken = generateRandomString(32, "a-z", "A-Z");
				const refreshToken = generateRandomString(32, "A-Z", "a-z");
				const accessTokenExpiresAt = new Date(Date.now() + opts.accessTokenExpiresIn * 1e3);
				const refreshTokenExpiresAt = new Date(Date.now() + opts.refreshTokenExpiresIn * 1e3);
				await ctx.context.adapter.create({
					model: modelName.oauthAccessToken,
					data: {
						accessToken,
						refreshToken,
						accessTokenExpiresAt,
						refreshTokenExpiresAt,
						clientId: client_id.toString(),
						userId: value.userId,
						scopes: requestedScopes.join(" "),
						createdAt: /* @__PURE__ */ new Date(),
						updatedAt: /* @__PURE__ */ new Date()
					}
				});
				const user = await ctx.context.internalAdapter.findUserById(value.userId);
				if (!user) throw new APIError$1("UNAUTHORIZED", {
					error_description: "user not found",
					error: "invalid_grant"
				});
				let secretKey = {
					alg: "HS256",
					key: await getWebcryptoSubtle().generateKey({
						name: "HMAC",
						hash: "SHA-256"
					}, true, ["sign", "verify"])
				};
				const profile = {
					given_name: user.name.split(" ")[0],
					family_name: user.name.split(" ")[1],
					name: user.name,
					profile: user.image,
					updated_at: Math.floor(new Date(user.updatedAt).getTime() / 1e3)
				};
				const email = {
					email: user.email,
					email_verified: user.emailVerified
				};
				const userClaims = {
					...requestedScopes.includes("profile") ? profile : {},
					...requestedScopes.includes("email") ? email : {}
				};
				const additionalUserClaims = opts.getAdditionalUserInfoClaim ? await opts.getAdditionalUserInfoClaim(user, requestedScopes, client) : {};
				const idToken = await new SignJWT({
					sub: user.id,
					aud: client_id.toString(),
					iat: Date.now(),
					auth_time: ctx.context.session ? new Date(ctx.context.session.session.createdAt).getTime() : void 0,
					nonce: value.nonce,
					acr: "urn:mace:incommon:iap:silver",
					...userClaims,
					...additionalUserClaims
				}).setProtectedHeader({ alg: secretKey.alg }).setIssuedAt().setExpirationTime(Math.floor(Date.now() / 1e3) + opts.accessTokenExpiresIn).sign(secretKey.key);
				return ctx.json({
					access_token: accessToken,
					token_type: "Bearer",
					expires_in: opts.accessTokenExpiresIn,
					refresh_token: requestedScopes.includes("offline_access") ? refreshToken : void 0,
					scope: requestedScopes.join(" "),
					id_token: requestedScopes.includes("openid") ? idToken : void 0
				}, { headers: {
					"Cache-Control": "no-store",
					Pragma: "no-cache"
				} });
			}),
			registerMcpClient: createAuthEndpoint("/mcp/register", {
				method: "POST",
				body: z.object({
					redirect_uris: z.array(z.string()),
					token_endpoint_auth_method: z.enum([
						"none",
						"client_secret_basic",
						"client_secret_post"
					]).default("client_secret_basic").optional(),
					grant_types: z.array(z.enum([
						"authorization_code",
						"implicit",
						"password",
						"client_credentials",
						"refresh_token",
						"urn:ietf:params:oauth:grant-type:jwt-bearer",
						"urn:ietf:params:oauth:grant-type:saml2-bearer"
					])).default(["authorization_code"]).optional(),
					response_types: z.array(z.enum(["code", "token"])).default(["code"]).optional(),
					client_name: z.string().optional(),
					client_uri: z.string().optional(),
					logo_uri: z.string().optional(),
					scope: z.string().optional(),
					contacts: z.array(z.string()).optional(),
					tos_uri: z.string().optional(),
					policy_uri: z.string().optional(),
					jwks_uri: z.string().optional(),
					jwks: z.record(z.string(), z.any()).optional(),
					metadata: z.record(z.any(), z.any()).optional(),
					software_id: z.string().optional(),
					software_version: z.string().optional(),
					software_statement: z.string().optional()
				}),
				metadata: { openapi: {
					description: "Register an OAuth2 application",
					responses: { "200": {
						description: "OAuth2 application registered successfully",
						content: { "application/json": { schema: {
							type: "object",
							properties: {
								name: {
									type: "string",
									description: "Name of the OAuth2 application"
								},
								icon: {
									type: "string",
									nullable: true,
									description: "Icon URL for the application"
								},
								metadata: {
									type: "object",
									additionalProperties: true,
									nullable: true,
									description: "Additional metadata for the application"
								},
								clientId: {
									type: "string",
									description: "Unique identifier for the client"
								},
								clientSecret: {
									type: "string",
									description: "Secret key for the client. Not included for public clients."
								},
								redirectUrls: {
									type: "array",
									items: {
										type: "string",
										format: "uri"
									},
									description: "List of allowed redirect URLs"
								},
								type: {
									type: "string",
									description: "Type of the client",
									enum: ["web", "public"]
								},
								authenticationScheme: {
									type: "string",
									description: "Authentication scheme used by the client",
									enum: ["client_secret", "none"]
								},
								disabled: {
									type: "boolean",
									description: "Whether the client is disabled",
									enum: [false]
								},
								userId: {
									type: "string",
									nullable: true,
									description: "ID of the user who registered the client, null if registered anonymously"
								},
								createdAt: {
									type: "string",
									format: "date-time",
									description: "Creation timestamp"
								},
								updatedAt: {
									type: "string",
									format: "date-time",
									description: "Last update timestamp"
								}
							},
							required: [
								"name",
								"clientId",
								"redirectUrls",
								"type",
								"authenticationScheme",
								"disabled",
								"createdAt",
								"updatedAt"
							]
						} } }
					} }
				} }
			}, async (ctx) => {
				const body = ctx.body;
				const session = await getSessionFromCtx(ctx);
				ctx.setHeader("Access-Control-Allow-Origin", "*");
				ctx.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
				ctx.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
				ctx.setHeader("Access-Control-Max-Age", "86400");
				ctx.headers?.set("Access-Control-Max-Age", "86400");
				if ((!body.grant_types || body.grant_types.includes("authorization_code") || body.grant_types.includes("implicit")) && (!body.redirect_uris || body.redirect_uris.length === 0)) throw new APIError$1("BAD_REQUEST", {
					error: "invalid_redirect_uri",
					error_description: "Redirect URIs are required for authorization_code and implicit grant types"
				});
				if (body.grant_types && body.response_types) {
					if (body.grant_types.includes("authorization_code") && !body.response_types.includes("code")) throw new APIError$1("BAD_REQUEST", {
						error: "invalid_client_metadata",
						error_description: "When 'authorization_code' grant type is used, 'code' response type must be included"
					});
					if (body.grant_types.includes("implicit") && !body.response_types.includes("token")) throw new APIError$1("BAD_REQUEST", {
						error: "invalid_client_metadata",
						error_description: "When 'implicit' grant type is used, 'token' response type must be included"
					});
				}
				const clientId = opts.generateClientId?.() || generateRandomString(32, "a-z", "A-Z");
				const clientSecret = opts.generateClientSecret?.() || generateRandomString(32, "a-z", "A-Z");
				const clientType = body.token_endpoint_auth_method === "none" ? "public" : "web";
				const finalClientSecret = clientType === "public" ? "" : clientSecret;
				await ctx.context.adapter.create({
					model: modelName.oauthClient,
					data: {
						name: body.client_name,
						icon: body.logo_uri,
						metadata: body.metadata ? JSON.stringify(body.metadata) : null,
						clientId,
						clientSecret: finalClientSecret,
						redirectUrls: body.redirect_uris.join(","),
						type: clientType,
						authenticationScheme: body.token_endpoint_auth_method || "client_secret_basic",
						disabled: false,
						userId: session?.session.userId,
						createdAt: /* @__PURE__ */ new Date(),
						updatedAt: /* @__PURE__ */ new Date()
					}
				});
				const responseData = {
					client_id: clientId,
					client_id_issued_at: Math.floor(Date.now() / 1e3),
					redirect_uris: body.redirect_uris,
					token_endpoint_auth_method: body.token_endpoint_auth_method || "client_secret_basic",
					grant_types: body.grant_types || ["authorization_code"],
					response_types: body.response_types || ["code"],
					client_name: body.client_name,
					client_uri: body.client_uri,
					logo_uri: body.logo_uri,
					scope: body.scope,
					contacts: body.contacts,
					tos_uri: body.tos_uri,
					policy_uri: body.policy_uri,
					jwks_uri: body.jwks_uri,
					jwks: body.jwks,
					software_id: body.software_id,
					software_version: body.software_version,
					software_statement: body.software_statement,
					metadata: body.metadata,
					...clientType !== "public" ? {
						client_secret: finalClientSecret,
						client_secret_expires_at: 0
					} : {}
				};
				return new Response(JSON.stringify(responseData), {
					status: 201,
					headers: {
						"Content-Type": "application/json",
						"Cache-Control": "no-store",
						Pragma: "no-cache"
					}
				});
			}),
			getMcpSession: createAuthEndpoint("/mcp/get-session", {
				method: "GET",
				requireHeaders: true
			}, async (c) => {
				const accessToken = c.headers?.get("Authorization")?.replace("Bearer ", "");
				if (!accessToken) {
					c.headers?.set("WWW-Authenticate", "Bearer");
					return c.json(null);
				}
				const accessTokenData = await c.context.adapter.findOne({
					model: modelName.oauthAccessToken,
					where: [{
						field: "accessToken",
						value: accessToken
					}]
				});
				if (!accessTokenData) return c.json(null);
				return c.json(accessTokenData);
			})
		},
		schema
	};
};
const withMcpAuth = (auth, handler) => {
	return async (req) => {
		const baseURL = getBaseURL(auth.options.baseURL, auth.options.basePath);
		if (!baseURL && !isProduction) logger.warn("Unable to get the baseURL, please check your config!");
		const session = await auth.api.getMcpSession({ headers: req.headers });
		const wwwAuthenticateValue = `Bearer resource_metadata="${baseURL}/.well-known/oauth-protected-resource"`;
		if (!session) return Response.json({
			jsonrpc: "2.0",
			error: {
				code: -32e3,
				message: "Unauthorized: Authentication required",
				"www-authenticate": wwwAuthenticateValue
			},
			id: null
		}, {
			status: 401,
			headers: {
				"WWW-Authenticate": wwwAuthenticateValue,
				"Access-Control-Expose-Headers": "WWW-Authenticate"
			}
		});
		return handler(req, session);
	};
};
const oAuthDiscoveryMetadata = (auth) => {
	return async (request) => {
		const res = await auth.api.getMcpOAuthConfig();
		return new Response(JSON.stringify(res), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "POST, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type, Authorization",
				"Access-Control-Max-Age": "86400"
			}
		});
	};
};
const oAuthProtectedResourceMetadata = (auth) => {
	return async (request) => {
		const res = await auth.api.getMCPProtectedResource();
		return new Response(JSON.stringify(res), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "POST, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type, Authorization",
				"Access-Control-Max-Age": "86400"
			}
		});
	};
};

//#endregion
//#region src/plugins/one-time-token/index.ts
const oneTimeToken = (options) => {
	const opts = {
		storeToken: "plain",
		...options
	};
	async function storeToken(ctx, token) {
		if (opts.storeToken === "hashed") return await defaultKeyHasher(token);
		if (typeof opts.storeToken === "object" && "type" in opts.storeToken && opts.storeToken.type === "custom-hasher") return await opts.storeToken.hash(token);
		return token;
	}
	return {
		id: "one-time-token",
		endpoints: {
			generateOneTimeToken: createAuthEndpoint("/one-time-token/generate", {
				method: "GET",
				use: [sessionMiddleware]
			}, async (c) => {
				if (opts?.disableClientRequest && c.request) throw c.error("BAD_REQUEST", { message: "Client requests are disabled" });
				const session = c.context.session;
				const token = opts?.generateToken ? await opts.generateToken(session, c) : generateRandomString(32);
				const expiresAt = new Date(Date.now() + (opts?.expiresIn ?? 3) * 60 * 1e3);
				const storedToken = await storeToken(c, token);
				await c.context.internalAdapter.createVerificationValue({
					value: session.session.token,
					identifier: `one-time-token:${storedToken}`,
					expiresAt
				});
				return c.json({ token });
			}),
			verifyOneTimeToken: createAuthEndpoint("/one-time-token/verify", {
				method: "POST",
				body: z.object({ token: z.string().meta({ description: "The token to verify. Eg: \"some-token\"" }) })
			}, async (c) => {
				const { token } = c.body;
				const storedToken = await storeToken(c, token);
				const verificationValue = await c.context.internalAdapter.findVerificationValue(`one-time-token:${storedToken}`);
				if (!verificationValue) throw c.error("BAD_REQUEST", { message: "Invalid token" });
				await c.context.internalAdapter.deleteVerificationValue(verificationValue.id);
				if (verificationValue.expiresAt < /* @__PURE__ */ new Date()) throw c.error("BAD_REQUEST", { message: "Token expired" });
				const session = await c.context.internalAdapter.findSession(verificationValue.value);
				if (!session) throw c.error("BAD_REQUEST", { message: "Session not found" });
				return c.json(session);
			})
		}
	};
};

//#endregion
export { getMCPProtectedResourceMetadata as a, oAuthDiscoveryMetadata as c, lastLoginMethod as d, API_KEY_TABLE_NAME as f, defaultKeyHasher as h, oneTimeToken as i, oAuthProtectedResourceMetadata as l, apiKey as m, createAuthMiddleware$1 as n, getMCPProviderMetadata as o, ERROR_CODES as p, optionsMiddleware as r, mcp as s, createAuthEndpoint$1 as t, withMcpAuth as u };