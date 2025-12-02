"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Returns all the elements in the sorted set at key with a lexicographical value between min and max.
     * @param parser - The Redis command parser.
     * @param key - Key of the sorted set.
     * @param min - Minimum lexicographical value.
     * @param max - Maximum lexicographical value.
     * @param options - Optional parameters including LIMIT.
     */
    parseCommand(parser, key, min, max, options) {
        parser.push('ZRANGEBYLEX');
        parser.pushKey(key);
        parser.push((0, generic_transformers_1.transformStringDoubleArgument)(min), (0, generic_transformers_1.transformStringDoubleArgument)(max));
        if (options?.LIMIT) {
            parser.push('LIMIT', options.LIMIT.offset.toString(), options.LIMIT.count.toString());
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=ZRANGEBYLEX.js.map