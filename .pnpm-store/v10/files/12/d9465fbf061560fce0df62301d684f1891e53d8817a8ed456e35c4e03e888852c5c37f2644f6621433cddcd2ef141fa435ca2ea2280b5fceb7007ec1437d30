import { defaultDevServerHost, defaultInngestApiBaseUrl } from "../helpers/consts.js";
import { hashSigningKey } from "../helpers/strings.js";
import { devServerAvailable } from "../helpers/devserver.js";
import { getErrorMessage } from "../helpers/errors.js";
import { err, ok } from "../types.js";
import { batchSchema, errorSchema, stepsSchemas } from "./schema.js";
import { fetchWithAuthFallback } from "../helpers/net.js";
import { z } from "zod/v3";

//#region src/api/api.ts
const realtimeSubscriptionTokenSchema = z.object({ jwt: z.string() });
const sendSignalSuccessResponseSchema = z.object({ data: z.object({ run_id: z.string().min(1) }) });
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
		return hashSigningKey(this.signingKey);
	}
	get hashedFallbackKey() {
		if (!this.signingKeyFallback) return;
		return hashSigningKey(this.signingKeyFallback);
	}
	setSigningKey(key) {
		if (typeof key === "string" && this.signingKey === "") this.signingKey = key;
	}
	setSigningKeyFallback(key) {
		if (typeof key === "string" && !this.signingKeyFallback) this.signingKeyFallback = key;
	}
	async getTargetUrl(path) {
		if (this.apiBaseUrl) return new URL(path, this.apiBaseUrl);
		let url = new URL(path, defaultInngestApiBaseUrl);
		if (this.mode.isDev && this.mode.isInferred && !this.apiBaseUrl) {
			if (await devServerAvailable(defaultDevServerHost, this.fetch)) url = new URL(path, defaultDevServerHost);
		}
		return url;
	}
	async getRunSteps(runId, version) {
		return fetchWithAuthFallback({
			authToken: this.hashedKey,
			authTokenFallback: this.hashedFallbackKey,
			fetch: this.fetch,
			url: await this.getTargetUrl(`/v0/runs/${runId}/actions`)
		}).then(async (resp) => {
			const data = await resp.json();
			if (resp.ok) return ok(stepsSchemas[version].parse(data));
			else return err(errorSchema.parse(data));
		}).catch((error) => {
			return err({
				error: getErrorMessage(error, "Unknown error retrieving step data"),
				status: 500
			});
		});
	}
	async getRunBatch(runId) {
		return fetchWithAuthFallback({
			authToken: this.hashedKey,
			authTokenFallback: this.hashedFallbackKey,
			fetch: this.fetch,
			url: await this.getTargetUrl(`/v0/runs/${runId}/batch`)
		}).then(async (resp) => {
			const data = await resp.json();
			if (resp.ok) return ok(batchSchema.parse(data));
			else return err(errorSchema.parse(data));
		}).catch((error) => {
			return err({
				error: getErrorMessage(error, "Unknown error retrieving event batch"),
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
		return fetchWithAuthFallback({
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
			return ok(void 0);
		}).catch((error) => {
			return err({
				error: getErrorMessage(error, "Unknown error publishing event"),
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
		return fetchWithAuthFallback({
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
			if (res.status === 404) return ok({ runId: void 0 });
			const resClone = res.clone();
			let json;
			try {
				json = await res.json();
			} catch {
				return err({
					error: `Failed to send signal: ${res.status} ${res.statusText} - ${await resClone.text()}`,
					status: res.status
				});
			}
			if (!res.ok) try {
				return err(errorSchema.parse(json));
			} catch {
				return err({
					error: `Failed to send signal: ${res.status} ${res.statusText} - ${await res.text()}`,
					status: res.status
				});
			}
			const parseRes = sendSignalSuccessResponseSchema.safeParse(json);
			if (!parseRes.success) return err({
				error: `Successfully sent signal, but response parsing failed: ${res.status} ${res.statusText} - ${await resClone.text()}`,
				status: res.status
			});
			return ok({ runId: parseRes.data.data.run_id });
		}).catch((error) => {
			return err({
				error: getErrorMessage(error, "Unknown error sending signal"),
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
		return fetchWithAuthFallback({
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
			throw new Error(getErrorMessage(error, "Unknown error getting subscription token"));
		});
	}
};

//#endregion
export { InngestApi };
//# sourceMappingURL=api.js.map