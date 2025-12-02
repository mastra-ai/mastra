"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Gets the last sample of a time series
     * @param parser - The command parser
     * @param key - The key name of the time series
     * @param options - Optional parameters for the command
     */
    parseCommand(parser, key, options) {
        parser.push('TS.GET');
        parser.pushKey(key);
        if (options?.LATEST) {
            parser.push('LATEST');
        }
    },
    transformReply: {
        2(reply) {
            return reply.length === 0 ? null : {
                timestamp: reply[0],
                value: Number(reply[1])
            };
        },
        3(reply) {
            return reply.length === 0 ? null : {
                timestamp: reply[0],
                value: reply[1]
            };
        }
    }
};
//# sourceMappingURL=GET.js.map