import { a as getAuthTables } from "./get-model-name-D4DUV7S2.mjs";
import { a as createInternalAdapter } from "./get-migration-6ewabxRC.mjs";
import { t as generateId } from "./utils-DBbaShi0.mjs";
import { a as verifyPassword, i as hashPassword } from "./crypto-BQxYXGGX.mjs";
import { r as getOrigin, t as getBaseURL } from "./url-BLNRhCPO.mjs";
import { a as getEndpoints, n as checkEndpointConflicts, s as router } from "./api-q2sbQ7PT.mjs";
import { i as getCookies, t as createCookieGetter } from "./cookies-D_dksn7B.mjs";
import { t as checkPassword } from "./password-DBH2q5D6.mjs";
import { runWithAdapter } from "@better-auth/core/context";
import { createLogger, env, isProduction, isTest } from "@better-auth/core/env";
import { BASE_ERROR_CODES, BetterAuthError } from "@better-auth/core/error";
import { socialProviders } from "@better-auth/core/social-providers";
import { createTelemetry } from "@better-auth/telemetry";
import defu$1, { defu } from "defu";

//#region src/utils/constants.ts
const DEFAULT_SECRET = "better-auth-secret-123456789";

//#endregion
//#region src/utils/is-promise.ts
function isPromise(obj) {
	return !!obj && (typeof obj === "object" || typeof obj === "function") && typeof obj.then === "function";
}

//#endregion
//#region src/context/helpers.ts
async function runPluginInit(ctx) {
	let options = ctx.options;
	const plugins = options.plugins || [];
	let context = ctx;
	const dbHooks = [];
	for (const plugin of plugins) if (plugin.init) {
		let initPromise = plugin.init(context);
		let result;
		if (isPromise(initPromise)) result = await initPromise;
		else result = initPromise;
		if (typeof result === "object") {
			if (result.options) {
				const { databaseHooks, ...restOpts } = result.options;
				if (databaseHooks) dbHooks.push(databaseHooks);
				options = defu(options, restOpts);
			}
			if (result.context) context = {
				...context,
				...result.context
			};
		}
	}
	dbHooks.push(options.databaseHooks);
	context.internalAdapter = createInternalAdapter(context.adapter, {
		options,
		logger: context.logger,
		hooks: dbHooks.filter((u) => u !== void 0),
		generateId: context.generateId
	});
	context.options = options;
	return { context };
}
function getInternalPlugins(options) {
	const plugins = [];
	if (options.advanced?.crossSubDomainCookies?.enabled) {}
	return plugins;
}
function getTrustedOrigins(options) {
	const baseURL = getBaseURL(options.baseURL, options.basePath);
	if (!baseURL) return [];
	const trustedOrigins = [new URL(baseURL).origin];
	if (options.trustedOrigins && Array.isArray(options.trustedOrigins)) trustedOrigins.push(...options.trustedOrigins);
	const envTrustedOrigins = env.BETTER_AUTH_TRUSTED_ORIGINS;
	if (envTrustedOrigins) trustedOrigins.push(...envTrustedOrigins.split(","));
	if (trustedOrigins.filter((x) => !x).length) throw new BetterAuthError("A provided trusted origin is invalid, make sure your trusted origins list is properly defined.");
	return trustedOrigins;
}

