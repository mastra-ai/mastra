"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Command for getting the length of a stream
 */
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the XLEN command to get the number of entries in a stream
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @returns The number of entries inside the stream
     * @see https://redis.io/commands/xlen/
     */
    parseCommand(parser, key) {
        parser.push('XLEN');
        parser.pushKey(key);
    },
    transformReply: undefined
};
//# sourceMappingURL=XLEN.js.map