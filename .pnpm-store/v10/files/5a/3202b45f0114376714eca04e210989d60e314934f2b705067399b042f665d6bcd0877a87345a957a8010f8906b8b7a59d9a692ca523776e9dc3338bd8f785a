"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the SCARD command
     *
     * @param parser - The command parser
     * @param key - The set key to get the cardinality of
     * @see https://redis.io/commands/scard/
     */
    parseCommand(parser, key) {
        parser.push('SCARD');
        parser.pushKey(key);
    },
    transformReply: undefined
};
//# sourceMappingURL=SCARD.js.map