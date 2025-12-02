import { ENV, env, getBooleanEnvVar, getEnvVar, isTest, logger } from "@better-auth/core/env";
import { betterFetch } from "@better-fetch/fetch";
import { base64 } from "@better-auth/utils/base64";
import { createHash } from "@better-auth/utils/hash";
import { createRandomStringGenerator } from "@better-auth/utils/random";

//#region src/detectors/detect-auth-config.ts
function getTelemetryAuthConfig(options, context) {
	return {
		database: context?.database,
		adapter: context?.adapter,
		emailVerification: {
			sendVerificationEmail: !!options.emailVerification?.sendVerificationEmail,
			sendOnSignUp: !!options.emailVerification?.sendOnSignUp,
			sendOnSignIn: !!options.emailVerification?.sendOnSignIn,
			autoSignInAfterVerification: !!options.emailVerification?.autoSignInAfterVerification,
			expiresIn: options.emailVerification?.expiresIn,
			onEmailVerification: !!options.emailVerification?.onEmailVerification,
			afterEmailVerification: !!options.emailVerification?.afterEmailVerification
		},
		emailAndPassword: {
			enabled: !!options.emailAndPassword?.enabled,
			disableSignUp: !!options.emailAndPassword?.disableSignUp,
			requireEmailVerification: !!options.emailAndPassword?.requireEmailVerification,
			maxPasswordLength: options.emailAndPassword?.maxPasswordLength,
			minPasswordLength: options.emailAndPassword?.minPasswordLength,
			sendResetPassword: !!options.emailAndPassword?.sendResetPassword,
			resetPasswordTokenExpiresIn: options.emailAndPassword?.resetPasswordTokenExpiresIn,
			onPasswordReset: !!options.emailAndPassword?.onPasswordReset,
			password: {
				hash: !!options.emailAndPassword?.password?.hash,
				verify: !!options.emailAndPassword?.password?.verify
			},
			autoSignIn: !!options.emailAndPassword?.autoSignIn,
			revokeSessionsOnPasswordReset: !!options.emailAndPassword?.revokeSessionsOnPasswordReset
		},
		socialProviders: Object.keys(options.socialProviders || {}).map((p) => {
			const provider = options.socialProviders?.[p];
			if (!provider) return {};
			return {
				id: p,
				mapProfileToUser: !!provider.mapProfileToUser,
				disableDefaultScope: !!provider.disableDefaultScope,
				disableIdTokenSignIn: !!provider.disableIdTokenSignIn,
				disableImplicitSignUp: provider.disableImplicitSignUp,
				disableSignUp: provider.disableSignUp,
				getUserInfo: !!provider.getUserInfo,
				overrideUserInfoOnSignIn: !!provider.overrideUserInfoOnSignIn,
				prompt: provider.prompt,
				verifyIdToken: !!provider.verifyIdToken,
				scope: provider.scope,
				refreshAccessToken: !!provider.refreshAccessToken
			};
		}),
		plugins: options.plugins?.map((p) => p.id.toString()),
		user: {
			modelName: options.user?.modelName,
			fields: options.user?.fields,
			additionalFields: options.user?.additionalFields,
			changeEmail: {
				enabled: options.user?.changeEmail?.enabled,
				sendChangeEmailVerification: !!options.user?.changeEmail?.sendChangeEmailVerification
			}
		},
		verification: {
			modelName: options.verification?.modelName,
			disableCleanup: options.verification?.disableCleanup,
			fields: options.verification?.fields
		},
		session: {
			modelName: options.session?.modelName,
			additionalFields: options.session?.additionalFields,
			cookieCache: {
				enabled: options.session?.cookieCache?.enabled,
				maxAge: options.session?.cookieCache?.maxAge,
				strategy: options.session?.cookieCache?.strategy
			},
			disableSessionRefresh: options.session?.disableSessionRefresh,
			expiresIn: options.session?.expiresIn,
			fields: options.session?.fields,
			freshAge: options.session?.freshAge,
			preserveSessionInDatabase: options.session?.preserveSessionInDatabase,
			storeSessionInDatabase: options.session?.storeSessionInDatabase,
			updateAge: options.session?.updateAge
		},
		account: {
			modelName: options.account?.modelName,
			fields: options.account?.fields,
			encryptOAuthTokens: options.account?.encryptOAuthTokens,
			updateAccountOnSignIn: options.account?.updateAccountOnSignIn,
			accountLinking: {
				enabled: options.account?.accountLinking?.enabled,
				trustedProviders: options.account?.accountLinking?.trustedProviders,
				updateUserInfoOnLink: options.account?.accountLinking?.updateUserInfoOnLink,
				allowUnlinkingAll: options.account?.accountLinking?.allowUnlinkingAll
			}
		},
		hooks: {
			after: !!options.hooks?.after,
			before: !!options.hooks?.before
		},
		secondaryStorage: !!options.secondaryStorage,
		advanced: {
			cookiePrefix: !!options.advanced?.cookiePrefix,
			cookies: !!options.advanced?.cookies,
			crossSubDomainCookies: {
				domain: !!options.advanced?.crossSubDomainCookies?.domain,
				enabled: options.advanced?.crossSubDomainCookies?.enabled,
				additionalCookies: options.advanced?.crossSubDomainCookies?.additionalCookies
			},
			database: {
				useNumberId: !!options.advanced?.database?.useNumberId || options.advanced?.database?.generateId === "serial",
				generateId: options.advanced?.database?.generateId,
				defaultFindManyLimit: options.advanced?.database?.defaultFindManyLimit
			},
			useSecureCookies: options.advanced?.useSecureCookies,
			ipAddress: {
				disableIpTracking: options.advanced?.ipAddress?.disableIpTracking,
				ipAddressHeaders: options.advanced?.ipAddress?.ipAddressHeaders
			},
			disableCSRFCheck: options.advanced?.disableCSRFCheck,
			cookieAttributes: {
				expires: options.advanced?.defaultCookieAttributes?.expires,
				secure: options.advanced?.defaultCookieAttributes?.secure,
				sameSite: options.advanced?.defaultCookieAttributes?.sameSite,
				domain: !!options.advanced?.defaultCookieAttributes?.domain,
				path: options.advanced?.defaultCookieAttributes?.path,
				httpOnly: options.advanced?.defaultCookieAttributes?.httpOnly
			}
		},
		trustedOrigins: options.trustedOrigins?.length,
		rateLimit: {
			storage: options.rateLimit?.storage,
			modelName: options.rateLimit?.modelName,
			window: options.rateLimit?.window,
			customStorage: !!options.rateLimit?.customStorage,
			enabled: options.rateLimit?.enabled,
			max: options.rateLimit?.max
		},
		onAPIError: {
			errorURL: options.onAPIError?.errorURL,
			onError: !!options.onAPIError?.onError,
			throw: options.onAPIError?.throw
		},
		logger: {
			disabled: options.logger?.disabled,
			level: options.logger?.level,
			log: !!options.logger?.log
		},
		databaseHooks: {
			user: {
				create: {
					after: !!options.databaseHooks?.user?.create?.after,
					before: !!options.databaseHooks?.user?.create?.before
				},
				update: {
					after: !!options.databaseHooks?.user?.update?.after,
					before: !!options.databaseHooks?.user?.update?.before
				}
			},
			session: {
				create: {
					after: !!options.databaseHooks?.session?.create?.after,
					before: !!options.databaseHooks?.session?.create?.before
				},
				update: {
					after: !!options.databaseHooks?.session?.update?.after,
					before: !!options.databaseHooks?.session?.update?.before
				}
			},
			account: {
				create: {
					after: !!options.databaseHooks?.account?.create?.after,
					before: !!options.databaseHooks?.account?.create?.before
				},
				update: {
					after: !!options.databaseHooks?.account?.update?.after,
					before: !!options.databaseHooks?.account?.update?.before
				}
			},
			verification: {
				create: {
					after: !!options.databaseHooks?.verification?.create?.after,
					before: !!options.databaseHooks?.verification?.create?.before
				},
				update: {
					after: !!options.databaseHooks?.verification?.update?.after,
					before: !!options.databaseHooks?.verification?.update?.before
				}
			}
		}
	};
}

