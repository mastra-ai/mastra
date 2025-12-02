"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Removes and returns the member with the highest score in a sorted set, or blocks until one is available
     * @param parser - The Redis command parser
     * @param keys - Key of the sorted set, or array of keys to try sequentially
     * @param timeout - Maximum seconds to block, 0 to block indefinitely
     */
    parseCommand(parser, keys, timeout) {
        parser.push('BZPOPMAX');
        parser.pushKeys(keys);
        parser.push(timeout.toString());
    },
    transformReply: {
        2(reply, preserve, typeMapping) {
            return reply === null ? null : {
                key: reply[0],
                value: reply[1],
                score: generic_transformers_1.transformDoubleReply[2](reply[2], preserve, typeMapping)
            };
        },
        3(reply) {
            return reply === null ? null : {
                key: reply[0],
                value: reply[1],
                score: reply[2]
            };
        }
    }
};
//# sourceMappingURL=BZPOPMAX.js.map