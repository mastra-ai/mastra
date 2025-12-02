import { ConnectMessage, GatewayExecutorRequestData, StartRequest, StartResponse, WorkerReplyAckData } from "../../proto/src/components/connect/protobuf/connect.js";

//#region src/components/connect/messages.ts
function createStartRequest(excludeGateways) {
	return StartRequest.encode(StartRequest.create({ excludeGateways })).finish();
}
async function parseStartResponse(r) {
	return StartResponse.decode(new Uint8Array(await r.arrayBuffer()));
}
function parseConnectMessage(r) {
	return ConnectMessage.decode(r);
}
function parseGatewayExecutorRequest(r) {
	return GatewayExecutorRequestData.decode(r);
}
function parseWorkerReplyAck(r) {
	return WorkerReplyAckData.decode(r);
}

//#endregion
export { createStartRequest, parseConnectMessage, parseGatewayExecutorRequest, parseStartResponse, parseWorkerReplyAck };
//# sourceMappingURL=messages.js.map