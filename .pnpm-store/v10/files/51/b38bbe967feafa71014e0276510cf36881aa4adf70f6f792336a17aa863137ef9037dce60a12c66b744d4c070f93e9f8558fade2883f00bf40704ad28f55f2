const require_rolldown_runtime = require('../_virtual/rolldown_runtime.js');
const require_env = require('../env.js');
const require_util = require('../util.js');
const require_api = require('../api.js');
const require_topic = require('../topic.js');
const require_types = require('../types.js');
const require_StreamFanout = require('./StreamFanout.js');
let debug = require("debug");
debug = require_rolldown_runtime.__toESM(debug);

//#region src/subscribe/TokenSubscription.ts
/**
* TODO
*/
var TokenSubscription = class {
	#apiBaseUrl;
	#channelId;
	#debug = (0, debug.default)("inngest:realtime");
	#encoder = new TextEncoder();
	#fanout = new require_StreamFanout.StreamFanout();
	#running = false;
	#topics;
	#ws = null;
	#signingKey;
	#signingKeyFallback;
	/**
	* This is a map that tracks stream IDs to their corresponding streams and
	* controllers.
	*/
	#chunkStreams = /* @__PURE__ */ new Map();
	constructor(token, apiBaseUrl, signingKey, signingKeyFallback) {
		this.token = token;
		this.#apiBaseUrl = apiBaseUrl;
		this.#signingKey = signingKey;
		this.#signingKeyFallback = signingKeyFallback;
		if (typeof token.channel === "string") {
			this.#channelId = token.channel;
			this.#topics = this.token.topics.reduce((acc, name) => {
				acc.set(name, require_topic.topic(name));
				return acc;
			}, /* @__PURE__ */ new Map());
		} else {
			this.#channelId = token.channel.name;
			this.#topics = this.token.topics.reduce((acc, name) => {
				acc.set(name, token.channel.topics[name] ?? require_topic.topic(name));
				return acc;
			}, /* @__PURE__ */ new Map());
		}
	}
	async getWsUrl(token) {
		let url;
		const path = "/v1/realtime/connect";
		const devEnvVar = require_env.getEnvVar("INNGEST_DEV");
		if (this.#apiBaseUrl) url = new URL(path, this.#apiBaseUrl);
		else if (devEnvVar) try {
			const devUrl = new URL(devEnvVar);
			url = new URL(path, devUrl);
		} catch {
			if (require_util.parseAsBoolean(devEnvVar)) url = new URL(path, "http://localhost:8288/");
			else url = new URL(path, "https://api.inngest.com/");
		}
		else url = new URL(path, require_env.getEnvVar("NODE_ENV") === "production" ? "https://api.inngest.com/" : "http://localhost:8288/");
		url.protocol = url.protocol === "http:" ? "ws:" : "wss:";
		url.searchParams.set("token", token);
		return url;
	}
	/**
	* TODO
	*/
	async connect() {
		this.#debug(`Establishing connection to channel "${this.#channelId}" with topics ${JSON.stringify([...this.#topics.keys()])}...`);
		if (typeof WebSocket === "undefined") throw new Error("WebSockets not supported in current environment");
		let key = this.token.key;
		if (!key) {
			this.#debug("No subscription token key passed; attempting to retrieve one automatically...");
			key = (await this.lazilyGetSubscriptionToken({
				...this.token,
				signingKey: this.#signingKey,
				signingKeyFallback: this.#signingKeyFallback
			})).key;
			if (!key) throw new Error("No subscription token key passed and failed to retrieve one automatically");
		}
		const ret = require_util.createDeferredPromise();
		try {
			this.#ws = new WebSocket(await this.getWsUrl(key));
			this.#ws.onopen = () => {
				this.#debug("WebSocket connection established");
				ret.resolve();
			};
			this.#ws.onmessage = async (event) => {
				const parseRes = await require_types.Realtime.messageSchema.safeParseAsync(JSON.parse(event.data));
				if (!parseRes.success) {
					this.#debug("Received invalid message:", parseRes.error);
					return;
				}
				const msg = parseRes.data;
				if (!this.#running) this.#debug(`Received message on channel "${msg.channel}" for topic "${msg.topic}" but stream is closed`);
				switch (msg.kind) {
					case "data": {
						if (!msg.channel) {
							this.#debug(`Received message on channel "${msg.channel}" with no channel`);
							return;
						}
						if (!msg.topic) {
							this.#debug(`Received message on channel "${msg.channel}" with no topic`);
							return;
						}
						const topic$1 = this.#topics.get(msg.topic);
						if (!topic$1) {
							this.#debug(`Received message on channel "${msg.channel}" for unknown topic "${msg.topic}"`);
							return;
						}
						const schema = topic$1.getSchema();
						if (schema) {
							const validateRes = await schema["~standard"].validate(msg.data);
							if (validateRes.issues) {
								console.error(`Received message on channel "${msg.channel}" for topic "${msg.topic}" that failed schema validation:`, validateRes.issues);
								return;
							}
							msg.data = validateRes.value;
						}
						this.#debug(`Received message on channel "${msg.channel}" for topic "${msg.topic}":`, msg.data);
						return this.#fanout.write({
							channel: msg.channel,
							topic: msg.topic,
							data: msg.data,
							fnId: msg.fn_id,
							createdAt: msg.created_at || /* @__PURE__ */ new Date(),
							runId: msg.run_id,
							kind: "data",
							envId: msg.env_id
						});
					}
					case "datastream-start": {
						if (!msg.channel) {
							this.#debug(`Received message on channel "${msg.channel}" with no channel`);
							return;
						}
						if (!msg.topic) {
							this.#debug(`Received message on channel "${msg.channel}" with no topic`);
							return;
						}
						const streamId = msg.data;
						if (typeof streamId !== "string" || !streamId) {
							this.#debug(`Received message on channel "${msg.channel}" with no stream ID`);
							return;
						}
						if (this.#chunkStreams.has(streamId)) {
							this.#debug(`Received message on channel "${msg.channel}" to create stream ID "${streamId}" that already exists`);
							return;
						}
						const stream = new ReadableStream({
							start: (controller) => {
								this.#chunkStreams.set(streamId, {
									stream,
									controller
								});
							},
							cancel: () => {
								this.#chunkStreams.delete(streamId);
							}
						});
						this.#debug(`Created stream ID "${streamId}" on channel "${msg.channel}"`);
						return this.#fanout.write({
							channel: msg.channel,
							topic: msg.topic,
							kind: "datastream-start",
							data: streamId,
							streamId,
							fnId: msg.fn_id,
							runId: msg.run_id,
							stream
						});
					}
					case "datastream-end": {
						if (!msg.channel) {
							this.#debug(`Received message on channel "${msg.channel}" with no channel`);
							return;
						}
						if (!msg.topic) {
							this.#debug(`Received message on channel "${msg.channel}" with no topic`);
							return;
						}
						const streamId = msg.data;
						if (typeof streamId !== "string" || !streamId) {
							this.#debug(`Received message on channel "${msg.channel}" with no stream ID`);
							return;
						}
						const stream = this.#chunkStreams.get(streamId);
						if (!stream) {
							this.#debug(`Received message on channel "${msg.channel}" to close stream ID "${streamId}" that doesn't exist`);
							return;
						}
						stream.controller.close();
						this.#chunkStreams.delete(streamId);
						this.#debug(`Closed stream ID "${streamId}" on channel "${msg.channel}"`);
						return this.#fanout.write({
							channel: msg.channel,
							topic: msg.topic,
							kind: "datastream-end",
							data: streamId,
							streamId,
							fnId: msg.fn_id,
							runId: msg.run_id,
							stream: stream.stream
						});
					}
					case "chunk": {
						if (!msg.channel) {
							this.#debug(`Received message on channel "${msg.channel}" with no channel`);
							return;
						}
						if (!msg.topic) {
							this.#debug(`Received message on channel "${msg.channel}" with no topic`);
							return;
						}
						if (!msg.stream_id) {
							this.#debug(`Received message on channel "${msg.channel}" with no stream ID`);
							return;
						}
						const stream = this.#chunkStreams.get(msg.stream_id);
						if (!stream) {
							this.#debug(`Received message on channel "${msg.channel}" for unknown stream ID "${msg.stream_id}"`);
							return;
						}
						this.#debug(`Received chunk on channel "${msg.channel}" for stream ID "${msg.stream_id}":`, msg.data);
						stream.controller.enqueue(msg.data);
						return this.#fanout.write({
							channel: msg.channel,
							topic: msg.topic,
							kind: "chunk",
							data: msg.data,
							streamId: msg.stream_id,
							fnId: msg.fn_id,
							runId: msg.run_id,
							stream: stream.stream
						});
					}
					default:
						this.#debug(`Received message on channel "${msg.channel}" with unhandled kind "${msg.kind}"`);
						return;
				}
			};
			this.#ws.onerror = (event) => {
				console.error("WebSocket error observed:", event);
				ret.reject(event);
			};
			this.#ws.onclose = (event) => {
				this.#debug("WebSocket closed:", event.reason);
				this.close();
			};
			this.#running = true;
		} catch (err) {
			ret.reject(err);
		}
		return ret.promise;
	}
	/**
	* TODO
	*/
	async lazilyGetSubscriptionToken(args) {
		const channelId = typeof args.channel === "string" ? args.channel : args.channel.name;
		if (!channelId) throw new Error("Channel ID is required to create a subscription token");
		const key = await require_api.api.getSubscriptionToken({
			channel: channelId,
			topics: args.topics,
			signingKey: args.signingKey,
			signingKeyFallback: args.signingKeyFallback,
			apiBaseUrl: this.#apiBaseUrl
		});
		return {
			channel: channelId,
			topics: args.topics,
			key
		};
	}
	/**
	* TODO
	*/
	close(reason = "Userland closed connection") {
		if (!this.#running) return;
		this.#debug("close() called; closing connection...");
		this.#running = false;
		this.#ws?.close(1e3, reason);
		this.#debug(`Closing ${this.#fanout.size()} streams...`);
		this.#fanout.close();
	}
	/**
	* TODO
	*/
	getJsonStream() {
		return this.#fanout.createStream();
	}
	/**
	* TODO
	*/
	getEncodedStream() {
		return this.#fanout.createStream((chunk) => {
			return this.#encoder.encode(`${JSON.stringify(chunk)}\n`);
		});
	}
	/**
	* TODO
	*/
	useCallback(callback, stream = this.getJsonStream()) {
		(async () => {
			const reader = stream.getReader();
			try {
				while (this.#running) {
					const { done, value } = await reader.read();
					if (done || !this.#running) break;
					callback(value);
				}
			} finally {
				reader.releaseLock();
			}
		})();
	}
};

//#endregion
exports.TokenSubscription = TokenSubscription;
//# sourceMappingURL=TokenSubscription.js.map