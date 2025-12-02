import { createExportLogsServiceRequest } from '../internal';
/*
 * @experimental this serializer may receive breaking changes in minor versions, pin this package's version when using this constant
 */
export var JsonLogsSerializer = {
    serializeRequest: function (arg) {
        var request = createExportLogsServiceRequest(arg, {
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
//# sourceMappingURL=logs.js.map