const require_connect = require('../../proto/src/components/connect/protobuf/connect.cjs');

//#region src/components/connect/messages.ts
function createStartRequest(excludeGateways) {
	return require_connect.StartRequest.encode(require_connect.StartRequest.create({ excludeGateways })).finish();
}
async function parseStartResponse(r) {
	return require_connect.StartResponse.decode(new Uint8Array(await r.arrayBuffer()));
}
function parseConnectMessage(r) {
	return require_connect.ConnectMessage.decode(r);
}
function parseGatewayExecutorRequest(r) {
	return require_connect.GatewayExecutorRequestData.decode(r);
}
function parseWorkerReplyAck(r) {
	return require_connect.WorkerReplyAckData.decode(r);
}

//#endregion
exports.createStartRequest = createStartRequest;
exports.parseConnectMessage = parseConnectMessage;
exports.parseGatewayExecutorRequest = parseGatewayExecutorRequest;
exports.parseStartResponse = parseStartResponse;
exports.parseWorkerReplyAck = parseWorkerReplyAck;
//# sourceMappingURL=messages.cjs.map