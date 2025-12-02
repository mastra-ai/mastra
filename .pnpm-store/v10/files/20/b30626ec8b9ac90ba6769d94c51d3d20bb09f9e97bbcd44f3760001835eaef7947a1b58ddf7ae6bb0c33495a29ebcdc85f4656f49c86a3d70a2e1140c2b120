import { createExportTraceServiceRequest } from '../internal';
export var JsonTraceSerializer = {
    serializeRequest: function (arg) {
        var request = createExportTraceServiceRequest(arg, {
            useHex: true,
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
//# sourceMappingURL=trace.js.map