//#endregion
//#region src/utils/package-json.ts
let packageJSONCache;
async function readRootPackageJson() {
	if (packageJSONCache) return packageJSONCache;
	try {
		const cwd = typeof process !== "undefined" && typeof process.cwd === "function" ? process.cwd() : "";
		if (!cwd) return void 0;
		const importRuntime$1 = (m) => Function("mm", "return import(mm)")(m);
		const [{ default: fs }, { default: path }] = await Promise.all([importRuntime$1("fs/promises"), importRuntime$1("path")]);
		const raw = await fs.readFile(path.join(cwd, "package.json"), "utf-8");
		packageJSONCache = JSON.parse(raw);
		return packageJSONCache;
	} catch {}
}
async function getPackageVersion(pkg) {
	if (packageJSONCache) return packageJSONCache.dependencies?.[pkg] || packageJSONCache.devDependencies?.[pkg] || packageJSONCache.peerDependencies?.[pkg];
	try {
		const cwd = typeof process !== "undefined" && typeof process.cwd === "function" ? process.cwd() : "";
		if (!cwd) throw new Error("no-cwd");
		const importRuntime$1 = (m) => Function("mm", "return import(mm)")(m);
		const [{ default: fs }, { default: path }] = await Promise.all([importRuntime$1("fs/promises"), importRuntime$1("path")]);
		const pkgJsonPath = path.join(cwd, "node_modules", pkg, "package.json");
		const raw = await fs.readFile(pkgJsonPath, "utf-8");
		return JSON.parse(raw).version || await getVersionFromLocalPackageJson(pkg) || void 0;
	} catch {}
	return await getVersionFromLocalPackageJson(pkg);
}
async function getVersionFromLocalPackageJson(pkg) {
	const json = await readRootPackageJson();
	if (!json) return void 0;
	return {
		...json.dependencies,
		...json.devDependencies,
		...json.peerDependencies
	}[pkg];
}
async function getNameFromLocalPackageJson() {
	return (await readRootPackageJson())?.name;
}

