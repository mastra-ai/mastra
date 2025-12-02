"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Removes all elements in the sorted set with scores between min and max.
     * @param parser - The Redis command parser.
     * @param key - Key of the sorted set.
     * @param min - Minimum score.
     * @param max - Maximum score.
     */
    parseCommand(parser, key, min, max) {
        parser.push('ZREMRANGEBYSCORE');
        parser.pushKey(key);
        parser.push((0, generic_transformers_1.transformStringDoubleArgument)(min), (0, generic_transformers_1.transformStringDoubleArgument)(max));
    },
    transformReply: undefined
};
//# sourceMappingURL=ZREMRANGEBYSCORE.js.map