//#endregion
//#region src/context/create-context.ts
async function createAuthContext(adapter, options, getDatabaseType) {
	if (!options.database) options = defu$1(options, {
		session: { cookieCache: {
			enabled: true,
			strategy: "jwe",
			refreshCache: true
		} },
		account: {
			storeStateStrategy: "cookie",
			storeAccountCookie: true
		}
	});
	const plugins = options.plugins || [];
	const internalPlugins = getInternalPlugins(options);
	const logger$1 = createLogger(options.logger);
	const baseURL = getBaseURL(options.baseURL, options.basePath);
	const secret = options.secret || env.BETTER_AUTH_SECRET || env.AUTH_SECRET || DEFAULT_SECRET;
	if (secret === DEFAULT_SECRET) {
		if (isProduction) logger$1.error("You are using the default secret. Please set `BETTER_AUTH_SECRET` in your environment variables or pass `secret` in your auth config.");
	}
	options = {
		...options,
		secret,
		baseURL: baseURL ? new URL(baseURL).origin : "",
		basePath: options.basePath || "/api/auth",
		plugins: plugins.concat(internalPlugins)
	};
	checkEndpointConflicts(options, logger$1);
	const cookies = getCookies(options);
	const tables = getAuthTables(options);
	const providers = Object.entries(options.socialProviders || {}).map(([key, config]) => {
		if (config == null) return null;
		if (config.enabled === false) return null;
		if (!config.clientId) logger$1.warn(`Social provider ${key} is missing clientId or clientSecret`);
		const provider = socialProviders[key](config);
		provider.disableImplicitSignUp = config.disableImplicitSignUp;
		return provider;
	}).filter((x) => x !== null);
	const generateIdFunc = ({ model, size }) => {
		if (typeof options.advanced?.generateId === "function") return options.advanced.generateId({
			model,
			size
		});
		if (typeof options?.advanced?.database?.generateId === "function") return options.advanced.database.generateId({
			model,
			size
		});
		return generateId(size);
	};
	const { publish } = await createTelemetry(options, {
		adapter: adapter.id,
		database: typeof options.database === "function" ? "adapter" : getDatabaseType(options.database)
	});
	const initOrPromise = runPluginInit({
		appName: options.appName || "Better Auth",
		socialProviders: providers,
		options,
		oauthConfig: {
			storeStateStrategy: options.account?.storeStateStrategy || "database",
			skipStateCookieCheck: !!options.account?.skipStateCookieCheck
		},
		tables,
		trustedOrigins: getTrustedOrigins(options),
		baseURL: baseURL || "",
		sessionConfig: {
			updateAge: options.session?.updateAge !== void 0 ? options.session.updateAge : 1440 * 60,
			expiresIn: options.session?.expiresIn || 3600 * 24 * 7,
			freshAge: options.session?.freshAge === void 0 ? 3600 * 24 : options.session.freshAge,
			cookieRefreshCache: (() => {
				const refreshCache = options.session?.cookieCache?.refreshCache;
				const maxAge = options.session?.cookieCache?.maxAge || 300;
				if (refreshCache === false || refreshCache === void 0) return false;
				if (refreshCache === true) return {
					enabled: true,
					updateAge: Math.floor(maxAge * .2)
				};
				return {
					enabled: true,
					updateAge: refreshCache.updateAge !== void 0 ? refreshCache.updateAge : Math.floor(maxAge * .2)
				};
			})()
		},
		secret,
		rateLimit: {
			...options.rateLimit,
			enabled: options.rateLimit?.enabled ?? isProduction,
			window: options.rateLimit?.window || 10,
			max: options.rateLimit?.max || 100,
			storage: options.rateLimit?.storage || (options.secondaryStorage ? "secondary-storage" : "memory")
		},
		authCookies: cookies,
		logger: logger$1,
		generateId: generateIdFunc,
		session: null,
		secondaryStorage: options.secondaryStorage,
		password: {
			hash: options.emailAndPassword?.password?.hash || hashPassword,
			verify: options.emailAndPassword?.password?.verify || verifyPassword,
			config: {
				minPasswordLength: options.emailAndPassword?.minPasswordLength || 8,
				maxPasswordLength: options.emailAndPassword?.maxPasswordLength || 128
			},
			checkPassword
		},
		setNewSession(session) {
			this.newSession = session;
		},
		newSession: null,
		adapter,
		internalAdapter: createInternalAdapter(adapter, {
			options,
			logger: logger$1,
			hooks: options.databaseHooks ? [options.databaseHooks] : [],
			generateId: generateIdFunc
		}),
		createAuthCookie: createCookieGetter(options),
		async runMigrations() {
			throw new BetterAuthError("runMigrations will be set by the specific init implementation");
		},
		publishTelemetry: publish,
		skipCSRFCheck: !!options.advanced?.disableCSRFCheck,
		skipOriginCheck: options.advanced?.disableOriginCheck !== void 0 ? options.advanced.disableOriginCheck : isTest() ? true : false
	});
	let context;
	if (isPromise(initOrPromise)) ({context} = await initOrPromise);
	else ({context} = initOrPromise);
	return context;
}

//#endregion
//#region src/auth/base.ts
const createBetterAuth = (options, initFn) => {
	const authContext = initFn(options);
	const { api } = getEndpoints(authContext, options);
	return {
		handler: async (request) => {
			const ctx = await authContext;
			const basePath = ctx.options.basePath || "/api/auth";
			if (!ctx.options.baseURL) {
				const baseURL = getBaseURL(void 0, basePath, request, void 0, ctx.options.advanced?.trustedProxyHeaders);
				if (baseURL) {
					ctx.baseURL = baseURL;
					ctx.options.baseURL = getOrigin(ctx.baseURL) || void 0;
				} else throw new BetterAuthError("Could not get base URL from request. Please provide a valid base URL.");
			}
			ctx.trustedOrigins = [...options.trustedOrigins ? Array.isArray(options.trustedOrigins) ? options.trustedOrigins : await options.trustedOrigins(request) : [], ctx.options.baseURL];
			const { handler } = router(ctx, options);
			return runWithAdapter(ctx.adapter, () => handler(request));
		},
		api,
		options,
		$context: authContext,
		$ERROR_CODES: {
			...options.plugins?.reduce((acc, plugin) => {
				if (plugin.$ERROR_CODES) return {
					...acc,
					...plugin.$ERROR_CODES
				};
				return acc;
			}, {}),
			...BASE_ERROR_CODES
		}
	};
};

//#endregion
export { createAuthContext as n, createBetterAuth as t };