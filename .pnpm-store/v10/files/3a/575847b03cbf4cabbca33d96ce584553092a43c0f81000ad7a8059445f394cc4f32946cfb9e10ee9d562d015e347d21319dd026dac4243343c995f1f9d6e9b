"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Returns the position of first bit set to 0 or 1 in a string
     * @param parser - The Redis command parser
     * @param key - The key holding the string
     * @param bit - The bit value to look for (0 or 1)
     * @param start - Optional starting position in bytes/bits
     * @param end - Optional ending position in bytes/bits
     * @param mode - Optional counting mode: BYTE or BIT
     */
    parseCommand(parser, key, bit, start, end, mode) {
        parser.push('BITPOS');
        parser.pushKey(key);
        parser.push(bit.toString());
        if (start !== undefined) {
            parser.push(start.toString());
        }
        if (end !== undefined) {
            parser.push(end.toString());
        }
        if (mode) {
            parser.push(mode);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=BITPOS.js.map