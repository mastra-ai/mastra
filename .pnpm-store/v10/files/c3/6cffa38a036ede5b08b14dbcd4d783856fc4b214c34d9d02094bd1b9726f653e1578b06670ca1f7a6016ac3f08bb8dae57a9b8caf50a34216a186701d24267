"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
const bloom_1 = require("../bloom");
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Returns configuration and statistics of a Top-K filter, including k, width, depth, and decay parameters
     * @param parser - The command parser
     * @param key - The name of the Top-K filter to get information about
     */
    parseCommand(parser, key) {
        parser.push('TOPK.INFO');
        parser.pushKey(key);
    },
    transformReply: {
        2: (reply, preserve, typeMapping) => {
            reply[7] = generic_transformers_1.transformDoubleReply[2](reply[7], preserve, typeMapping);
            return (0, bloom_1.transformInfoV2Reply)(reply, typeMapping);
        },
        3: undefined
    }
};
//# sourceMappingURL=INFO.js.map