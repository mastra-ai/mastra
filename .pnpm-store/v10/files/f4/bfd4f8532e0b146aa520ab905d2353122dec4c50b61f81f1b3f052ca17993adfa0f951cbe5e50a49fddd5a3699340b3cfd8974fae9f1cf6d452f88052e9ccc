"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Gets all fields and values in a hash
     * @param parser - The Redis command parser
     * @param key - Key of the hash
     */
    parseCommand(parser, key) {
        parser.push('HGETALL');
        parser.pushKey(key);
    },
    TRANSFORM_LEGACY_REPLY: true,
    transformReply: {
        2: (generic_transformers_1.transformTuplesReply),
        3: undefined
    }
};
//# sourceMappingURL=HGETALL.js.map