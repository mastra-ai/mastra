"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bloom_1 = require("../bloom");
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Returns information about a t-digest sketch including compression, capacity, nodes, weights, observations and memory usage
     * @param parser - The command parser
     * @param key - The name of the t-digest sketch to get information about
     */
    parseCommand(parser, key) {
        parser.push('TDIGEST.INFO');
        parser.pushKey(key);
    },
    transformReply: {
        2: (reply, _, typeMapping) => {
            return (0, bloom_1.transformInfoV2Reply)(reply, typeMapping);
        },
        3: undefined
    }
};
//# sourceMappingURL=INFO.js.map