"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Returns the number of elements in the sorted set between the lexicographical range specified by min and max.
     * @param parser - The Redis command parser.
     * @param key - Key of the sorted set.
     * @param min - Minimum lexicographical value (inclusive).
     * @param max - Maximum lexicographical value (inclusive).
     */
    parseCommand(parser, key, min, max) {
        parser.push('ZLEXCOUNT');
        parser.pushKey(key);
        parser.push(min);
        parser.push(max);
    },
    transformReply: undefined
};
//# sourceMappingURL=ZLEXCOUNT.js.map