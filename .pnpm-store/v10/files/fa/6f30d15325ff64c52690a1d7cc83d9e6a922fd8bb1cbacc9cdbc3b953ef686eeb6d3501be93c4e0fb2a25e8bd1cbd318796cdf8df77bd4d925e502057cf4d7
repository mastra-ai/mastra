"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Returns the count of set bits in a string key
     * @param parser - The Redis command parser
     * @param key - The key to count bits in
     * @param range - Optional range specification
     * @param range.start - Start offset in bytes/bits
     * @param range.end - End offset in bytes/bits
     * @param range.mode - Optional counting mode: BYTE or BIT
     */
    parseCommand(parser, key, range) {
        parser.push('BITCOUNT');
        parser.pushKey(key);
        if (range) {
            parser.push(range.start.toString());
            parser.push(range.end.toString());
            if (range.mode) {
                parser.push(range.mode);
            }
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=BITCOUNT.js.map