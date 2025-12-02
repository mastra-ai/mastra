const require_consts = require('./consts.cjs');
const require_version = require('../version.cjs');
const require_strings = require('./strings.cjs');

//#region src/helpers/env.ts
/**
* devServerHost returns the dev server host by searching for the INNGEST_DEVSERVER_URL
* environment variable (plus project prefixces for eg. react, such as REACT_APP_INNGEST_DEVSERVER_URL).
*
* If not found this returns undefined, indicating that the env var has not been set.
*
* @example devServerHost()
*/
const devServerHost = (env = allProcessEnv()) => {
	const prefixes = ["REACT_APP_", "NEXT_PUBLIC_"];
	return [require_consts.envKeys.InngestBaseUrl, require_consts.envKeys.InngestDevMode].flatMap((key) => {
		return prefixes.map((prefix) => {
			return env[prefix + key];
		});
	}).find((v) => {
		if (!v) return;
		try {
			return Boolean(new URL(v));
		} catch {}
	});
};
const checkFns = ((checks) => checks)({
	equals: (actual, expected) => actual === expected,
	"starts with": (actual, expected) => expected ? actual?.startsWith(expected) ?? false : false,
	"is truthy": (actual) => Boolean(actual),
	"is truthy but not": (actual, expected) => Boolean(actual) && actual !== expected
});
const prodChecks = [
	[
		"CF_PAGES",
		"equals",
		"1"
	],
	[
		"CONTEXT",
		"starts with",
		"prod"
	],
	[
		"ENVIRONMENT",
		"starts with",
		"prod"
	],
	[
		"NODE_ENV",
		"starts with",
		"prod"
	],
	[
		"VERCEL_ENV",
		"starts with",
		"prod"
	],
	["DENO_DEPLOYMENT_ID", "is truthy"],
	[
		require_consts.envKeys.VercelEnvKey,
		"is truthy but not",
		"development"
	],
	[require_consts.envKeys.IsNetlify, "is truthy"],
	[require_consts.envKeys.IsRender, "is truthy"],
	[require_consts.envKeys.RailwayBranch, "is truthy"],
	[require_consts.envKeys.IsCloudflarePages, "is truthy"]
];
var Mode = class {
	type;
	/**
	* Whether the mode was explicitly set, or inferred from other sources.
	*/
	isExplicit;
	explicitDevUrl;
	env;
	constructor({ type, isExplicit, explicitDevUrl, env = allProcessEnv() }) {
		this.env = env;
		this.type = type;
		this.isExplicit = isExplicit || Boolean(explicitDevUrl);
		this.explicitDevUrl = explicitDevUrl;
	}
	get isDev() {
		return this.type === "dev";
	}
	get isCloud() {
		return this.type === "cloud";
	}
	get isInferred() {
		return !this.isExplicit;
	}
	/**
	* If we are explicitly in a particular mode, retrieve the URL that we are
	* sure we should be using, not considering any environment variables or other
	* influences.
	*/
	getExplicitUrl(defaultCloudUrl) {
		if (!this.isExplicit) return;
		if (this.explicitDevUrl) return this.explicitDevUrl.href;
		if (this.isCloud) return defaultCloudUrl;
		if (this.isDev) return require_consts.defaultDevServerHost;
	}
};
/**
* Returns the mode of the current environment, based off of either passed
* environment variables or `process.env`, or explicit settings.
*/
const getMode = ({ env = allProcessEnv(), client, explicitMode } = {}) => {
	if (explicitMode) return new Mode({
		type: explicitMode,
		isExplicit: true,
		env
	});
	if (client?.["mode"].isExplicit) return client["mode"];
	if (require_consts.envKeys.InngestDevMode in env) {
		if (typeof env[require_consts.envKeys.InngestDevMode] === "string") try {
			const explicitDevUrl = new URL(env[require_consts.envKeys.InngestDevMode]);
			return new Mode({
				type: "dev",
				isExplicit: true,
				explicitDevUrl,
				env
			});
		} catch {}
		const envIsDev = parseAsBoolean(env[require_consts.envKeys.InngestDevMode]);
		if (typeof envIsDev === "boolean") return new Mode({
			type: envIsDev ? "dev" : "cloud",
			isExplicit: true,
			env
		});
	}
	const isProd = prodChecks.some(([key, checkKey, expected]) => {
		return checkFns[checkKey](require_strings.stringifyUnknown(env[key]), expected);
	});
	return new Mode({
		type: isProd ? "cloud" : "dev",
		isExplicit: false,
		env
	});
};
/**
* getEnvironmentName returns the suspected branch name for this environment by
* searching through a set of common environment variables.
*
* This could be used to determine if we're on a branch deploy or not, though it
* should be noted that we don't know if this is the default branch or not.
*/
const getEnvironmentName = (env = allProcessEnv()) => {
	/**
	* Order is important; more than one of these env vars may be set, so ensure
	* that we check the most specific, most reliable env vars first.
	*/
	return env[require_consts.envKeys.InngestEnvironment] || env[require_consts.envKeys.BranchName] || env[require_consts.envKeys.VercelBranch] || env[require_consts.envKeys.NetlifyBranch] || env[require_consts.envKeys.CloudflarePagesBranch] || env[require_consts.envKeys.RenderBranch] || env[require_consts.envKeys.RailwayBranch];
};
const processEnv = (key) => {
	return allProcessEnv()[key];
};
/**
* allProcessEnv returns the current process environment variables, or an empty
* object if they cannot be read, making sure we support environments other than
* Node such as Deno, too.
*
* Using this ensures we don't dangerously access `process.env` in environments
* where it may not be defined, such as Deno or the browser.
*/
const allProcessEnv = () => {
	try {
		if (process.env) return process.env;
	} catch (_err) {}
	try {
		const env = Deno.env.toObject();
		if (env) return env;
	} catch (_err) {}
	try {
		const env = Netlify.env.toObject();
		if (env) return env;
	} catch (_err) {}
	return {};
};
/**
* Generate a standardised set of headers based on input and environment
* variables.
*
*
*/
const inngestHeaders = (opts) => {
	const sdkVersion = `inngest-js:v${require_version.version}`;
	const headers = {
		"Content-Type": "application/json",
		"User-Agent": sdkVersion,
		[require_consts.headerKeys.SdkVersion]: sdkVersion
	};
	if (opts?.framework) headers[require_consts.headerKeys.Framework] = opts.framework;
	if (opts?.expectedServerKind) headers[require_consts.headerKeys.InngestExpectedServerKind] = opts.expectedServerKind;
	const env = {
		...allProcessEnv(),
		...opts?.env
	};
	const inngestEnv = opts?.inngestEnv || getEnvironmentName(env);
	if (inngestEnv) headers[require_consts.headerKeys.Environment] = inngestEnv;
	const platform = getPlatformName(env);
	if (platform) headers[require_consts.headerKeys.Platform] = platform;
	return {
		...headers,
		...opts?.client?.["headers"],
		...opts?.extras
	};
};
/**
* A set of checks that, given an environment, will return `true` if the current
* environment is running on the platform with the given name.
*/
const platformChecks = {
	vercel: (env) => env[require_consts.envKeys.IsVercel] === "1" || typeof EdgeRuntime === "string",
	netlify: (env) => env[require_consts.envKeys.IsNetlify] === "true",
	"cloudflare-pages": (env) => env[require_consts.envKeys.IsCloudflarePages] === "1",
	render: (env) => env[require_consts.envKeys.IsRender] === "true",
	railway: (env) => Boolean(env[require_consts.envKeys.RailwayEnvironment])
};
/**
* A set of checks that, given an environment, will return `true` if the current
* environment and platform supports streaming responses back to Inngest.
*
* Streaming capability is both framework and platform-based. Frameworks are
* supported in serve handlers, and platforms are checked here.
*
* As such, this record declares which platforms we explicitly support for
* streaming and is used by {@link platformSupportsStreaming}.
*/
const streamingChecks = {
	vercel: (_framework, _env) => typeof EdgeRuntime === "string",
	"cloudflare-pages": () => true
};
const getPlatformName = (env) => {
	return Object.keys(platformChecks).find((key) => {
		return platformChecks[key](env);
	});
};
/**
* Returns `true` if we believe the current environment supports streaming
* responses back to Inngest.
*
* We run a check directly related to the platform we believe we're running on,
* usually based on environment variables.
*/
const platformSupportsStreaming = (framework, env = allProcessEnv()) => {
	return streamingChecks[getPlatformName(env)]?.(framework, env) ?? false;
};
/**
* A unique symbol used to mark a custom fetch implementation. We wrap the
* implementations to provide some extra control when handling errors.
*/
const CUSTOM_FETCH_MARKER = Symbol("Custom fetch implementation");
/**
* Given a potential fetch function, return the fetch function to use based on
* this and the environment.
*/
const getFetch = (givenFetch) => {
	/**
	* If we've explicitly been given a fetch function, use that.
	*/
	if (givenFetch) {
		if (CUSTOM_FETCH_MARKER in givenFetch) return givenFetch;
		/**
		* We wrap the given fetch function to provide some extra control when
		* handling errors.
		*/
		const customFetch = async (...args) => {
			try {
				return await givenFetch(...args);
			} catch (err) {
				/**
				* Capture warnings that are not simple fetch failures and highlight
				* them for the user.
				*
				* We also use this opportunity to log the causing error, as code higher
				* up the stack will likely abstract this.
				*/
				if (!(err instanceof Error) || !err.message?.startsWith("fetch failed")) {
					console.warn("A request failed when using a custom fetch implementation; this may be a misconfiguration. Make sure that your fetch client is correctly bound to the global scope.");
					console.error(err);
				}
				throw err;
			}
		};
		/**
		* Mark the custom fetch implementation so that we can identify it later, in
		* addition to adding some runtime properties to it to make it seem as much
		* like the original fetch as possible.
		*/
		Object.defineProperties(customFetch, {
			[CUSTOM_FETCH_MARKER]: {},
			name: { value: givenFetch.name },
			length: { value: givenFetch.length }
		});
		return customFetch;
	}
	/**
	* Browser or Node 18+
	*/
	try {
		if (typeof globalThis !== "undefined" && "fetch" in globalThis) return fetch.bind(globalThis);
	} catch (_err) {}
	/**
	* Existing polyfilled fetch
	*/
	if (typeof fetch !== "undefined") return fetch;
	/**
	* Environments where fetch cannot be found and must be polyfilled
	*/
	return require("cross-fetch");
};
/**
* If `Response` isn't included in this environment, it's probably an earlier
* Node env that isn't already polyfilling. This function returns either the
* native `Response` or a polyfilled one.
*/
const getResponse = () => {
	if (typeof Response !== "undefined") return Response;
	return require("cross-fetch").Response;
};
/**
* Given an unknown value, try to parse it as a `boolean`. Useful for parsing
* environment variables that could be a selection of different values such as
* `"true"`, `"1"`.
*
* If the value could not be confidently parsed as a `boolean` or was seen to be
* `undefined`, this function returns `undefined`.
*/
const parseAsBoolean = (value) => {
	if (typeof value === "boolean") return value;
	if (typeof value === "number") return Boolean(value);
	if (typeof value === "string") {
		const trimmed = value.trim().toLowerCase();
		if (trimmed === "undefined") return;
		if (["true", "1"].includes(trimmed)) return true;
		return false;
	}
};

//#endregion
exports.Mode = Mode;
exports.allProcessEnv = allProcessEnv;
exports.devServerHost = devServerHost;
exports.getEnvironmentName = getEnvironmentName;
exports.getFetch = getFetch;
exports.getMode = getMode;
exports.getPlatformName = getPlatformName;
exports.getResponse = getResponse;
exports.inngestHeaders = inngestHeaders;
exports.parseAsBoolean = parseAsBoolean;
exports.platformSupportsStreaming = platformSupportsStreaming;
exports.processEnv = processEnv;
//# sourceMappingURL=env.cjs.map