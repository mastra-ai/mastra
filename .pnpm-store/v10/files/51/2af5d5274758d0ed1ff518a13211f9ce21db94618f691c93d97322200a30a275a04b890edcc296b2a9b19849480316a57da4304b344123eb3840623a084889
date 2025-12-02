const require_rolldown_runtime = require('../_virtual/rolldown_runtime.cjs');
const require_consts = require('../helpers/consts.cjs');
const require_strings = require('../helpers/strings.cjs');
const require_devserver = require('../helpers/devserver.cjs');
const require_errors = require('../helpers/errors.cjs');
const require_types = require('../types.cjs');
const require_schema = require('./schema.cjs');
const require_net = require('../helpers/net.cjs');
let zod_v3 = require("zod/v3");
zod_v3 = require_rolldown_runtime.__toESM(zod_v3);

//#region src/api/api.ts
const realtimeSubscriptionTokenSchema = zod_v3.z.object({ jwt: zod_v3.z.string() });
const sendSignalSuccessResponseSchema = zod_v3.z.object({ data: zod_v3.z.object({ run_id: zod_v3.z.string().min(1) }) });
var InngestApi = class {
	apiBaseUrl;
	signingKey;
	signingKeyFallback;
	fetch;
	mode;
	constructor({ baseUrl, signingKey, signingKeyFallback, fetch, mode }) {
		this.apiBaseUrl = baseUrl;
		this.signingKey = signingKey;
		this.signingKeyFallback = signingKeyFallback;
		this.fetch = fetch;
		this.mode = mode;
	}
	get hashedKey() {
		return require_strings.hashSigningKey(this.signingKey);
	}
	get hashedFallbackKey() {
		if (!this.signingKeyFallback) return;
		return require_strings.hashSigningKey(this.signingKeyFallback);
	}
	setSigningKey(key) {
		if (typeof key === "string" && this.signingKey === "") this.signingKey = key;
	}
	setSigningKeyFallback(key) {
		if (typeof key === "string" && !this.signingKeyFallback) this.signingKeyFallback = key;
	}
	async getTargetUrl(path) {
		if (this.apiBaseUrl) return new URL(path, this.apiBaseUrl);
		let url = new URL(path, require_consts.defaultInngestApiBaseUrl);
		if (this.mode.isDev && this.mode.isInferred && !this.apiBaseUrl) {
			if (await require_devserver.devServerAvailable(require_consts.defaultDevServerHost, this.fetch)) url = new URL(path, require_consts.defaultDevServerHost);
		}
		return url;
	}
	async getRunSteps(runId, version) {
		return require_net.fetchWithAuthFallback({
			authToken: this.hashedKey,
			authTokenFallback: this.hashedFallbackKey,
			fetch: this.fetch,
			url: await this.getTargetUrl(`/v0/runs/${runId}/actions`)
		}).then(async (resp) => {
			const data = await resp.json();
			if (resp.ok) return require_types.ok(require_schema.stepsSchemas[version].parse(data));
			else return require_types.err(require_schema.errorSchema.parse(data));
		}).catch((error) => {
			return require_types.err({
				error: require_errors.getErrorMessage(error, "Unknown error retrieving step data"),
				status: 500
			});
		});
	}
	async getRunBatch(runId) {
		return require_net.fetchWithAuthFallback({
			authToken: this.hashedKey,
			authTokenFallback: this.hashedFallbackKey,
			fetch: this.fetch,
			url: await this.getTargetUrl(`/v0/runs/${runId}/batch`)
		}).then(async (resp) => {
			const data = await resp.json();
			if (resp.ok) return require_types.ok(require_schema.batchSchema.parse(data));
			else return require_types.err(require_schema.errorSchema.parse(data));
		}).catch((error) => {
			return require_types.err({
				error: require_errors.getErrorMessage(error, "Unknown error retrieving event batch"),
				status: 500
			});
		});
	}
	async publish(publishOptions, data) {
		const isStream = data instanceof ReadableStream;
		const url = await this.getTargetUrl("/v1/realtime/publish");
		url.searchParams.set("channel", publishOptions.channel || "");
		if (publishOptions.runId) url.searchParams.set("run_id", publishOptions.runId);
		publishOptions.topics.forEach((topic) => {
			url.searchParams.append("topic", topic);
		});
		return require_net.fetchWithAuthFallback({
			authToken: this.hashedKey,
			authTokenFallback: this.hashedFallbackKey,
			fetch: this.fetch,
			url,
			options: {
				method: "POST",
				body: isStream ? data : typeof data === "string" ? data : JSON.stringify(data),
				headers: { "Content-Type": isStream ? "text/stream" : "application/json" },
				...isStream ? { duplex: "half" } : {}
			}
		}).then((res) => {
			if (!res.ok) throw new Error(`Failed to publish event: ${res.status} ${res.statusText}`);
			return require_types.ok(void 0);
		}).catch((error) => {
			return require_types.err({
				error: require_errors.getErrorMessage(error, "Unknown error publishing event"),
				status: 500
			});
		});
	}
	async sendSignal(signalOptions, options) {
		const url = await this.getTargetUrl("/v1/signals");
		const body = {
			signal: signalOptions.signal,
			data: signalOptions.data
		};
		return require_net.fetchWithAuthFallback({
			authToken: this.hashedKey,
			authTokenFallback: this.hashedFallbackKey,
			fetch: this.fetch,
			url,
			options: {
				method: "POST",
				body: JSON.stringify(body),
				headers: {
					"Content-Type": "application/json",
					...options?.headers
				}
			}
		}).then(async (res) => {
			if (res.status === 404) return require_types.ok({ runId: void 0 });
			const resClone = res.clone();
			let json;
			try {
				json = await res.json();
			} catch {
				return require_types.err({
					error: `Failed to send signal: ${res.status} ${res.statusText} - ${await resClone.text()}`,
					status: res.status
				});
			}
			if (!res.ok) try {
				return require_types.err(require_schema.errorSchema.parse(json));
			} catch {
				return require_types.err({
					error: `Failed to send signal: ${res.status} ${res.statusText} - ${await res.text()}`,
					status: res.status
				});
			}
			const parseRes = sendSignalSuccessResponseSchema.safeParse(json);
			if (!parseRes.success) return require_types.err({
				error: `Successfully sent signal, but response parsing failed: ${res.status} ${res.statusText} - ${await resClone.text()}`,
				status: res.status
			});
			return require_types.ok({ runId: parseRes.data.data.run_id });
		}).catch((error) => {
			return require_types.err({
				error: require_errors.getErrorMessage(error, "Unknown error sending signal"),
				status: 500
			});
		});
	}
	async getSubscriptionToken(channel, topics) {
		const url = await this.getTargetUrl("/v1/realtime/token");
		const body = topics.map((topic) => ({
			channel,
			name: topic,
			kind: "run"
		}));
		return require_net.fetchWithAuthFallback({
			authToken: this.hashedKey,
			authTokenFallback: this.hashedFallbackKey,
			fetch: this.fetch,
			url,
			options: {
				method: "POST",
				body: JSON.stringify(body),
				headers: { "Content-Type": "application/json" }
			}
		}).then(async (res) => {
			if (!res.ok) throw new Error(`Failed to get subscription token: ${res.status} ${res.statusText} - ${await res.text()}`);
			return realtimeSubscriptionTokenSchema.parse(await res.json()).jwt;
		}).catch((error) => {
			throw new Error(require_errors.getErrorMessage(error, "Unknown error getting subscription token"));
		});
	}
};

//#endregion
exports.InngestApi = InngestApi;
//# sourceMappingURL=api.cjs.map