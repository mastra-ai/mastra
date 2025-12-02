import { createExportMetricsServiceRequest } from '../internal';
export var JsonMetricsSerializer = {
    serializeRequest: function (arg) {
        var request = createExportMetricsServiceRequest([arg], {
            useLongBits: false,
        });
        var encoder = new TextEncoder();
        return encoder.encode(JSON.stringify(request));
    },
    deserializeResponse: function (arg) {
        var decoder = new TextDecoder();
        return JSON.parse(decoder.decode(arg));
    },
};
//# sourceMappingURL=metrics.js.map