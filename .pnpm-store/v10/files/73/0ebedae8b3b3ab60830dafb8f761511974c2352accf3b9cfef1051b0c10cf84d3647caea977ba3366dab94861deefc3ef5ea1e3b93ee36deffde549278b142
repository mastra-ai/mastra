import { envKeys, headerKeys, queryKeys } from "../../helpers/consts.js";
import { version } from "../../version.js";
import { hashSigningKey } from "../../helpers/strings.js";
import { allProcessEnv, getEnvironmentName, getPlatformName } from "../../helpers/env.js";
import { PREFERRED_EXECUTION_VERSION } from "../execution/InngestExecution.js";
import { parseFnData } from "../../helpers/functions.js";
import { InngestCommHandler } from "../InngestCommHandler.js";
import { ConnectMessage, GatewayConnectionReadyData, GatewayMessageType, SDKResponse, SDKResponseStatus, WorkerConnectRequestData, WorkerDisconnectReason, WorkerRequestAckData, WorkerRequestExtendLeaseAckData, WorkerRequestExtendLeaseData, gatewayMessageTypeToJSON, workerDisconnectReasonToJSON } from "../../proto/src/components/connect/protobuf/connect.js";
import { AuthError, ConnectionLimitError, ReconnectError, expBackoff, parseTraceCtx, waitWithCancel } from "./util.js";
import { MessageBuffer } from "./buffer.js";
import { createStartRequest, parseConnectMessage, parseGatewayExecutorRequest, parseStartResponse, parseWorkerReplyAck } from "./messages.js";
import { getHostname, onShutdown, retrieveSystemAttributes } from "./os.js";
import { ConnectionState, DEFAULT_SHUTDOWN_SIGNALS } from "./types.js";
import debug from "debug";
import ms from "ms";
import { WaitGroup } from "@jpwilliams/waitgroup";

