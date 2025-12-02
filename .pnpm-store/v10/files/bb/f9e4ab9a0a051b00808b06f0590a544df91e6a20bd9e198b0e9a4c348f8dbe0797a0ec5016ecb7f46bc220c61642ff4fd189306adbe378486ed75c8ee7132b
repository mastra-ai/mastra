"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Returns the number of elements in the sorted set with a score between min and max.
     * @param parser - The Redis command parser.
     * @param key - Key of the sorted set.
     * @param min - Minimum score to count from (inclusive).
     * @param max - Maximum score to count to (inclusive).
     */
    parseCommand(parser, key, min, max) {
        parser.push('ZCOUNT');
        parser.pushKey(key);
        parser.push((0, generic_transformers_1.transformStringDoubleArgument)(min), (0, generic_transformers_1.transformStringDoubleArgument)(max));
    },
    transformReply: undefined
};
//# sourceMappingURL=ZCOUNT.js.map