"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOtlpSendBeaconExportDelegate = exports.createOtlpXhrExportDelegate = void 0;
const retrying_transport_1 = require("./retrying-transport");
const xhr_transport_1 = require("./transport/xhr-transport");
const send_beacon_transport_1 = require("./transport/send-beacon-transport");
const otlp_network_export_delegate_1 = require("./otlp-network-export-delegate");
function createOtlpXhrExportDelegate(options, serializer) {
    return (0, otlp_network_export_delegate_1.createOtlpNetworkExportDelegate)(options, serializer, (0, retrying_transport_1.createRetryingTransport)({
        transport: (0, xhr_transport_1.createXhrTransport)(options),
    }));
}
exports.createOtlpXhrExportDelegate = createOtlpXhrExportDelegate;
function createOtlpSendBeaconExportDelegate(options, serializer) {
    return (0, otlp_network_export_delegate_1.createOtlpNetworkExportDelegate)(options, serializer, (0, retrying_transport_1.createRetryingTransport)({
        transport: (0, send_beacon_transport_1.createSendBeaconTransport)({
            url: options.url,
            blobType: options.headers()['Content-Type'],
        }),
    }));
}
exports.createOtlpSendBeaconExportDelegate = createOtlpSendBeaconExportDelegate;
//# sourceMappingURL=otlp-browser-http-export-delegate.js.map