//#region src/components/connect/index.ts
const ResponseAcknowlegeDeadline = 5e3;
const InngestBranchEnvironmentSigningKeyPrefix = "signkey-branch-";
const ConnectWebSocketProtocol = "v0.connect.inngest.com";
var WebSocketWorkerConnection = class {
	inngest;
	options;
	debug;
	/**
	* The current state of the connection.
	*/
	state = ConnectionState.CONNECTING;
	/**
	* The current connection.
	*/
	currentConnection;
	inProgressRequests = {
		wg: new WaitGroup(),
		requestLeases: {}
	};
	/**
	* The buffer of messages to be sent to the gateway.
	*/
	messageBuffer;
	_hashedSigningKey;
	_hashedFallbackKey;
	_inngestEnv;
	/**
	* A set of gateways to exclude from the connection.
	*/
	excludeGateways = /* @__PURE__ */ new Set();
	/**
	* Function to remove the shutdown signal handler.
	*/
	cleanupShutdownSignal;
	/**
	* A promise that resolves when the connection is closed on behalf of the
	* user by calling `close()` or when a shutdown signal is received.
	*/
	closingPromise;
	resolveClosingPromise;
	constructor(options) {
		if (!Array.isArray(options.apps) || options.apps.length === 0 || !options.apps[0]) throw new Error("No apps provided");
		this.inngest = options.apps[0].client;
		for (const app of options.apps) {
			const client = app.client;
			if (client.env !== this.inngest.env) throw new Error(`All apps must be configured to the same environment. ${client.id} is configured to ${client.env} but ${this.inngest.id} is configured to ${this.inngest.env}`);
		}
		this.options = this.applyDefaults(options);
		this._inngestEnv = this.inngest.env ?? getEnvironmentName();
		this.debug = debug("inngest:connect");
		this.messageBuffer = new MessageBuffer(this.inngest);
		this.closingPromise = new Promise((resolve) => {
			this.resolveClosingPromise = resolve;
		});
	}
	get functions() {
		const functions = {};
		for (const app of this.options.apps) {
			const client = app.client;
			if (functions[client.id]) throw new Error(`Duplicate app id: ${client.id}`);
			functions[client.id] = {
				client: app.client,
				functions: app.functions ?? client.funcs
			};
		}
		return functions;
	}
	applyDefaults(opts) {
		const options = { ...opts };
		if (!Array.isArray(options.handleShutdownSignals)) options.handleShutdownSignals = DEFAULT_SHUTDOWN_SIGNALS;
		const env = allProcessEnv();
		options.signingKey = options.signingKey || env[envKeys.InngestSigningKey];
		options.signingKeyFallback = options.signingKeyFallback || env[envKeys.InngestSigningKeyFallback];
		return options;
	}
	async close() {
		if (this.cleanupShutdownSignal) {
			this.cleanupShutdownSignal();
			this.cleanupShutdownSignal = void 0;
		}
		this.state = ConnectionState.CLOSING;
		this.debug("Cleaning up connection resources");
		if (this.currentConnection) {
			await this.currentConnection.cleanup();
			this.currentConnection = void 0;
		}
		this.debug("Connection closed");
		this.debug("Waiting for in-flight requests to complete");
		await this.inProgressRequests.wg.wait();
		this.debug("Flushing messages before closing");
		try {
			await this.messageBuffer.flush(this._hashedSigningKey);
		} catch (err) {
			this.debug("Failed to flush messages, using fallback key", err);
			await this.messageBuffer.flush(this._hashedFallbackKey);
		}
		this.state = ConnectionState.CLOSED;
		this.resolveClosingPromise?.();
		this.debug("Fully closed");
		return this.closed;
	}
	/**
	* A promise that resolves when the connection is closed on behalf of the
	* user by calling `close()` or when a shutdown signal is received.
	*/
	get closed() {
		if (!this.closingPromise) throw new Error("No connection established");
		return this.closingPromise;
	}
	/**
	* The current connection ID of the worker.
	*/
	get connectionId() {
		if (!this.currentConnection) throw new Error("Connection not prepared");
		return this.currentConnection.id;
	}
	/**
	* Establish a persistent connection to the gateway.
	*/
	async connect(attempt = 0, path = []) {
		if (typeof WebSocket === "undefined") throw new Error("WebSockets not supported in current environment");
		if (this.state === ConnectionState.CLOSING || this.state === ConnectionState.CLOSED) throw new Error("Connection already closed");
		this.debug("Establishing connection", { attempt });
		if (this.inngest["mode"].isCloud && !this.options.signingKey) throw new Error("Signing key is required");
		this._hashedSigningKey = this.options.signingKey ? hashSigningKey(this.options.signingKey) : void 0;
		if (this.options.signingKey && this.options.signingKey.startsWith(InngestBranchEnvironmentSigningKeyPrefix) && !this._inngestEnv) throw new Error("Environment is required when using branch environment signing keys");
		if (this.options.signingKeyFallback) this._hashedFallbackKey = hashSigningKey(this.options.signingKeyFallback);
		try {
			await this.messageBuffer.flush(this._hashedSigningKey);
		} catch (err) {
			this.debug("Failed to flush messages, using fallback key", err);
			await this.messageBuffer.flush(this._hashedFallbackKey);
		}
		const capabilities = {
			trust_probe: "v1",
			connect: "v1"
		};
		const functionConfigs = {};
		for (const [appId, { client, functions }] of Object.entries(this.functions)) functionConfigs[appId] = {
			client,
			functions: functions.flatMap((f) => f["getConfig"]({
				baseUrl: new URL("wss://connect"),
				appPrefix: client.id,
				isConnect: true
			}))
		};
		this.debug("Prepared sync data", { functionSlugs: Object.entries(functionConfigs).map(([appId, { functions }]) => {
			return JSON.stringify({
				appId,
				functions: functions.map((f) => ({
					id: f.id,
					stepUrls: Object.values(f.steps).map((s) => s.runtime["url"])
				}))
			});
		}) });
		const data = {
			manualReadinessAck: false,
			marshaledCapabilities: JSON.stringify(capabilities),
			apps: Object.entries(functionConfigs).map(([appId, { client, functions }]) => ({
				appName: appId,
				appVersion: client.appVersion,
				functions: new TextEncoder().encode(JSON.stringify(functions))
			}))
		};
		const requestHandlers = {};
		for (const [appId, { client, functions }] of Object.entries(this.functions)) requestHandlers[appId] = new InngestCommHandler({
			client,
			functions,
			frameworkName: "connect",
			signingKey: this.options.signingKey,
			signingKeyFallback: this.options.signingKeyFallback,
			skipSignatureValidation: true,
			handler: (msg) => {
				const asString = new TextDecoder().decode(msg.requestPayload);
				const parsed = parseFnData(JSON.parse(asString));
				const userTraceCtx = parseTraceCtx(msg.userTraceCtx);
				return {
					body() {
						return parsed;
					},
					method() {
						return "POST";
					},
					headers(key) {
						switch (key) {
							case headerKeys.ContentLength.toString(): return asString.length.toString();
							case headerKeys.InngestExpectedServerKind.toString(): return "connect";
							case headerKeys.RequestVersion.toString(): return parsed.version.toString();
							case headerKeys.Signature.toString(): return null;
							case headerKeys.TraceParent.toString(): return userTraceCtx?.traceParent ?? null;
							case headerKeys.TraceState.toString(): return userTraceCtx?.traceState ?? null;
							default: return null;
						}
					},
					transformResponse({ body, headers, status }) {
						let sdkResponseStatus = SDKResponseStatus.DONE;
						switch (status) {
							case 200:
								sdkResponseStatus = SDKResponseStatus.DONE;
								break;
							case 206:
								sdkResponseStatus = SDKResponseStatus.NOT_COMPLETED;
								break;
							case 500:
								sdkResponseStatus = SDKResponseStatus.ERROR;
								break;
						}
						return SDKResponse.create({
							requestId: msg.requestId,
							accountId: msg.accountId,
							envId: msg.envId,
							appId: msg.appId,
							status: sdkResponseStatus,
							body: new TextEncoder().encode(body),
							noRetry: headers[headerKeys.NoRetry] === "true",
							retryAfter: headers[headerKeys.RetryAfter],
							sdkVersion: `inngest-js:v${version}`,
							requestVersion: parseInt(headers[headerKeys.RequestVersion] ?? PREFERRED_EXECUTION_VERSION.toString(), 10),
							systemTraceCtx: msg.systemTraceCtx,
							userTraceCtx: msg.userTraceCtx,
							runId: msg.runId
						});
					},
					url() {
						const baseUrl = new URL("http://connect.inngest.com");
						baseUrl.searchParams.set(queryKeys.FnId, msg.functionSlug);
						if (msg.stepId) baseUrl.searchParams.set(queryKeys.StepId, msg.stepId);
						return baseUrl;
					}
				};
			}
		}).createHandler();
		if (this.options.handleShutdownSignals && this.options.handleShutdownSignals.length > 0) this.setupShutdownSignal(this.options.handleShutdownSignals);
		let useSigningKey = this._hashedSigningKey;
		while (![ConnectionState.CLOSING, ConnectionState.CLOSED].includes(this.state)) {
			await this.messageBuffer.flush(useSigningKey);
			try {
				await this.prepareConnection(requestHandlers, useSigningKey, data, attempt, [...path]);
				return;
			} catch (err) {
				this.debug("Failed to connect", err);
				if (!(err instanceof ReconnectError)) throw err;
				attempt = err.attempt;
				if (err instanceof AuthError) {
					const switchToFallback = useSigningKey === this._hashedSigningKey;
					if (switchToFallback) this.debug("Switching to fallback signing key");
					useSigningKey = switchToFallback ? this._hashedFallbackKey : this._hashedSigningKey;
				}
				if (err instanceof ConnectionLimitError) console.error("You have reached the maximum number of concurrent connections. Please disconnect other active workers to continue.");
				const delay = expBackoff(attempt);
				this.debug("Reconnecting in", delay, "ms");
				if (await waitWithCancel(delay, () => this.state === ConnectionState.CLOSING || this.state === ConnectionState.CLOSED)) {
					this.debug("Reconnect backoff cancelled");
					break;
				}
				attempt++;
			}
		}
		this.debug("Exiting connect loop");
	}
	async sendStartRequest(hashedSigningKey, attempt) {
		const msg = createStartRequest(Array.from(this.excludeGateways));
		const headers = {
			"Content-Type": "application/protobuf",
			...hashedSigningKey ? { Authorization: `Bearer ${hashedSigningKey}` } : {}
		};
		if (this._inngestEnv) headers[headerKeys.Environment] = this._inngestEnv;
		const targetUrl = await this.inngest["inngestApi"]["getTargetUrl"]("/v0/connect/start");
		let resp;
		try {
			resp = await fetch(targetUrl, {
				method: "POST",
				body: new Uint8Array(msg),
				headers
			});
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : "Unknown error";
			throw new ReconnectError(`Failed initial API handshake request to ${targetUrl.toString()}, ${errMsg}`, attempt);
		}
		if (!resp.ok) {
			if (resp.status === 401) throw new AuthError(`Failed initial API handshake request to ${targetUrl.toString()}${this._inngestEnv ? ` (env: ${this._inngestEnv})` : ""}, ${await resp.text()}`, attempt);
			if (resp.status === 429) throw new ConnectionLimitError(attempt);
			throw new ReconnectError(`Failed initial API handshake request to ${targetUrl.toString()}, ${await resp.text()}`, attempt);
		}
		return await parseStartResponse(resp);
	}
	async prepareConnection(requestHandlers, hashedSigningKey, data, attempt, path = []) {
		let closed = false;
		this.debug("Preparing connection", {
			attempt,
			path
		});
		const startedAt = /* @__PURE__ */ new Date();
		const startResp = await this.sendStartRequest(hashedSigningKey, attempt);
		const connectionId = startResp.connectionId;
		path.push(connectionId);
		let resolveWebsocketConnected;
		let rejectWebsocketConnected;
		const websocketConnectedPromise = new Promise((resolve, reject) => {
			resolveWebsocketConnected = resolve;
			rejectWebsocketConnected = reject;
		});
		const connectTimeout = setTimeout(() => {
			this.excludeGateways.add(startResp.gatewayGroup);
			rejectWebsocketConnected?.(new ReconnectError(`Connection ${connectionId} timed out`, attempt));
		}, 1e4);
		let finalEndpoint = startResp.gatewayEndpoint;
		if (this.options.rewriteGatewayEndpoint) {
			const rewritten = this.options.rewriteGatewayEndpoint(startResp.gatewayEndpoint);
			this.debug("Rewriting gateway endpoint", {
				original: startResp.gatewayEndpoint,
				rewritten
			});
			finalEndpoint = rewritten;
		}
		this.debug(`Connecting to gateway`, {
			endpoint: finalEndpoint,
			gatewayGroup: startResp.gatewayGroup,
			connectionId
		});
		const ws = new WebSocket(finalEndpoint, [ConnectWebSocketProtocol]);
		ws.binaryType = "arraybuffer";
		let onConnectionError = (error) => {
			if (closed) {
				this.debug(`Connection error while initializing but already in closed state, skipping`, { connectionId });
				return;
			}
			closed = true;
			this.debug(`Connection error in connecting state, rejecting promise`, { connectionId });
			this.excludeGateways.add(startResp.gatewayGroup);
			clearTimeout(connectTimeout);
			ws.onerror = () => {};
			ws.onclose = () => {};
			ws.close(4001, workerDisconnectReasonToJSON(WorkerDisconnectReason.UNEXPECTED));
			rejectWebsocketConnected?.(new ReconnectError(`Error while connecting (${connectionId}): ${error instanceof Error ? error.message : "Unknown error"}`, attempt));
		};
		ws.onerror = (err) => onConnectionError(err);
		ws.onclose = (ev) => {
			onConnectionError(new ReconnectError(`Connection ${connectionId} closed: ${ev.reason}`, attempt));
		};
		/**
		* The current setup state of the connection.
		*/
		const setupState = {
			receivedGatewayHello: false,
			sentWorkerConnect: false,
			receivedConnectionReady: false
		};
		let heartbeatIntervalMs;
		let extendLeaseIntervalMs;
		ws.onmessage = async (event) => {
			const messageBytes = new Uint8Array(event.data);
			const connectMessage = parseConnectMessage(messageBytes);
			this.debug(`Received message: ${gatewayMessageTypeToJSON(connectMessage.kind)}`, { connectionId });
			if (!setupState.receivedGatewayHello) {
				if (connectMessage.kind !== GatewayMessageType.GATEWAY_HELLO) {
					onConnectionError(new ReconnectError(`Expected hello message, got ${gatewayMessageTypeToJSON(connectMessage.kind)}`, attempt));
					return;
				}
				setupState.receivedGatewayHello = true;
			}
			if (!setupState.sentWorkerConnect) {
				const workerConnectRequestMsg = WorkerConnectRequestData.create({
					connectionId: startResp.connectionId,
					environment: this._inngestEnv,
					platform: getPlatformName({ ...allProcessEnv() }),
					sdkVersion: `v${version}`,
					sdkLanguage: "typescript",
					framework: "connect",
					workerManualReadinessAck: data.manualReadinessAck,
					systemAttributes: await retrieveSystemAttributes(),
					authData: {
						sessionToken: startResp.sessionToken,
						syncToken: startResp.syncToken
					},
					apps: data.apps,
					capabilities: new TextEncoder().encode(data.marshaledCapabilities),
					startedAt,
					instanceId: this.options.instanceId || await getHostname()
				});
				const workerConnectRequestMsgBytes = WorkerConnectRequestData.encode(workerConnectRequestMsg).finish();
				ws.send(ConnectMessage.encode(ConnectMessage.create({
					kind: GatewayMessageType.WORKER_CONNECT,
					payload: workerConnectRequestMsgBytes
				})).finish());
				setupState.sentWorkerConnect = true;
				return;
			}
			if (!setupState.receivedConnectionReady) {
				if (connectMessage.kind !== GatewayMessageType.GATEWAY_CONNECTION_READY) {
					onConnectionError(new ReconnectError(`Expected ready message, got ${gatewayMessageTypeToJSON(connectMessage.kind)}`, attempt));
					return;
				}
				const readyPayload = GatewayConnectionReadyData.decode(connectMessage.payload);
				setupState.receivedConnectionReady = true;
				heartbeatIntervalMs = readyPayload.heartbeatInterval.length > 0 ? ms(readyPayload.heartbeatInterval) : 1e4;
				extendLeaseIntervalMs = readyPayload.extendLeaseInterval.length > 0 ? ms(readyPayload.extendLeaseInterval) : 5e3;
				resolveWebsocketConnected?.();
				return;
			}
			this.debug("Unexpected message type during setup", {
				kind: gatewayMessageTypeToJSON(connectMessage.kind),
				rawKind: connectMessage.kind,
				attempt,
				setupState,
				state: this.state,
				connectionId
			});
		};
		await websocketConnectedPromise;
		clearTimeout(connectTimeout);
		this.state = ConnectionState.ACTIVE;
		this.excludeGateways.delete(startResp.gatewayGroup);
		attempt = 0;
		const conn = {
			id: connectionId,
			ws,
			cleanup: () => {
				if (closed) return;
				closed = true;
				ws.onerror = () => {};
				ws.onclose = () => {};
				ws.close();
			},
			pendingHeartbeats: 0
		};
		this.currentConnection = conn;
		this.debug(`Connection ready (${connectionId})`);
		let isDraining = false;
		onConnectionError = async (error) => {
			if (closed) {
				this.debug(`Connection error but already in closed state, skipping`, { connectionId });
				return;
			}
			closed = true;
			await conn.cleanup();
			if (this.state === ConnectionState.CLOSING || this.state === ConnectionState.CLOSED) {
				this.debug(`Connection error (${connectionId}) but already closing or closed, skipping`);
				return;
			}
			this.state = ConnectionState.RECONNECTING;
			this.excludeGateways.add(startResp.gatewayGroup);
			if (isDraining) {
				this.debug(`Connection error (${connectionId}) but already draining, skipping`);
				return;
			}
			this.debug(`Connection error (${connectionId})`, error);
			this.connect(attempt + 1, [...path, "onConnectionError"]);
		};
		ws.onerror = (err) => onConnectionError(err);
		ws.onclose = (ev) => {
			onConnectionError(new ReconnectError(`Connection closed: ${ev.reason}`, attempt));
		};
		ws.onmessage = async (event) => {
			const messageBytes = new Uint8Array(event.data);
			const connectMessage = parseConnectMessage(messageBytes);
			if (connectMessage.kind === GatewayMessageType.GATEWAY_CLOSING) {
				isDraining = true;
				this.debug("Received draining message", { connectionId });
				try {
					this.debug("Setting up new connection while keeping previous connection open", { connectionId });
					await this.connect(0, [...path]);
					await conn.cleanup();
				} catch (err) {
					this.debug("Failed to reconnect after receiving draining message", {
						connectionId,
						err
					});
					await conn.cleanup();
					onConnectionError(new ReconnectError(`Failed to reconnect after receiving draining message (${connectionId})`, attempt));
				}
				return;
			}
			if (connectMessage.kind === GatewayMessageType.GATEWAY_HEARTBEAT) {
				conn.pendingHeartbeats = 0;
				this.debug("Handled gateway heartbeat", { connectionId });
				return;
			}
			if (connectMessage.kind === GatewayMessageType.GATEWAY_EXECUTOR_REQUEST) {
				if (this.state !== ConnectionState.ACTIVE) {
					this.debug("Received request while not active, skipping", { connectionId });
					return;
				}
				const gatewayExecutorRequest = parseGatewayExecutorRequest(connectMessage.payload);
				this.debug("Received gateway executor request", {
					requestId: gatewayExecutorRequest.requestId,
					appId: gatewayExecutorRequest.appId,
					appName: gatewayExecutorRequest.appName,
					functionSlug: gatewayExecutorRequest.functionSlug,
					stepId: gatewayExecutorRequest.stepId,
					connectionId
				});
				if (typeof gatewayExecutorRequest.appName !== "string" || gatewayExecutorRequest.appName.length === 0) {
					this.debug("No app name in request, skipping", {
						requestId: gatewayExecutorRequest.requestId,
						appId: gatewayExecutorRequest.appId,
						functionSlug: gatewayExecutorRequest.functionSlug,
						stepId: gatewayExecutorRequest.stepId,
						connectionId
					});
					return;
				}
				const requestHandler = requestHandlers[gatewayExecutorRequest.appName];
				if (!requestHandler) {
					this.debug("No request handler found for app, skipping", {
						requestId: gatewayExecutorRequest.requestId,
						appId: gatewayExecutorRequest.appId,
						appName: gatewayExecutorRequest.appName,
						functionSlug: gatewayExecutorRequest.functionSlug,
						stepId: gatewayExecutorRequest.stepId,
						connectionId
					});
					return;
				}
				ws.send(ConnectMessage.encode(ConnectMessage.create({
					kind: GatewayMessageType.WORKER_REQUEST_ACK,
					payload: WorkerRequestAckData.encode(WorkerRequestAckData.create({
						accountId: gatewayExecutorRequest.accountId,
						envId: gatewayExecutorRequest.envId,
						appId: gatewayExecutorRequest.appId,
						functionSlug: gatewayExecutorRequest.functionSlug,
						requestId: gatewayExecutorRequest.requestId,
						stepId: gatewayExecutorRequest.stepId,
						userTraceCtx: gatewayExecutorRequest.userTraceCtx,
						systemTraceCtx: gatewayExecutorRequest.systemTraceCtx,
						runId: gatewayExecutorRequest.runId
					})).finish()
				})).finish());
				this.inProgressRequests.wg.add(1);
				this.inProgressRequests.requestLeases[gatewayExecutorRequest.requestId] = gatewayExecutorRequest.leaseId;
				let extendLeaseInterval;
				try {
					extendLeaseInterval = setInterval(() => {
						if (extendLeaseIntervalMs === void 0) return;
						const currentLeaseId = this.inProgressRequests.requestLeases[gatewayExecutorRequest.requestId];
						if (!currentLeaseId) {
							clearInterval(extendLeaseInterval);
							return;
						}
						this.debug("extending lease", {
							connectionId,
							leaseId: currentLeaseId
						});
						ws.send(ConnectMessage.encode(ConnectMessage.create({
							kind: GatewayMessageType.WORKER_REQUEST_EXTEND_LEASE,
							payload: WorkerRequestExtendLeaseData.encode(WorkerRequestExtendLeaseData.create({
								accountId: gatewayExecutorRequest.accountId,
								envId: gatewayExecutorRequest.envId,
								appId: gatewayExecutorRequest.appId,
								functionSlug: gatewayExecutorRequest.functionSlug,
								requestId: gatewayExecutorRequest.requestId,
								stepId: gatewayExecutorRequest.stepId,
								runId: gatewayExecutorRequest.runId,
								userTraceCtx: gatewayExecutorRequest.userTraceCtx,
								systemTraceCtx: gatewayExecutorRequest.systemTraceCtx,
								leaseId: currentLeaseId
							})).finish()
						})).finish());
					}, extendLeaseIntervalMs);
					const res = await requestHandler(gatewayExecutorRequest);
					this.debug("Sending worker reply", {
						connectionId,
						requestId: gatewayExecutorRequest.requestId
					});
					this.messageBuffer.addPending(res, ResponseAcknowlegeDeadline);
					if (!this.currentConnection) {
						this.debug("No current WebSocket, buffering response", {
							connectionId,
							requestId: gatewayExecutorRequest.requestId
						});
						this.messageBuffer.append(res);
						return;
					}
					this.currentConnection.ws.send(ConnectMessage.encode(ConnectMessage.create({
						kind: GatewayMessageType.WORKER_REPLY,
						payload: SDKResponse.encode(res).finish()
					})).finish());
				} finally {
					this.inProgressRequests.wg.done();
					delete this.inProgressRequests.requestLeases[gatewayExecutorRequest.requestId];
					clearInterval(extendLeaseInterval);
				}
				return;
			}
			if (connectMessage.kind === GatewayMessageType.WORKER_REPLY_ACK) {
				const replyAck = parseWorkerReplyAck(connectMessage.payload);
				this.debug("Acknowledging reply ack", {
					connectionId,
					requestId: replyAck.requestId
				});
				this.messageBuffer.acknowledgePending(replyAck.requestId);
				return;
			}
			if (connectMessage.kind === GatewayMessageType.WORKER_REQUEST_EXTEND_LEASE_ACK) {
				const extendLeaseAck = WorkerRequestExtendLeaseAckData.decode(connectMessage.payload);
				this.debug("received extend lease ack", {
					connectionId,
					newLeaseId: extendLeaseAck.newLeaseId
				});
				if (extendLeaseAck.newLeaseId) this.inProgressRequests.requestLeases[extendLeaseAck.requestId] = extendLeaseAck.newLeaseId;
				else {
					this.debug("unable to extend lease", {
						connectionId,
						requestId: extendLeaseAck.requestId
					});
					delete this.inProgressRequests.requestLeases[extendLeaseAck.requestId];
				}
				return;
			}
			this.debug("Unexpected message type", {
				kind: gatewayMessageTypeToJSON(connectMessage.kind),
				rawKind: connectMessage.kind,
				attempt,
				setupState,
				state: this.state,
				connectionId
			});
		};
		let heartbeatInterval = void 0;
		if (heartbeatIntervalMs !== void 0) heartbeatInterval = setInterval(() => {
			if (heartbeatIntervalMs === void 0) return;
			if (conn.pendingHeartbeats >= 2) {
				this.debug("Gateway heartbeat missed");
				onConnectionError(new ReconnectError(`Consecutive gateway heartbeats missed (${connectionId})`, attempt));
				return;
			}
			this.debug("Sending worker heartbeat", { connectionId });
			conn.pendingHeartbeats++;
			ws.send(ConnectMessage.encode(ConnectMessage.create({ kind: GatewayMessageType.WORKER_HEARTBEAT })).finish());
		}, heartbeatIntervalMs);
		conn.cleanup = () => {
			this.debug("Cleaning up worker heartbeat", { connectionId });
			clearInterval(heartbeatInterval);
			if (closed) return;
			closed = true;
			this.debug("Cleaning up connection", { connectionId });
			if (ws.readyState === WebSocket.OPEN) {
				this.debug("Sending pause message", { connectionId });
				ws.send(ConnectMessage.encode(ConnectMessage.create({ kind: GatewayMessageType.WORKER_PAUSE })).finish());
			}
			this.debug("Closing connection", { connectionId });
			ws.onerror = () => {};
			ws.onclose = () => {};
			ws.close(1e3, workerDisconnectReasonToJSON(WorkerDisconnectReason.WORKER_SHUTDOWN));
			if (this.currentConnection?.id === connectionId) this.currentConnection = void 0;
		};
		return conn;
	}
	setupShutdownSignal(signals) {
		if (this.cleanupShutdownSignal) return;
		this.debug(`Setting up shutdown signal handler for ${signals.join(", ")}`);
		const cleanupShutdownHandlers = onShutdown(signals, () => {
			this.debug("Received shutdown signal, closing connection");
			this.close();
		});
		this.cleanupShutdownSignal = () => {
			this.debug("Cleaning up shutdown signal handler");
			cleanupShutdownHandlers();
		};
	}
};
const connect = async (options) => {
	if (options.apps.length === 0) throw new Error("No apps provided");
	const conn = new WebSocketWorkerConnection(options);
	await conn.connect();
	return conn;
};

//#endregion
export { connect };
//# sourceMappingURL=index.js.map