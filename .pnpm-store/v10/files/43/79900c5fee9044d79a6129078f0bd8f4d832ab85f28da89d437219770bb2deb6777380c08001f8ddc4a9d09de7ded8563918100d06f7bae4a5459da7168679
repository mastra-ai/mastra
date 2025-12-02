"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Performs bitwise operations between strings
     * @param parser - The Redis command parser
     * @param operation - Bitwise operation to perform: AND, OR, XOR, NOT, DIFF, DIFF1, ANDOR, ONE
     * @param destKey - Destination key to store the result
     * @param key - Source key(s) to perform operation on
     */
    parseCommand(parser, operation, destKey, key) {
        parser.push('BITOP', operation);
        parser.pushKey(destKey);
        parser.pushKeys(key);
    },
    transformReply: undefined
};
//# sourceMappingURL=BITOP.js.map