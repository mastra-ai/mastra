import { createExportTraceServiceRequest } from '../internal';
export const JsonTraceSerializer = {
    serializeRequest: (arg) => {
        const request = createExportTraceServiceRequest(arg, {
            useHex: true,
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
//# sourceMappingURL=trace.js.map