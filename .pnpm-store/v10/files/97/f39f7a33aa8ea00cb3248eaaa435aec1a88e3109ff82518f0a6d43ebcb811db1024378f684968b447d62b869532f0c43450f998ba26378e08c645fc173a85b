"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Retrieve metadata and internal details about a vector set, including size, dimensions, quantization type, and graph structure
     *
     * @param parser - The command parser
     * @param key - The key of the vector set
     * @see https://redis.io/commands/vinfo/
     */
    parseCommand(parser, key) {
        parser.push('VINFO');
        parser.pushKey(key);
    },
    transformReply: {
        2: (reply) => {
            const ret = Object.create(null);
            for (let i = 0; i < reply.length; i += 2) {
                ret[reply[i].toString()] = reply[i + 1];
            }
            return ret;
        },
        3: undefined
    }
};
//# sourceMappingURL=VINFO.js.map