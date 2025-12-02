"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Performs read-only bitfield integer operations on strings
     * @param parser - The Redis command parser
     * @param key - The key holding the string
     * @param operations - Array of GET operations to perform on the bitfield
     */
    parseCommand(parser, key, operations) {
        parser.push('BITFIELD_RO');
        parser.pushKey(key);
        for (const operation of operations) {
            parser.push('GET');
            parser.push(operation.encoding);
            parser.push(operation.offset.toString());
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=BITFIELD_RO.js.map