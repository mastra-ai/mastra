const require_rolldown_runtime = require('./_virtual/rolldown_runtime.js');
const require_env = require('./env.js');
const require_util = require('./util.js');
let zod_v3 = require("zod/v3");

//#region src/api.ts
const tokenSchema = zod_v3.z.object({ jwt: zod_v3.z.string() });
const api = { async getSubscriptionToken({ channel, topics, signingKey, signingKeyFallback, apiBaseUrl }) {
	let url;
	const path = "/v1/realtime/token";
	const inputBaseUrl = apiBaseUrl || require_env.getEnvVar("INNGEST_BASE_URL") || require_env.getEnvVar("INNGEST_API_BASE_URL");
	const devEnvVar = require_env.getEnvVar("INNGEST_DEV");
	if (inputBaseUrl) url = new URL(path, inputBaseUrl);
	else if (devEnvVar) try {
		const devUrl = new URL(devEnvVar);
		url = new URL(path, devUrl);
	} catch {
		if (require_util.parseAsBoolean(devEnvVar)) url = new URL(path, "http://localhost:8288/");
		else url = new URL(path, "https://api.inngest.com/");
	}
	else url = new URL(path, require_env.getEnvVar("NODE_ENV") === "production" ? "https://api.inngest.com/" : "http://localhost:8288/");
	const body = topics.map((topic) => ({
		channel,
		name: topic,
		kind: "run"
	}));
	const res = await require_util.fetchWithAuthFallback({
		authToken: signingKey,
		authTokenFallback: signingKeyFallback,
		fetch,
		url,
		options: {
			method: "POST",
			body: JSON.stringify(body),
			headers: { "Content-Type": "application/json" }
		}
	});
	if (!res.ok) throw new Error(`Failed to get subscription token: ${res.status} ${res.statusText} - ${await res.text()}`);
	const data = await res.json();
	return tokenSchema.parse(data).jwt;
} };

//#endregion
exports.api = api;
//# sourceMappingURL=api.js.map