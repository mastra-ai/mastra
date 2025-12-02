import { createExportMetricsServiceRequest } from '../internal';
export const JsonMetricsSerializer = {
    serializeRequest: (arg) => {
        const request = createExportMetricsServiceRequest([arg], {
            useLongBits: false,
        });
        const encoder = new TextEncoder();
        return encoder.encode(JSON.stringify(request));
    },
    deserializeResponse: (arg) => {
        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(arg));
    },
};
//# sourceMappingURL=metrics.js.map