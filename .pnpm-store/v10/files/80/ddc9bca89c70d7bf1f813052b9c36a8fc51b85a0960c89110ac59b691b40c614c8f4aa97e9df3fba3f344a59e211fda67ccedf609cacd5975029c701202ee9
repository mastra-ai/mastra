import { Timestamp } from "../../../../google/protobuf/timestamp.js";
import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";

//#region src/proto/src/components/connect/protobuf/connect.ts
let GatewayMessageType = /* @__PURE__ */ function(GatewayMessageType$1) {
	GatewayMessageType$1[GatewayMessageType$1["GATEWAY_HELLO"] = 0] = "GATEWAY_HELLO";
	GatewayMessageType$1[GatewayMessageType$1["WORKER_CONNECT"] = 1] = "WORKER_CONNECT";
	GatewayMessageType$1[GatewayMessageType$1["GATEWAY_CONNECTION_READY"] = 2] = "GATEWAY_CONNECTION_READY";
	GatewayMessageType$1[GatewayMessageType$1["GATEWAY_EXECUTOR_REQUEST"] = 3] = "GATEWAY_EXECUTOR_REQUEST";
	GatewayMessageType$1[GatewayMessageType$1["WORKER_READY"] = 4] = "WORKER_READY";
	GatewayMessageType$1[GatewayMessageType$1["WORKER_REQUEST_ACK"] = 5] = "WORKER_REQUEST_ACK";
	GatewayMessageType$1[GatewayMessageType$1["WORKER_REQUEST_EXTEND_LEASE"] = 12] = "WORKER_REQUEST_EXTEND_LEASE";
	GatewayMessageType$1[GatewayMessageType$1["WORKER_REQUEST_EXTEND_LEASE_ACK"] = 13] = "WORKER_REQUEST_EXTEND_LEASE_ACK";
	GatewayMessageType$1[GatewayMessageType$1["WORKER_REPLY"] = 6] = "WORKER_REPLY";
	GatewayMessageType$1[GatewayMessageType$1["WORKER_REPLY_ACK"] = 7] = "WORKER_REPLY_ACK";
	GatewayMessageType$1[GatewayMessageType$1["WORKER_PAUSE"] = 8] = "WORKER_PAUSE";
	GatewayMessageType$1[GatewayMessageType$1["WORKER_HEARTBEAT"] = 9] = "WORKER_HEARTBEAT";
	GatewayMessageType$1[GatewayMessageType$1["GATEWAY_HEARTBEAT"] = 10] = "GATEWAY_HEARTBEAT";
	GatewayMessageType$1[GatewayMessageType$1["GATEWAY_CLOSING"] = 11] = "GATEWAY_CLOSING";
	GatewayMessageType$1[GatewayMessageType$1["UNRECOGNIZED"] = -1] = "UNRECOGNIZED";
	return GatewayMessageType$1;
}({});
function gatewayMessageTypeFromJSON(object) {
	switch (object) {
		case 0:
		case "GATEWAY_HELLO": return GatewayMessageType.GATEWAY_HELLO;
		case 1:
		case "WORKER_CONNECT": return GatewayMessageType.WORKER_CONNECT;
		case 2:
		case "GATEWAY_CONNECTION_READY": return GatewayMessageType.GATEWAY_CONNECTION_READY;
		case 3:
		case "GATEWAY_EXECUTOR_REQUEST": return GatewayMessageType.GATEWAY_EXECUTOR_REQUEST;
		case 4:
		case "WORKER_READY": return GatewayMessageType.WORKER_READY;
		case 5:
		case "WORKER_REQUEST_ACK": return GatewayMessageType.WORKER_REQUEST_ACK;
		case 12:
		case "WORKER_REQUEST_EXTEND_LEASE": return GatewayMessageType.WORKER_REQUEST_EXTEND_LEASE;
		case 13:
		case "WORKER_REQUEST_EXTEND_LEASE_ACK": return GatewayMessageType.WORKER_REQUEST_EXTEND_LEASE_ACK;
		case 6:
		case "WORKER_REPLY": return GatewayMessageType.WORKER_REPLY;
		case 7:
		case "WORKER_REPLY_ACK": return GatewayMessageType.WORKER_REPLY_ACK;
		case 8:
		case "WORKER_PAUSE": return GatewayMessageType.WORKER_PAUSE;
		case 9:
		case "WORKER_HEARTBEAT": return GatewayMessageType.WORKER_HEARTBEAT;
		case 10:
		case "GATEWAY_HEARTBEAT": return GatewayMessageType.GATEWAY_HEARTBEAT;
		case 11:
		case "GATEWAY_CLOSING": return GatewayMessageType.GATEWAY_CLOSING;
		case -1:
		case "UNRECOGNIZED":
		default: return GatewayMessageType.UNRECOGNIZED;
	}
}
function gatewayMessageTypeToJSON(object) {
	switch (object) {
		case GatewayMessageType.GATEWAY_HELLO: return "GATEWAY_HELLO";
		case GatewayMessageType.WORKER_CONNECT: return "WORKER_CONNECT";
		case GatewayMessageType.GATEWAY_CONNECTION_READY: return "GATEWAY_CONNECTION_READY";
		case GatewayMessageType.GATEWAY_EXECUTOR_REQUEST: return "GATEWAY_EXECUTOR_REQUEST";
		case GatewayMessageType.WORKER_READY: return "WORKER_READY";
		case GatewayMessageType.WORKER_REQUEST_ACK: return "WORKER_REQUEST_ACK";
		case GatewayMessageType.WORKER_REQUEST_EXTEND_LEASE: return "WORKER_REQUEST_EXTEND_LEASE";
		case GatewayMessageType.WORKER_REQUEST_EXTEND_LEASE_ACK: return "WORKER_REQUEST_EXTEND_LEASE_ACK";
		case GatewayMessageType.WORKER_REPLY: return "WORKER_REPLY";
		case GatewayMessageType.WORKER_REPLY_ACK: return "WORKER_REPLY_ACK";
		case GatewayMessageType.WORKER_PAUSE: return "WORKER_PAUSE";
		case GatewayMessageType.WORKER_HEARTBEAT: return "WORKER_HEARTBEAT";
		case GatewayMessageType.GATEWAY_HEARTBEAT: return "GATEWAY_HEARTBEAT";
		case GatewayMessageType.GATEWAY_CLOSING: return "GATEWAY_CLOSING";
		case GatewayMessageType.UNRECOGNIZED:
		default: return "UNRECOGNIZED";
	}
}
let SDKResponseStatus = /* @__PURE__ */ function(SDKResponseStatus$1) {
	SDKResponseStatus$1[SDKResponseStatus$1["NOT_COMPLETED"] = 0] = "NOT_COMPLETED";
	SDKResponseStatus$1[SDKResponseStatus$1["DONE"] = 1] = "DONE";
	SDKResponseStatus$1[SDKResponseStatus$1["ERROR"] = 2] = "ERROR";
	SDKResponseStatus$1[SDKResponseStatus$1["UNRECOGNIZED"] = -1] = "UNRECOGNIZED";
	return SDKResponseStatus$1;
}({});
function sDKResponseStatusFromJSON(object) {
	switch (object) {
		case 0:
		case "NOT_COMPLETED": return SDKResponseStatus.NOT_COMPLETED;
		case 1:
		case "DONE": return SDKResponseStatus.DONE;
		case 2:
		case "ERROR": return SDKResponseStatus.ERROR;
		case -1:
		case "UNRECOGNIZED":
		default: return SDKResponseStatus.UNRECOGNIZED;
	}
}
function sDKResponseStatusToJSON(object) {
	switch (object) {
		case SDKResponseStatus.NOT_COMPLETED: return "NOT_COMPLETED";
		case SDKResponseStatus.DONE: return "DONE";
		case SDKResponseStatus.ERROR: return "ERROR";
		case SDKResponseStatus.UNRECOGNIZED:
		default: return "UNRECOGNIZED";
	}
}
let WorkerDisconnectReason = /* @__PURE__ */ function(WorkerDisconnectReason$1) {
	WorkerDisconnectReason$1[WorkerDisconnectReason$1["WORKER_SHUTDOWN"] = 0] = "WORKER_SHUTDOWN";
	WorkerDisconnectReason$1[WorkerDisconnectReason$1["UNEXPECTED"] = 1] = "UNEXPECTED";
	WorkerDisconnectReason$1[WorkerDisconnectReason$1["GATEWAY_DRAINING"] = 2] = "GATEWAY_DRAINING";
	WorkerDisconnectReason$1[WorkerDisconnectReason$1["UNRECOGNIZED"] = -1] = "UNRECOGNIZED";
	return WorkerDisconnectReason$1;
}({});
function workerDisconnectReasonToJSON(object) {
	switch (object) {
		case WorkerDisconnectReason.WORKER_SHUTDOWN: return "WORKER_SHUTDOWN";
		case WorkerDisconnectReason.UNEXPECTED: return "UNEXPECTED";
		case WorkerDisconnectReason.GATEWAY_DRAINING: return "GATEWAY_DRAINING";
		case WorkerDisconnectReason.UNRECOGNIZED:
		default: return "UNRECOGNIZED";
	}
}
function createBaseConnectMessage() {
	return {
		kind: 0,
		payload: new Uint8Array(0)
	};
}
const ConnectMessage = {
	encode(message, writer = new BinaryWriter()) {
		if (message.kind !== 0) writer.uint32(8).int32(message.kind);
		if (message.payload.length !== 0) writer.uint32(18).bytes(message.payload);
		return writer;
	},
	decode(input, length) {
		const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
		let end = length === void 0 ? reader.len : reader.pos + length;
		const message = createBaseConnectMessage();
		while (reader.pos < end) {
			const tag = reader.uint32();
			switch (tag >>> 3) {
				case 1:
					if (tag !== 8) break;
					message.kind = reader.int32();
					continue;
				case 2:
					if (tag !== 18) break;
					message.payload = reader.bytes();
					continue;
			}
			if ((tag & 7) === 4 || tag === 0) break;
			reader.skip(tag & 7);
		}
		return message;
	},
	fromJSON(object) {
		return {
			kind: isSet(object.kind) ? gatewayMessageTypeFromJSON(object.kind) : 0,
			payload: isSet(object.payload) ? bytesFromBase64(object.payload) : new Uint8Array(0)
		};
	},
	toJSON(message) {
		const obj = {};
		if (message.kind !== 0) obj.kind = gatewayMessageTypeToJSON(message.kind);
		if (message.payload.length !== 0) obj.payload = base64FromBytes(message.payload);
		return obj;
	},
	create(base) {
		return ConnectMessage.fromPartial(base ?? {});
	},
	fromPartial(object) {
		const message = createBaseConnectMessage();
		message.kind = object.kind ?? 0;
		message.payload = object.payload ?? new Uint8Array(0);
		return message;
	}
};
function createBaseAppConfiguration() {
	return {
		appName: "",
		appVersion: void 0,
		functions: new Uint8Array(0)
	};
}
const AppConfiguration = {
	encode(message, writer = new BinaryWriter()) {
		if (message.appName !== "") writer.uint32(10).string(message.appName);
		if (message.appVersion !== void 0) writer.uint32(18).string(message.appVersion);
		if (message.functions.length !== 0) writer.uint32(34).bytes(message.functions);
		return writer;
	},
	decode(input, length) {
		const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
		let end = length === void 0 ? reader.len : reader.pos + length;
		const message = createBaseAppConfiguration();
		while (reader.pos < end) {
			const tag = reader.uint32();
			switch (tag >>> 3) {
				case 1:
					if (tag !== 10) break;
					message.appName = reader.string();
					continue;
				case 2:
					if (tag !== 18) break;
					message.appVersion = reader.string();
					continue;
				case 4:
					if (tag !== 34) break;
					message.functions = reader.bytes();
					continue;
			}
			if ((tag & 7) === 4 || tag === 0) break;
			reader.skip(tag & 7);
		}
		return message;
	},
	fromJSON(object) {
		return {
			appName: isSet(object.appName) ? globalThis.String(object.appName) : "",
			appVersion: isSet(object.appVersion) ? globalThis.String(object.appVersion) : void 0,
			functions: isSet(object.functions) ? bytesFromBase64(object.functions) : new Uint8Array(0)
		};
	},
	toJSON(message) {
		const obj = {};
		if (message.appName !== "") obj.appName = message.appName;
		if (message.appVersion !== void 0) obj.appVersion = message.appVersion;
		if (message.functions.length !== 0) obj.functions = base64FromBytes(message.functions);
		return obj;
	},
	create(base) {
		return AppConfiguration.fromPartial(base ?? {});
	},
	fromPartial(object) {
		const message = createBaseAppConfiguration();
		message.appName = object.appName ?? "";
		message.appVersion = object.appVersion ?? void 0;
		message.functions = object.functions ?? new Uint8Array(0);
		return message;
	}
};
function createBaseAuthData() {
	return {
		sessionToken: "",
		syncToken: ""
	};
}
const AuthData = {
	encode(message, writer = new BinaryWriter()) {
		if (message.sessionToken !== "") writer.uint32(10).string(message.sessionToken);
		if (message.syncToken !== "") writer.uint32(18).string(message.syncToken);
		return writer;
	},
	decode(input, length) {
		const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
		let end = length === void 0 ? reader.len : reader.pos + length;
		const message = createBaseAuthData();
		while (reader.pos < end) {
			const tag = reader.uint32();
			switch (tag >>> 3) {
				case 1:
					if (tag !== 10) break;
					message.sessionToken = reader.string();
					continue;
				case 2:
					if (tag !== 18) break;
					message.syncToken = reader.string();
					continue;
			}
			if ((tag & 7) === 4 || tag === 0) break;
			reader.skip(tag & 7);
		}
		return message;
	},
	fromJSON(object) {
		return {
			sessionToken: isSet(object.sessionToken) ? globalThis.String(object.sessionToken) : "",
			syncToken: isSet(object.syncToken) ? globalThis.String(object.syncToken) : ""
		};
	},
	toJSON(message) {
		const obj = {};
		if (message.sessionToken !== "") obj.sessionToken = message.sessionToken;
		if (message.syncToken !== "") obj.syncToken = message.syncToken;
		return obj;
	},
	create(base) {
		return AuthData.fromPartial(base ?? {});
	},
	fromPartial(object) {
		const message = createBaseAuthData();
		message.sessionToken = object.sessionToken ?? "";
		message.syncToken = object.syncToken ?? "";
		return message;
	}
};
function createBaseWorkerConnectRequestData() {
	return {
		connectionId: "",
		instanceId: "",
		authData: void 0,
		capabilities: new Uint8Array(0),
		apps: [],
		workerManualReadinessAck: false,
		systemAttributes: void 0,
		environment: void 0,
		framework: "",
		platform: void 0,
		sdkVersion: "",
		sdkLanguage: "",
		startedAt: void 0
	};
}
const WorkerConnectRequestData = {
	encode(message, writer = new BinaryWriter()) {
		if (message.connectionId !== "") writer.uint32(10).string(message.connectionId);
		if (message.instanceId !== "") writer.uint32(18).string(message.instanceId);
		if (message.authData !== void 0) AuthData.encode(message.authData, writer.uint32(26).fork()).join();
		if (message.capabilities.length !== 0) writer.uint32(34).bytes(message.capabilities);
		for (const v of message.apps) AppConfiguration.encode(v, writer.uint32(42).fork()).join();
		if (message.workerManualReadinessAck !== false) writer.uint32(48).bool(message.workerManualReadinessAck);
		if (message.systemAttributes !== void 0) SystemAttributes.encode(message.systemAttributes, writer.uint32(58).fork()).join();
		if (message.environment !== void 0) writer.uint32(66).string(message.environment);
		if (message.framework !== "") writer.uint32(74).string(message.framework);
		if (message.platform !== void 0) writer.uint32(82).string(message.platform);
		if (message.sdkVersion !== "") writer.uint32(90).string(message.sdkVersion);
		if (message.sdkLanguage !== "") writer.uint32(98).string(message.sdkLanguage);
		if (message.startedAt !== void 0) Timestamp.encode(toTimestamp(message.startedAt), writer.uint32(106).fork()).join();
		return writer;
	},
	decode(input, length) {
		const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
		let end = length === void 0 ? reader.len : reader.pos + length;
		const message = createBaseWorkerConnectRequestData();
		while (reader.pos < end) {
			const tag = reader.uint32();
			switch (tag >>> 3) {
				case 1:
					if (tag !== 10) break;
					message.connectionId = reader.string();
					continue;
				case 2:
					if (tag !== 18) break;
					message.instanceId = reader.string();
					continue;
				case 3:
					if (tag !== 26) break;
					message.authData = AuthData.decode(reader, reader.uint32());
					continue;
				case 4:
					if (tag !== 34) break;
					message.capabilities = reader.bytes();
					continue;
				case 5:
					if (tag !== 42) break;
					message.apps.push(AppConfiguration.decode(reader, reader.uint32()));
					continue;
				case 6:
					if (tag !== 48) break;
					message.workerManualReadinessAck = reader.bool();
					continue;
				case 7:
					if (tag !== 58) break;
					message.systemAttributes = SystemAttributes.decode(reader, reader.uint32());
					continue;
				case 8:
					if (tag !== 66) break;
					message.environment = reader.string();
					continue;
				case 9:
					if (tag !== 74) break;
					message.framework = reader.string();
					continue;
				case 10:
					if (tag !== 82) break;
					message.platform = reader.string();
					continue;
				case 11:
					if (tag !== 90) break;
					message.sdkVersion = reader.string();
					continue;
				case 12:
					if (tag !== 98) break;
					message.sdkLanguage = reader.string();
					continue;
				case 13:
					if (tag !== 106) break;
					message.startedAt = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
					continue;
			}
			if ((tag & 7) === 4 || tag === 0) break;
			reader.skip(tag & 7);
		}
		return message;
	},
	fromJSON(object) {
		return {
			connectionId: isSet(object.connectionId) ? globalThis.String(object.connectionId) : "",
			instanceId: isSet(object.instanceId) ? globalThis.String(object.instanceId) : "",
			authData: isSet(object.authData) ? AuthData.fromJSON(object.authData) : void 0,
			capabilities: isSet(object.capabilities) ? bytesFromBase64(object.capabilities) : new Uint8Array(0),
			apps: globalThis.Array.isArray(object?.apps) ? object.apps.map((e) => AppConfiguration.fromJSON(e)) : [],
			workerManualReadinessAck: isSet(object.workerManualReadinessAck) ? globalThis.Boolean(object.workerManualReadinessAck) : false,
			systemAttributes: isSet(object.systemAttributes) ? SystemAttributes.fromJSON(object.systemAttributes) : void 0,
			environment: isSet(object.environment) ? globalThis.String(object.environment) : void 0,
			framework: isSet(object.framework) ? globalThis.String(object.framework) : "",
			platform: isSet(object.platform) ? globalThis.String(object.platform) : void 0,
			sdkVersion: isSet(object.sdkVersion) ? globalThis.String(object.sdkVersion) : "",
			sdkLanguage: isSet(object.sdkLanguage) ? globalThis.String(object.sdkLanguage) : "",
			startedAt: isSet(object.startedAt) ? fromJsonTimestamp(object.startedAt) : void 0
		};
	},
	toJSON(message) {
		const obj = {};
		if (message.connectionId !== "") obj.connectionId = message.connectionId;
		if (message.instanceId !== "") obj.instanceId = message.instanceId;
		if (message.authData !== void 0) obj.authData = AuthData.toJSON(message.authData);
		if (message.capabilities.length !== 0) obj.capabilities = base64FromBytes(message.capabilities);
		if (message.apps?.length) obj.apps = message.apps.map((e) => AppConfiguration.toJSON(e));
		if (message.workerManualReadinessAck !== false) obj.workerManualReadinessAck = message.workerManualReadinessAck;
		if (message.systemAttributes !== void 0) obj.systemAttributes = SystemAttributes.toJSON(message.systemAttributes);
		if (message.environment !== void 0) obj.environment = message.environment;
		if (message.framework !== "") obj.framework = message.framework;
		if (message.platform !== void 0) obj.platform = message.platform;
		if (message.sdkVersion !== "") obj.sdkVersion = message.sdkVersion;
		if (message.sdkLanguage !== "") obj.sdkLanguage = message.sdkLanguage;
		if (message.startedAt !== void 0) obj.startedAt = message.startedAt.toISOString();
		return obj;
	},
	create(base) {
		return WorkerConnectRequestData.fromPartial(base ?? {});
	},
	fromPartial(object) {
		const message = createBaseWorkerConnectRequestData();
		message.connectionId = object.connectionId ?? "";
		message.instanceId = object.instanceId ?? "";
		message.authData = object.authData !== void 0 && object.authData !== null ? AuthData.fromPartial(object.authData) : void 0;
		message.capabilities = object.capabilities ?? new Uint8Array(0);
		message.apps = object.apps?.map((e) => AppConfiguration.fromPartial(e)) || [];
		message.workerManualReadinessAck = object.workerManualReadinessAck ?? false;
		message.systemAttributes = object.systemAttributes !== void 0 && object.systemAttributes !== null ? SystemAttributes.fromPartial(object.systemAttributes) : void 0;
		message.environment = object.environment ?? void 0;
		message.framework = object.framework ?? "";
		message.platform = object.platform ?? void 0;
		message.sdkVersion = object.sdkVersion ?? "";
		message.sdkLanguage = object.sdkLanguage ?? "";
		message.startedAt = object.startedAt ?? void 0;
		return message;
	}
};
function createBaseGatewayConnectionReadyData() {
	return {
		heartbeatInterval: "",
		extendLeaseInterval: ""
	};
}
const GatewayConnectionReadyData = {
	encode(message, writer = new BinaryWriter()) {
		if (message.heartbeatInterval !== "") writer.uint32(10).string(message.heartbeatInterval);
		if (message.extendLeaseInterval !== "") writer.uint32(18).string(message.extendLeaseInterval);
		return writer;
	},
	decode(input, length) {
		const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
		let end = length === void 0 ? reader.len : reader.pos + length;
		const message = createBaseGatewayConnectionReadyData();
		while (reader.pos < end) {
			const tag = reader.uint32();
			switch (tag >>> 3) {
				case 1:
					if (tag !== 10) break;
					message.heartbeatInterval = reader.string();
					continue;
				case 2:
					if (tag !== 18) break;
					message.extendLeaseInterval = reader.string();
					continue;
			}
			if ((tag & 7) === 4 || tag === 0) break;
			reader.skip(tag & 7);
		}
		return message;
	},
	fromJSON(object) {
		return {
			heartbeatInterval: isSet(object.heartbeatInterval) ? globalThis.String(object.heartbeatInterval) : "",
			extendLeaseInterval: isSet(object.extendLeaseInterval) ? globalThis.String(object.extendLeaseInterval) : ""
		};
	},
	toJSON(message) {
		const obj = {};
		if (message.heartbeatInterval !== "") obj.heartbeatInterval = message.heartbeatInterval;
		if (message.extendLeaseInterval !== "") obj.extendLeaseInterval = message.extendLeaseInterval;
		return obj;
	},
	create(base) {
		return GatewayConnectionReadyData.fromPartial(base ?? {});
	},
	fromPartial(object) {
		const message = createBaseGatewayConnectionReadyData();
		message.heartbeatInterval = object.heartbeatInterval ?? "";
		message.extendLeaseInterval = object.extendLeaseInterval ?? "";
		return message;
	}
};
function createBaseGatewayExecutorRequestData() {
	return {
		requestId: "",
		accountId: "",
		envId: "",
		appId: "",
		appName: "",
		functionId: "",
		functionSlug: "",
		stepId: void 0,
		requestPayload: new Uint8Array(0),
		systemTraceCtx: new Uint8Array(0),
		userTraceCtx: new Uint8Array(0),
		runId: "",
		leaseId: ""
	};
}
const GatewayExecutorRequestData = {
	encode(message, writer = new BinaryWriter()) {
		if (message.requestId !== "") writer.uint32(10).string(message.requestId);
		if (message.accountId !== "") writer.uint32(18).string(message.accountId);
		if (message.envId !== "") writer.uint32(26).string(message.envId);
		if (message.appId !== "") writer.uint32(34).string(message.appId);
		if (message.appName !== "") writer.uint32(42).string(message.appName);
		if (message.functionId !== "") writer.uint32(50).string(message.functionId);
		if (message.functionSlug !== "") writer.uint32(58).string(message.functionSlug);
		if (message.stepId !== void 0) writer.uint32(66).string(message.stepId);
		if (message.requestPayload.length !== 0) writer.uint32(74).bytes(message.requestPayload);
		if (message.systemTraceCtx.length !== 0) writer.uint32(82).bytes(message.systemTraceCtx);
		if (message.userTraceCtx.length !== 0) writer.uint32(90).bytes(message.userTraceCtx);
		if (message.runId !== "") writer.uint32(98).string(message.runId);
		if (message.leaseId !== "") writer.uint32(106).string(message.leaseId);
		return writer;
	},
	decode(input, length) {
		const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
		let end = length === void 0 ? reader.len : reader.pos + length;
		const message = createBaseGatewayExecutorRequestData();
		while (reader.pos < end) {
			const tag = reader.uint32();
			switch (tag >>> 3) {
				case 1:
					if (tag !== 10) break;
					message.requestId = reader.string();
					continue;
				case 2:
					if (tag !== 18) break;
					message.accountId = reader.string();
					continue;
				case 3:
					if (tag !== 26) break;
					message.envId = reader.string();
					continue;
				case 4:
					if (tag !== 34) break;
					message.appId = reader.string();
					continue;
				case 5:
					if (tag !== 42) break;
					message.appName = reader.string();
					continue;
				case 6:
					if (tag !== 50) break;
					message.functionId = reader.string();
					continue;
				case 7:
					if (tag !== 58) break;
					message.functionSlug = reader.string();
					continue;
				case 8:
					if (tag !== 66) break;
					message.stepId = reader.string();
					continue;
				case 9:
					if (tag !== 74) break;
					message.requestPayload = reader.bytes();
					continue;
				case 10:
					if (tag !== 82) break;
					message.systemTraceCtx = reader.bytes();
					continue;
				case 11:
					if (tag !== 90) break;
					message.userTraceCtx = reader.bytes();
					continue;
				case 12:
					if (tag !== 98) break;
					message.runId = reader.string();
					continue;
				case 13:
					if (tag !== 106) break;
					message.leaseId = reader.string();
					continue;
			}
			if ((tag & 7) === 4 || tag === 0) break;
			reader.skip(tag & 7);
		}
		return message;
	},
	fromJSON(object) {
		return {
			requestId: isSet(object.requestId) ? globalThis.String(object.requestId) : "",
			accountId: isSet(object.accountId) ? globalThis.String(object.accountId) : "",
			envId: isSet(object.envId) ? globalThis.String(object.envId) : "",
			appId: isSet(object.appId) ? globalThis.String(object.appId) : "",
			appName: isSet(object.appName) ? globalThis.String(object.appName) : "",
			functionId: isSet(object.functionId) ? globalThis.String(object.functionId) : "",
			functionSlug: isSet(object.functionSlug) ? globalThis.String(object.functionSlug) : "",
			stepId: isSet(object.stepId) ? globalThis.String(object.stepId) : void 0,
			requestPayload: isSet(object.requestPayload) ? bytesFromBase64(object.requestPayload) : new Uint8Array(0),
			systemTraceCtx: isSet(object.systemTraceCtx) ? bytesFromBase64(object.systemTraceCtx) : new Uint8Array(0),
			userTraceCtx: isSet(object.userTraceCtx) ? bytesFromBase64(object.userTraceCtx) : new Uint8Array(0),
			runId: isSet(object.runId) ? globalThis.String(object.runId) : "",
			leaseId: isSet(object.leaseId) ? globalThis.String(object.leaseId) : ""
		};
	},
	toJSON(message) {
		const obj = {};
		if (message.requestId !== "") obj.requestId = message.requestId;
		if (message.accountId !== "") obj.accountId = message.accountId;
		if (message.envId !== "") obj.envId = message.envId;
		if (message.appId !== "") obj.appId = message.appId;
		if (message.appName !== "") obj.appName = message.appName;
		if (message.functionId !== "") obj.functionId = message.functionId;
		if (message.functionSlug !== "") obj.functionSlug = message.functionSlug;
		if (message.stepId !== void 0) obj.stepId = message.stepId;
		if (message.requestPayload.length !== 0) obj.requestPayload = base64FromBytes(message.requestPayload);
		if (message.systemTraceCtx.length !== 0) obj.systemTraceCtx = base64FromBytes(message.systemTraceCtx);
		if (message.userTraceCtx.length !== 0) obj.userTraceCtx = base64FromBytes(message.userTraceCtx);
		if (message.runId !== "") obj.runId = message.runId;
		if (message.leaseId !== "") obj.leaseId = message.leaseId;
		return obj;
	},
	create(base) {
		return GatewayExecutorRequestData.fromPartial(base ?? {});
	},
	fromPartial(object) {
		const message = createBaseGatewayExecutorRequestData();
		message.requestId = object.requestId ?? "";
		message.accountId = object.accountId ?? "";
		message.envId = object.envId ?? "";
		message.appId = object.appId ?? "";
		message.appName = object.appName ?? "";
		message.functionId = object.functionId ?? "";
		message.functionSlug = object.functionSlug ?? "";
		message.stepId = object.stepId ?? void 0;
		message.requestPayload = object.requestPayload ?? new Uint8Array(0);
		message.systemTraceCtx = object.systemTraceCtx ?? new Uint8Array(0);
		message.userTraceCtx = object.userTraceCtx ?? new Uint8Array(0);
		message.runId = object.runId ?? "";
		message.leaseId = object.leaseId ?? "";
		return message;
	}
};
function createBaseWorkerRequestAckData() {
	return {
		requestId: "",
		accountId: "",
		envId: "",
		appId: "",
		functionSlug: "",
		stepId: void 0,
		systemTraceCtx: new Uint8Array(0),
		userTraceCtx: new Uint8Array(0),
		runId: ""
	};
}
const WorkerRequestAckData = {
	encode(message, writer = new BinaryWriter()) {
		if (message.requestId !== "") writer.uint32(10).string(message.requestId);
		if (message.accountId !== "") writer.uint32(18).string(message.accountId);
		if (message.envId !== "") writer.uint32(26).string(message.envId);
		if (message.appId !== "") writer.uint32(34).string(message.appId);
		if (message.functionSlug !== "") writer.uint32(42).string(message.functionSlug);
		if (message.stepId !== void 0) writer.uint32(50).string(message.stepId);
		if (message.systemTraceCtx.length !== 0) writer.uint32(58).bytes(message.systemTraceCtx);
		if (message.userTraceCtx.length !== 0) writer.uint32(66).bytes(message.userTraceCtx);
		if (message.runId !== "") writer.uint32(74).string(message.runId);
		return writer;
	},
	decode(input, length) {
		const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
		let end = length === void 0 ? reader.len : reader.pos + length;
		const message = createBaseWorkerRequestAckData();
		while (reader.pos < end) {
			const tag = reader.uint32();
			switch (tag >>> 3) {
				case 1:
					if (tag !== 10) break;
					message.requestId = reader.string();
					continue;
				case 2:
					if (tag !== 18) break;
					message.accountId = reader.string();
					continue;
				case 3:
					if (tag !== 26) break;
					message.envId = reader.string();
					continue;
				case 4:
					if (tag !== 34) break;
					message.appId = reader.string();
					continue;
				case 5:
					if (tag !== 42) break;
					message.functionSlug = reader.string();
					continue;
				case 6:
					if (tag !== 50) break;
					message.stepId = reader.string();
					continue;
				case 7:
					if (tag !== 58) break;
					message.systemTraceCtx = reader.bytes();
					continue;
				case 8:
					if (tag !== 66) break;
					message.userTraceCtx = reader.bytes();
					continue;
				case 9:
					if (tag !== 74) break;
					message.runId = reader.string();
					continue;
			}
			if ((tag & 7) === 4 || tag === 0) break;
			reader.skip(tag & 7);
		}
		return message;
	},
	fromJSON(object) {
		return {
			requestId: isSet(object.requestId) ? globalThis.String(object.requestId) : "",
			accountId: isSet(object.accountId) ? globalThis.String(object.accountId) : "",
			envId: isSet(object.envId) ? globalThis.String(object.envId) : "",
			appId: isSet(object.appId) ? globalThis.String(object.appId) : "",
			functionSlug: isSet(object.functionSlug) ? globalThis.String(object.functionSlug) : "",
			stepId: isSet(object.stepId) ? globalThis.String(object.stepId) : void 0,
			systemTraceCtx: isSet(object.systemTraceCtx) ? bytesFromBase64(object.systemTraceCtx) : new Uint8Array(0),
			userTraceCtx: isSet(object.userTraceCtx) ? bytesFromBase64(object.userTraceCtx) : new Uint8Array(0),
			runId: isSet(object.runId) ? globalThis.String(object.runId) : ""
		};
	},
	toJSON(message) {
		const obj = {};
		if (message.requestId !== "") obj.requestId = message.requestId;
		if (message.accountId !== "") obj.accountId = message.accountId;
		if (message.envId !== "") obj.envId = message.envId;
		if (message.appId !== "") obj.appId = message.appId;
		if (message.functionSlug !== "") obj.functionSlug = message.functionSlug;
		if (message.stepId !== void 0) obj.stepId = message.stepId;
		if (message.systemTraceCtx.length !== 0) obj.systemTraceCtx = base64FromBytes(message.systemTraceCtx);
		if (message.userTraceCtx.length !== 0) obj.userTraceCtx = base64FromBytes(message.userTraceCtx);
		if (message.runId !== "") obj.runId = message.runId;
		return obj;
	},
	create(base) {
		return WorkerRequestAckData.fromPartial(base ?? {});
	},
	fromPartial(object) {
		const message = createBaseWorkerRequestAckData();
		message.requestId = object.requestId ?? "";
		message.accountId = object.accountId ?? "";
		message.envId = object.envId ?? "";
		message.appId = object.appId ?? "";
		message.functionSlug = object.functionSlug ?? "";
		message.stepId = object.stepId ?? void 0;
		message.systemTraceCtx = object.systemTraceCtx ?? new Uint8Array(0);
		message.userTraceCtx = object.userTraceCtx ?? new Uint8Array(0);
		message.runId = object.runId ?? "";
		return message;
	}
};
function createBaseWorkerRequestExtendLeaseData() {
	return {
		requestId: "",
		accountId: "",
		envId: "",
		appId: "",
		functionSlug: "",
		stepId: void 0,
		systemTraceCtx: new Uint8Array(0),
		userTraceCtx: new Uint8Array(0),
		runId: "",
		leaseId: ""
	};
}
const WorkerRequestExtendLeaseData = {
	encode(message, writer = new BinaryWriter()) {
		if (message.requestId !== "") writer.uint32(10).string(message.requestId);
		if (message.accountId !== "") writer.uint32(18).string(message.accountId);
		if (message.envId !== "") writer.uint32(26).string(message.envId);
		if (message.appId !== "") writer.uint32(34).string(message.appId);
		if (message.functionSlug !== "") writer.uint32(42).string(message.functionSlug);
		if (message.stepId !== void 0) writer.uint32(50).string(message.stepId);
		if (message.systemTraceCtx.length !== 0) writer.uint32(58).bytes(message.systemTraceCtx);
		if (message.userTraceCtx.length !== 0) writer.uint32(66).bytes(message.userTraceCtx);
		if (message.runId !== "") writer.uint32(74).string(message.runId);
		if (message.leaseId !== "") writer.uint32(82).string(message.leaseId);
		return writer;
	},
	decode(input, length) {
		const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
		let end = length === void 0 ? reader.len : reader.pos + length;
		const message = createBaseWorkerRequestExtendLeaseData();
		while (reader.pos < end) {
			const tag = reader.uint32();
			switch (tag >>> 3) {
				case 1:
					if (tag !== 10) break;
					message.requestId = reader.string();
					continue;
				case 2:
					if (tag !== 18) break;
					message.accountId = reader.string();
					continue;
				case 3:
					if (tag !== 26) break;
					message.envId = reader.string();
					continue;
				case 4:
					if (tag !== 34) break;
					message.appId = reader.string();
					continue;
				case 5:
					if (tag !== 42) break;
					message.functionSlug = reader.string();
					continue;
				case 6:
					if (tag !== 50) break;
					message.stepId = reader.string();
					continue;
				case 7:
					if (tag !== 58) break;
					message.systemTraceCtx = reader.bytes();
					continue;
				case 8:
					if (tag !== 66) break;
					message.userTraceCtx = reader.bytes();
					continue;
				case 9:
					if (tag !== 74) break;
					message.runId = reader.string();
					continue;
				case 10:
					if (tag !== 82) break;
					message.leaseId = reader.string();
					continue;
			}
			if ((tag & 7) === 4 || tag === 0) break;
			reader.skip(tag & 7);
		}
		return message;
	},
	fromJSON(object) {
		return {
			requestId: isSet(object.requestId) ? globalThis.String(object.requestId) : "",
			accountId: isSet(object.accountId) ? globalThis.String(object.accountId) : "",
			envId: isSet(object.envId) ? globalThis.String(object.envId) : "",
			appId: isSet(object.appId) ? globalThis.String(object.appId) : "",
			functionSlug: isSet(object.functionSlug) ? globalThis.String(object.functionSlug) : "",
			stepId: isSet(object.stepId) ? globalThis.String(object.stepId) : void 0,
			systemTraceCtx: isSet(object.systemTraceCtx) ? bytesFromBase64(object.systemTraceCtx) : new Uint8Array(0),
			userTraceCtx: isSet(object.userTraceCtx) ? bytesFromBase64(object.userTraceCtx) : new Uint8Array(0),
			runId: isSet(object.runId) ? globalThis.String(object.runId) : "",
			leaseId: isSet(object.leaseId) ? globalThis.String(object.leaseId) : ""
		};
	},
	toJSON(message) {
		const obj = {};
		if (message.requestId !== "") obj.requestId = message.requestId;
		if (message.accountId !== "") obj.accountId = message.accountId;
		if (message.envId !== "") obj.envId = message.envId;
		if (message.appId !== "") obj.appId = message.appId;
		if (message.functionSlug !== "") obj.functionSlug = message.functionSlug;
		if (message.stepId !== void 0) obj.stepId = message.stepId;
		if (message.systemTraceCtx.length !== 0) obj.systemTraceCtx = base64FromBytes(message.systemTraceCtx);
		if (message.userTraceCtx.length !== 0) obj.userTraceCtx = base64FromBytes(message.userTraceCtx);
		if (message.runId !== "") obj.runId = message.runId;
		if (message.leaseId !== "") obj.leaseId = message.leaseId;
		return obj;
	},
	create(base) {
		return WorkerRequestExtendLeaseData.fromPartial(base ?? {});
	},
	fromPartial(object) {
		const message = createBaseWorkerRequestExtendLeaseData();
		message.requestId = object.requestId ?? "";
		message.accountId = object.accountId ?? "";
		message.envId = object.envId ?? "";
		message.appId = object.appId ?? "";
		message.functionSlug = object.functionSlug ?? "";
		message.stepId = object.stepId ?? void 0;
		message.systemTraceCtx = object.systemTraceCtx ?? new Uint8Array(0);
		message.userTraceCtx = object.userTraceCtx ?? new Uint8Array(0);
		message.runId = object.runId ?? "";
		message.leaseId = object.leaseId ?? "";
		return message;
	}
};
function createBaseWorkerRequestExtendLeaseAckData() {
	return {
		requestId: "",
		accountId: "",
		envId: "",
		appId: "",
		functionSlug: "",
		newLeaseId: void 0
	};
}
const WorkerRequestExtendLeaseAckData = {
	encode(message, writer = new BinaryWriter()) {
		if (message.requestId !== "") writer.uint32(10).string(message.requestId);
		if (message.accountId !== "") writer.uint32(18).string(message.accountId);
		if (message.envId !== "") writer.uint32(26).string(message.envId);
		if (message.appId !== "") writer.uint32(34).string(message.appId);
		if (message.functionSlug !== "") writer.uint32(42).string(message.functionSlug);
		if (message.newLeaseId !== void 0) writer.uint32(50).string(message.newLeaseId);
		return writer;
	},
	decode(input, length) {
		const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
		let end = length === void 0 ? reader.len : reader.pos + length;
		const message = createBaseWorkerRequestExtendLeaseAckData();
		while (reader.pos < end) {
			const tag = reader.uint32();
			switch (tag >>> 3) {
				case 1:
					if (tag !== 10) break;
					message.requestId = reader.string();
					continue;
				case 2:
					if (tag !== 18) break;
					message.accountId = reader.string();
					continue;
				case 3:
					if (tag !== 26) break;
					message.envId = reader.string();
					continue;
				case 4:
					if (tag !== 34) break;
					message.appId = reader.string();
					continue;
				case 5:
					if (tag !== 42) break;
					message.functionSlug = reader.string();
					continue;
				case 6:
					if (tag !== 50) break;
					message.newLeaseId = reader.string();
					continue;
			}
			if ((tag & 7) === 4 || tag === 0) break;
			reader.skip(tag & 7);
		}
		return message;
	},
	fromJSON(object) {
		return {
			requestId: isSet(object.requestId) ? globalThis.String(object.requestId) : "",
			accountId: isSet(object.accountId) ? globalThis.String(object.accountId) : "",
			envId: isSet(object.envId) ? globalThis.String(object.envId) : "",
			appId: isSet(object.appId) ? globalThis.String(object.appId) : "",
			functionSlug: isSet(object.functionSlug) ? globalThis.String(object.functionSlug) : "",
			newLeaseId: isSet(object.newLeaseId) ? globalThis.String(object.newLeaseId) : void 0
		};
	},
	toJSON(message) {
		const obj = {};
		if (message.requestId !== "") obj.requestId = message.requestId;
		if (message.accountId !== "") obj.accountId = message.accountId;
		if (message.envId !== "") obj.envId = message.envId;
		if (message.appId !== "") obj.appId = message.appId;
		if (message.functionSlug !== "") obj.functionSlug = message.functionSlug;
		if (message.newLeaseId !== void 0) obj.newLeaseId = message.newLeaseId;
		return obj;
	},
	create(base) {
		return WorkerRequestExtendLeaseAckData.fromPartial(base ?? {});
	},
	fromPartial(object) {
		const message = createBaseWorkerRequestExtendLeaseAckData();
		message.requestId = object.requestId ?? "";
		message.accountId = object.accountId ?? "";
		message.envId = object.envId ?? "";
		message.appId = object.appId ?? "";
		message.functionSlug = object.functionSlug ?? "";
		message.newLeaseId = object.newLeaseId ?? void 0;
		return message;
	}
};
function createBaseSDKResponse() {
	return {
		requestId: "",
		accountId: "",
		envId: "",
		appId: "",
		status: 0,
		body: new Uint8Array(0),
		noRetry: false,
		retryAfter: void 0,
		sdkVersion: "",
		requestVersion: 0,
		systemTraceCtx: new Uint8Array(0),
		userTraceCtx: new Uint8Array(0),
		runId: ""
	};
}
const SDKResponse = {
	encode(message, writer = new BinaryWriter()) {
		if (message.requestId !== "") writer.uint32(10).string(message.requestId);
		if (message.accountId !== "") writer.uint32(18).string(message.accountId);
		if (message.envId !== "") writer.uint32(26).string(message.envId);
		if (message.appId !== "") writer.uint32(34).string(message.appId);
		if (message.status !== 0) writer.uint32(40).int32(message.status);
		if (message.body.length !== 0) writer.uint32(50).bytes(message.body);
		if (message.noRetry !== false) writer.uint32(56).bool(message.noRetry);
		if (message.retryAfter !== void 0) writer.uint32(66).string(message.retryAfter);
		if (message.sdkVersion !== "") writer.uint32(74).string(message.sdkVersion);
		if (message.requestVersion !== 0) writer.uint32(80).uint32(message.requestVersion);
		if (message.systemTraceCtx.length !== 0) writer.uint32(90).bytes(message.systemTraceCtx);
		if (message.userTraceCtx.length !== 0) writer.uint32(98).bytes(message.userTraceCtx);
		if (message.runId !== "") writer.uint32(106).string(message.runId);
		return writer;
	},
	decode(input, length) {
		const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
		let end = length === void 0 ? reader.len : reader.pos + length;
		const message = createBaseSDKResponse();
		while (reader.pos < end) {
			const tag = reader.uint32();
			switch (tag >>> 3) {
				case 1:
					if (tag !== 10) break;
					message.requestId = reader.string();
					continue;
				case 2:
					if (tag !== 18) break;
					message.accountId = reader.string();
					continue;
				case 3:
					if (tag !== 26) break;
					message.envId = reader.string();
					continue;
				case 4:
					if (tag !== 34) break;
					message.appId = reader.string();
					continue;
				case 5:
					if (tag !== 40) break;
					message.status = reader.int32();
					continue;
				case 6:
					if (tag !== 50) break;
					message.body = reader.bytes();
					continue;
				case 7:
					if (tag !== 56) break;
					message.noRetry = reader.bool();
					continue;
				case 8:
					if (tag !== 66) break;
					message.retryAfter = reader.string();
					continue;
				case 9:
					if (tag !== 74) break;
					message.sdkVersion = reader.string();
					continue;
				case 10:
					if (tag !== 80) break;
					message.requestVersion = reader.uint32();
					continue;
				case 11:
					if (tag !== 90) break;
					message.systemTraceCtx = reader.bytes();
					continue;
				case 12:
					if (tag !== 98) break;
					message.userTraceCtx = reader.bytes();
					continue;
				case 13:
					if (tag !== 106) break;
					message.runId = reader.string();
					continue;
			}
			if ((tag & 7) === 4 || tag === 0) break;
			reader.skip(tag & 7);
		}
		return message;
	},
	fromJSON(object) {
		return {
			requestId: isSet(object.requestId) ? globalThis.String(object.requestId) : "",
			accountId: isSet(object.accountId) ? globalThis.String(object.accountId) : "",
			envId: isSet(object.envId) ? globalThis.String(object.envId) : "",
			appId: isSet(object.appId) ? globalThis.String(object.appId) : "",
			status: isSet(object.status) ? sDKResponseStatusFromJSON(object.status) : 0,
			body: isSet(object.body) ? bytesFromBase64(object.body) : new Uint8Array(0),
			noRetry: isSet(object.noRetry) ? globalThis.Boolean(object.noRetry) : false,
			retryAfter: isSet(object.retryAfter) ? globalThis.String(object.retryAfter) : void 0,
			sdkVersion: isSet(object.sdkVersion) ? globalThis.String(object.sdkVersion) : "",
			requestVersion: isSet(object.requestVersion) ? globalThis.Number(object.requestVersion) : 0,
			systemTraceCtx: isSet(object.systemTraceCtx) ? bytesFromBase64(object.systemTraceCtx) : new Uint8Array(0),
			userTraceCtx: isSet(object.userTraceCtx) ? bytesFromBase64(object.userTraceCtx) : new Uint8Array(0),
			runId: isSet(object.runId) ? globalThis.String(object.runId) : ""
		};
	},
	toJSON(message) {
		const obj = {};
		if (message.requestId !== "") obj.requestId = message.requestId;
		if (message.accountId !== "") obj.accountId = message.accountId;
		if (message.envId !== "") obj.envId = message.envId;
		if (message.appId !== "") obj.appId = message.appId;
		if (message.status !== 0) obj.status = sDKResponseStatusToJSON(message.status);
		if (message.body.length !== 0) obj.body = base64FromBytes(message.body);
		if (message.noRetry !== false) obj.noRetry = message.noRetry;
		if (message.retryAfter !== void 0) obj.retryAfter = message.retryAfter;
		if (message.sdkVersion !== "") obj.sdkVersion = message.sdkVersion;
		if (message.requestVersion !== 0) obj.requestVersion = Math.round(message.requestVersion);
		if (message.systemTraceCtx.length !== 0) obj.systemTraceCtx = base64FromBytes(message.systemTraceCtx);
		if (message.userTraceCtx.length !== 0) obj.userTraceCtx = base64FromBytes(message.userTraceCtx);
		if (message.runId !== "") obj.runId = message.runId;
		return obj;
	},
	create(base) {
		return SDKResponse.fromPartial(base ?? {});
	},
	fromPartial(object) {
		const message = createBaseSDKResponse();
		message.requestId = object.requestId ?? "";
		message.accountId = object.accountId ?? "";
		message.envId = object.envId ?? "";
		message.appId = object.appId ?? "";
		message.status = object.status ?? 0;
		message.body = object.body ?? new Uint8Array(0);
		message.noRetry = object.noRetry ?? false;
		message.retryAfter = object.retryAfter ?? void 0;
		message.sdkVersion = object.sdkVersion ?? "";
		message.requestVersion = object.requestVersion ?? 0;
		message.systemTraceCtx = object.systemTraceCtx ?? new Uint8Array(0);
		message.userTraceCtx = object.userTraceCtx ?? new Uint8Array(0);
		message.runId = object.runId ?? "";
		return message;
	}
};
function createBaseWorkerReplyAckData() {
	return { requestId: "" };
}
const WorkerReplyAckData = {
	encode(message, writer = new BinaryWriter()) {
		if (message.requestId !== "") writer.uint32(10).string(message.requestId);
		return writer;
	},
	decode(input, length) {
		const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
		let end = length === void 0 ? reader.len : reader.pos + length;
		const message = createBaseWorkerReplyAckData();
		while (reader.pos < end) {
			const tag = reader.uint32();
			switch (tag >>> 3) {
				case 1:
					if (tag !== 10) break;
					message.requestId = reader.string();
					continue;
			}
			if ((tag & 7) === 4 || tag === 0) break;
			reader.skip(tag & 7);
		}
		return message;
	},
	fromJSON(object) {
		return { requestId: isSet(object.requestId) ? globalThis.String(object.requestId) : "" };
	},
	toJSON(message) {
		const obj = {};
		if (message.requestId !== "") obj.requestId = message.requestId;
		return obj;
	},
	create(base) {
		return WorkerReplyAckData.fromPartial(base ?? {});
	},
	fromPartial(object) {
		const message = createBaseWorkerReplyAckData();
		message.requestId = object.requestId ?? "";
		return message;
	}
};
function createBaseSystemAttributes() {
	return {
		cpuCores: 0,
		memBytes: 0,
		os: ""
	};
}
const SystemAttributes = {
	encode(message, writer = new BinaryWriter()) {
		if (message.cpuCores !== 0) writer.uint32(8).int32(message.cpuCores);
		if (message.memBytes !== 0) writer.uint32(16).int64(message.memBytes);
		if (message.os !== "") writer.uint32(26).string(message.os);
		return writer;
	},
	decode(input, length) {
		const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
		let end = length === void 0 ? reader.len : reader.pos + length;
		const message = createBaseSystemAttributes();
		while (reader.pos < end) {
			const tag = reader.uint32();
			switch (tag >>> 3) {
				case 1:
					if (tag !== 8) break;
					message.cpuCores = reader.int32();
					continue;
				case 2:
					if (tag !== 16) break;
					message.memBytes = longToNumber(reader.int64());
					continue;
				case 3:
					if (tag !== 26) break;
					message.os = reader.string();
					continue;
			}
			if ((tag & 7) === 4 || tag === 0) break;
			reader.skip(tag & 7);
		}
		return message;
	},
	fromJSON(object) {
		return {
			cpuCores: isSet(object.cpuCores) ? globalThis.Number(object.cpuCores) : 0,
			memBytes: isSet(object.memBytes) ? globalThis.Number(object.memBytes) : 0,
			os: isSet(object.os) ? globalThis.String(object.os) : ""
		};
	},
	toJSON(message) {
		const obj = {};
		if (message.cpuCores !== 0) obj.cpuCores = Math.round(message.cpuCores);
		if (message.memBytes !== 0) obj.memBytes = Math.round(message.memBytes);
		if (message.os !== "") obj.os = message.os;
		return obj;
	},
	create(base) {
		return SystemAttributes.fromPartial(base ?? {});
	},
	fromPartial(object) {
		const message = createBaseSystemAttributes();
		message.cpuCores = object.cpuCores ?? 0;
		message.memBytes = object.memBytes ?? 0;
		message.os = object.os ?? "";
		return message;
	}
};
function createBaseStartResponse() {
	return {
		connectionId: "",
		gatewayEndpoint: "",
		gatewayGroup: "",
		sessionToken: "",
		syncToken: ""
	};
}
const StartResponse = {
	encode(message, writer = new BinaryWriter()) {
		if (message.connectionId !== "") writer.uint32(10).string(message.connectionId);
		if (message.gatewayEndpoint !== "") writer.uint32(18).string(message.gatewayEndpoint);
		if (message.gatewayGroup !== "") writer.uint32(26).string(message.gatewayGroup);
		if (message.sessionToken !== "") writer.uint32(34).string(message.sessionToken);
		if (message.syncToken !== "") writer.uint32(42).string(message.syncToken);
		return writer;
	},
	decode(input, length) {
		const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
		let end = length === void 0 ? reader.len : reader.pos + length;
		const message = createBaseStartResponse();
		while (reader.pos < end) {
			const tag = reader.uint32();
			switch (tag >>> 3) {
				case 1:
					if (tag !== 10) break;
					message.connectionId = reader.string();
					continue;
				case 2:
					if (tag !== 18) break;
					message.gatewayEndpoint = reader.string();
					continue;
				case 3:
					if (tag !== 26) break;
					message.gatewayGroup = reader.string();
					continue;
				case 4:
					if (tag !== 34) break;
					message.sessionToken = reader.string();
					continue;
				case 5:
					if (tag !== 42) break;
					message.syncToken = reader.string();
					continue;
			}
			if ((tag & 7) === 4 || tag === 0) break;
			reader.skip(tag & 7);
		}
		return message;
	},
	fromJSON(object) {
		return {
			connectionId: isSet(object.connectionId) ? globalThis.String(object.connectionId) : "",
			gatewayEndpoint: isSet(object.gatewayEndpoint) ? globalThis.String(object.gatewayEndpoint) : "",
			gatewayGroup: isSet(object.gatewayGroup) ? globalThis.String(object.gatewayGroup) : "",
			sessionToken: isSet(object.sessionToken) ? globalThis.String(object.sessionToken) : "",
			syncToken: isSet(object.syncToken) ? globalThis.String(object.syncToken) : ""
		};
	},
	toJSON(message) {
		const obj = {};
		if (message.connectionId !== "") obj.connectionId = message.connectionId;
		if (message.gatewayEndpoint !== "") obj.gatewayEndpoint = message.gatewayEndpoint;
		if (message.gatewayGroup !== "") obj.gatewayGroup = message.gatewayGroup;
		if (message.sessionToken !== "") obj.sessionToken = message.sessionToken;
		if (message.syncToken !== "") obj.syncToken = message.syncToken;
		return obj;
	},
	create(base) {
		return StartResponse.fromPartial(base ?? {});
	},
	fromPartial(object) {
		const message = createBaseStartResponse();
		message.connectionId = object.connectionId ?? "";
		message.gatewayEndpoint = object.gatewayEndpoint ?? "";
		message.gatewayGroup = object.gatewayGroup ?? "";
		message.sessionToken = object.sessionToken ?? "";
		message.syncToken = object.syncToken ?? "";
		return message;
	}
};
function createBaseStartRequest() {
	return { excludeGateways: [] };
}
const StartRequest = {
	encode(message, writer = new BinaryWriter()) {
		for (const v of message.excludeGateways) writer.uint32(10).string(v);
		return writer;
	},
	decode(input, length) {
		const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
		let end = length === void 0 ? reader.len : reader.pos + length;
		const message = createBaseStartRequest();
		while (reader.pos < end) {
			const tag = reader.uint32();
			switch (tag >>> 3) {
				case 1:
					if (tag !== 10) break;
					message.excludeGateways.push(reader.string());
					continue;
			}
			if ((tag & 7) === 4 || tag === 0) break;
			reader.skip(tag & 7);
		}
		return message;
	},
	fromJSON(object) {
		return { excludeGateways: globalThis.Array.isArray(object?.excludeGateways) ? object.excludeGateways.map((e) => globalThis.String(e)) : [] };
	},
	toJSON(message) {
		const obj = {};
		if (message.excludeGateways?.length) obj.excludeGateways = message.excludeGateways;
		return obj;
	},
	create(base) {
		return StartRequest.fromPartial(base ?? {});
	},
	fromPartial(object) {
		const message = createBaseStartRequest();
		message.excludeGateways = object.excludeGateways?.map((e) => e) || [];
		return message;
	}
};
function createBaseFlushResponse() {
	return { requestId: "" };
}
const FlushResponse = {
	encode(message, writer = new BinaryWriter()) {
		if (message.requestId !== "") writer.uint32(10).string(message.requestId);
		return writer;
	},
	decode(input, length) {
		const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
		let end = length === void 0 ? reader.len : reader.pos + length;
		const message = createBaseFlushResponse();
		while (reader.pos < end) {
			const tag = reader.uint32();
			switch (tag >>> 3) {
				case 1:
					if (tag !== 10) break;
					message.requestId = reader.string();
					continue;
			}
			if ((tag & 7) === 4 || tag === 0) break;
			reader.skip(tag & 7);
		}
		return message;
	},
	fromJSON(object) {
		return { requestId: isSet(object.requestId) ? globalThis.String(object.requestId) : "" };
	},
	toJSON(message) {
		const obj = {};
		if (message.requestId !== "") obj.requestId = message.requestId;
		return obj;
	},
	create(base) {
		return FlushResponse.fromPartial(base ?? {});
	},
	fromPartial(object) {
		const message = createBaseFlushResponse();
		message.requestId = object.requestId ?? "";
		return message;
	}
};
function bytesFromBase64(b64) {
	if (globalThis.Buffer) return Uint8Array.from(globalThis.Buffer.from(b64, "base64"));
	else {
		const bin = globalThis.atob(b64);
		const arr = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; ++i) arr[i] = bin.charCodeAt(i);
		return arr;
	}
}
function base64FromBytes(arr) {
	if (globalThis.Buffer) return globalThis.Buffer.from(arr).toString("base64");
	else {
		const bin = [];
		arr.forEach((byte) => {
			bin.push(globalThis.String.fromCharCode(byte));
		});
		return globalThis.btoa(bin.join(""));
	}
}
function toTimestamp(date) {
	const seconds = Math.trunc(date.getTime() / 1e3);
	const nanos = date.getTime() % 1e3 * 1e6;
	return {
		seconds,
		nanos
	};
}
function fromTimestamp(t) {
	let millis = (t.seconds || 0) * 1e3;
	millis += (t.nanos || 0) / 1e6;
	return new globalThis.Date(millis);
}
function fromJsonTimestamp(o) {
	if (o instanceof globalThis.Date) return o;
	else if (typeof o === "string") return new globalThis.Date(o);
	else return fromTimestamp(Timestamp.fromJSON(o));
}
function longToNumber(int64) {
	const num = globalThis.Number(int64.toString());
	if (num > globalThis.Number.MAX_SAFE_INTEGER) throw new globalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
	if (num < globalThis.Number.MIN_SAFE_INTEGER) throw new globalThis.Error("Value is smaller than Number.MIN_SAFE_INTEGER");
	return num;
}
function isSet(value) {
	return value !== null && value !== void 0;
}

//#endregion
export { ConnectMessage, FlushResponse, GatewayConnectionReadyData, GatewayExecutorRequestData, GatewayMessageType, SDKResponse, SDKResponseStatus, StartRequest, StartResponse, WorkerConnectRequestData, WorkerDisconnectReason, WorkerReplyAckData, WorkerRequestAckData, WorkerRequestExtendLeaseAckData, WorkerRequestExtendLeaseData, gatewayMessageTypeToJSON, workerDisconnectReasonToJSON };
//# sourceMappingURL=connect.js.map