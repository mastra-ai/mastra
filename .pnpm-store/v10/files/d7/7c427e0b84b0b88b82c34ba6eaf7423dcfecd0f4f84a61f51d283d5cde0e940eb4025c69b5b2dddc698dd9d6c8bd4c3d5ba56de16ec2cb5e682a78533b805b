"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Returns the bit value at a given offset in a string value
     * @param parser - The Redis command parser
     * @param key - Key to retrieve the bit from
     * @param offset - Bit offset
     */
    parseCommand(parser, key, offset) {
        parser.push('GETBIT');
        parser.pushKey(key);
        parser.push(offset.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=GETBIT.js.map