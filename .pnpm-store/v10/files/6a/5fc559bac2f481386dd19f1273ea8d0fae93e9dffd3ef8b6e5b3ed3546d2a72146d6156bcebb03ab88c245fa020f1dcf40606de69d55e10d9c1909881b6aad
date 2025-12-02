"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Removes and returns the member with the highest score in the sorted set.
     * @param parser - The Redis command parser.
     * @param key - Key of the sorted set.
     */
    parseCommand(parser, key) {
        parser.push('ZPOPMAX');
        parser.pushKey(key);
    },
    transformReply: {
        2: (reply, preserve, typeMapping) => {
            if (reply.length === 0)
                return null;
            return {
                value: reply[0],
                score: generic_transformers_1.transformDoubleReply[2](reply[1], preserve, typeMapping),
            };
        },
        3: (reply) => {
            if (reply.length === 0)
                return null;
            return {
                value: reply[0],
                score: reply[1]
            };
        }
    }
};
//# sourceMappingURL=ZPOPMAX.js.map