//#endregion
//#region src/detectors/detect-database.ts
const DATABASES = {
	pg: "postgresql",
	mysql: "mysql",
	mariadb: "mariadb",
	sqlite3: "sqlite",
	"better-sqlite3": "sqlite",
	"@prisma/client": "prisma",
	mongoose: "mongodb",
	mongodb: "mongodb",
	"drizzle-orm": "drizzle"
};
async function detectDatabase() {
	for (const [pkg, name] of Object.entries(DATABASES)) {
		const version = await getPackageVersion(pkg);
		if (version) return {
			name,
			version
		};
	}
}

//#endregion
//#region src/detectors/detect-framework.ts
const FRAMEWORKS = {
	next: "next",
	nuxt: "nuxt",
	"@remix-run/server-runtime": "remix",
	astro: "astro",
	"@sveltejs/kit": "sveltekit",
	"solid-start": "solid-start",
	"tanstack-start": "tanstack-start",
	hono: "hono",
	express: "express",
	elysia: "elysia",
	expo: "expo"
};
async function detectFramework() {
	for (const [pkg, name] of Object.entries(FRAMEWORKS)) {
		const version = await getPackageVersion(pkg);
		if (version) return {
			name,
			version
		};
	}
}

//#endregion
//#region src/detectors/detect-project-info.ts
function detectPackageManager() {
	const userAgent = env.npm_config_user_agent;
	if (!userAgent) return;
	const pmSpec = userAgent.split(" ")[0];
	const separatorPos = pmSpec.lastIndexOf("/");
	const name = pmSpec.substring(0, separatorPos);
	return {
		name: name === "npminstall" ? "cnpm" : name,
		version: pmSpec.substring(separatorPos + 1)
	};
}

//#endregion
//#region src/utils/import-util.ts
const importRuntime = (m) => {
	return Function("mm", "return import(mm)")(m);
};

