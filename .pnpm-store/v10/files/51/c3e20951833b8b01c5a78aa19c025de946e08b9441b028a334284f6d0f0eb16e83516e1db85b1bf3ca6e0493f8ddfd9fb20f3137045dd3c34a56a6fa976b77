"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonTraceSerializer = void 0;
const internal_1 = require("../internal");
exports.JsonTraceSerializer = {
    serializeRequest: (arg) => {
        const request = (0, internal_1.createExportTraceServiceRequest)(arg, {
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