//#endregion
//#region src/detectors/detect-system-info.ts
function getVendor() {
	const hasAny = (...keys) => keys.some((k) => Boolean(env[k]));
	if (hasAny("CF_PAGES", "CF_PAGES_URL", "CF_ACCOUNT_ID") || typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers") return "cloudflare";
	if (hasAny("VERCEL", "VERCEL_URL", "VERCEL_ENV")) return "vercel";
	if (hasAny("NETLIFY", "NETLIFY_URL")) return "netlify";
	if (hasAny("RENDER", "RENDER_URL", "RENDER_INTERNAL_HOSTNAME", "RENDER_SERVICE_ID")) return "render";
	if (hasAny("AWS_LAMBDA_FUNCTION_NAME", "AWS_EXECUTION_ENV", "LAMBDA_TASK_ROOT")) return "aws";
	if (hasAny("GOOGLE_CLOUD_FUNCTION_NAME", "GOOGLE_CLOUD_PROJECT", "GCP_PROJECT", "K_SERVICE")) return "gcp";
	if (hasAny("AZURE_FUNCTION_NAME", "FUNCTIONS_WORKER_RUNTIME", "WEBSITE_INSTANCE_ID", "WEBSITE_SITE_NAME")) return "azure";
	if (hasAny("DENO_DEPLOYMENT_ID", "DENO_REGION")) return "deno-deploy";
	if (hasAny("FLY_APP_NAME", "FLY_REGION", "FLY_ALLOC_ID")) return "fly-io";
	if (hasAny("RAILWAY_STATIC_URL", "RAILWAY_ENVIRONMENT_NAME")) return "railway";
	if (hasAny("DYNO", "HEROKU_APP_NAME")) return "heroku";
	if (hasAny("DO_DEPLOYMENT_ID", "DO_APP_NAME", "DIGITALOCEAN")) return "digitalocean";
	if (hasAny("KOYEB", "KOYEB_DEPLOYMENT_ID", "KOYEB_APP_NAME")) return "koyeb";
	return null;
}
async function detectSystemInfo() {
	try {
		if (getVendor() === "cloudflare") return "cloudflare";
		const os = await importRuntime("os");
		const cpus = os.cpus();
		return {
			deploymentVendor: getVendor(),
			systemPlatform: os.platform(),
			systemRelease: os.release(),
			systemArchitecture: os.arch(),
			cpuCount: cpus.length,
			cpuModel: cpus.length ? cpus[0].model : null,
			cpuSpeed: cpus.length ? cpus[0].speed : null,
			memory: os.totalmem(),
			isWSL: await isWsl(),
			isDocker: await isDocker(),
			isTTY: typeof process !== "undefined" && process.stdout ? process.stdout.isTTY : null
		};
	} catch (e) {
		return {
			systemPlatform: null,
			systemRelease: null,
			systemArchitecture: null,
			cpuCount: null,
			cpuModel: null,
			cpuSpeed: null,
			memory: null,
			isWSL: null,
			isDocker: null,
			isTTY: null
		};
	}
}
let isDockerCached;
async function hasDockerEnv() {
	if (getVendor() === "cloudflare") return false;
	try {
		(await importRuntime("fs")).statSync("/.dockerenv");
		return true;
	} catch {
		return false;
	}
}
async function hasDockerCGroup() {
	if (getVendor() === "cloudflare") return false;
	try {
		return (await importRuntime("fs")).readFileSync("/proc/self/cgroup", "utf8").includes("docker");
	} catch {
		return false;
	}
}
async function isDocker() {
	if (getVendor() === "cloudflare") return false;
	if (isDockerCached === void 0) isDockerCached = await hasDockerEnv() || await hasDockerCGroup();
	return isDockerCached;
}
async function isWsl() {
	try {
		if (getVendor() === "cloudflare") return false;
		if (typeof process === "undefined" || process?.platform !== "linux") return false;
		const fs = await importRuntime("fs");
		if ((await importRuntime("os")).release().toLowerCase().includes("microsoft")) {
			if (await isInsideContainer()) return false;
			return true;
		}
		return fs.readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft") ? !await isInsideContainer() : false;
	} catch {
		return false;
	}
}
let isInsideContainerCached;
const hasContainerEnv = async () => {
	if (getVendor() === "cloudflare") return false;
	try {
		(await importRuntime("fs")).statSync("/run/.containerenv");
		return true;
	} catch {
		return false;
	}
};
async function isInsideContainer() {
	if (isInsideContainerCached === void 0) isInsideContainerCached = await hasContainerEnv() || await isDocker();
	return isInsideContainerCached;
}
function isCI() {
	return env.CI !== "false" && ("BUILD_ID" in env || "BUILD_NUMBER" in env || "CI" in env || "CI_APP_ID" in env || "CI_BUILD_ID" in env || "CI_BUILD_NUMBER" in env || "CI_NAME" in env || "CONTINUOUS_INTEGRATION" in env || "RUN_ID" in env);
}

//#endregion
//#region src/detectors/detect-runtime.ts
function detectRuntime() {
	if (typeof Deno !== "undefined") return {
		name: "deno",
		version: Deno?.version?.deno ?? null
	};
	if (typeof Bun !== "undefined") return {
		name: "bun",
		version: Bun?.version ?? null
	};
	if (typeof process !== "undefined" && process?.versions?.node) return {
		name: "node",
		version: process.versions.node ?? null
	};
	return {
		name: "edge",
		version: null
	};
}
function detectEnvironment() {
	return getEnvVar("NODE_ENV") === "production" ? "production" : isCI() ? "ci" : isTest() ? "test" : "development";
}

//#endregion
//#region src/utils/hash.ts
async function hashToBase64(data) {
	const buffer = await createHash("SHA-256").digest(data);
	return base64.encode(buffer);
}

//#endregion
//#region src/utils/id.ts
const generateId = (size) => {
	return createRandomStringGenerator("a-z", "A-Z", "0-9")(size || 32);
};

//#endregion
//#region src/project-id.ts
let projectIdCached = null;
async function getProjectId(baseUrl) {
	if (projectIdCached) return projectIdCached;
	const projectName = await getNameFromLocalPackageJson();
	if (projectName) {
		projectIdCached = await hashToBase64(baseUrl ? baseUrl + projectName : projectName);
		return projectIdCached;
	}
	if (baseUrl) {
		projectIdCached = await hashToBase64(baseUrl);
		return projectIdCached;
	}
	projectIdCached = generateId(32);
	return projectIdCached;
}

//#endregion
//#region src/index.ts
async function createTelemetry(options, context) {
	const debugEnabled = options.telemetry?.debug || getBooleanEnvVar("BETTER_AUTH_TELEMETRY_DEBUG", false);
	const TELEMETRY_ENDPOINT = ENV.BETTER_AUTH_TELEMETRY_ENDPOINT;
	const track = async (event) => {
		if (context?.customTrack) await context.customTrack(event).catch(logger.error);
		else if (debugEnabled) logger.info("telemetry event", JSON.stringify(event, null, 2));
		else await betterFetch(TELEMETRY_ENDPOINT, {
			method: "POST",
			body: event
		}).catch(logger.error);
	};
	const isEnabled = async () => {
		const telemetryEnabled = options.telemetry?.enabled !== void 0 ? options.telemetry.enabled : false;
		return (getBooleanEnvVar("BETTER_AUTH_TELEMETRY", false) || telemetryEnabled) && (context?.skipTestCheck || !isTest());
	};
	const enabled = await isEnabled();
	let anonymousId;
	if (enabled) {
		anonymousId = await getProjectId(options.baseURL);
		track({
			type: "init",
			payload: {
				config: getTelemetryAuthConfig(options, context),
				runtime: detectRuntime(),
				database: await detectDatabase(),
				framework: await detectFramework(),
				environment: detectEnvironment(),
				systemInfo: await detectSystemInfo(),
				packageManager: detectPackageManager()
			},
			anonymousId
		});
	}
	return { publish: async (event) => {
		if (!enabled) return;
		if (!anonymousId) anonymousId = await getProjectId(options.baseURL);
		await track({
			type: event.type,
			payload: event.payload,
			anonymousId
		});
	} };
}

//#endregion
export { createTelemetry, getTelemetryAuthConfig };