"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the MGET command
     *
     * @param parser - The command parser
     * @param keys - Array of keys to get
     * @see https://redis.io/commands/mget/
     */
    parseCommand(parser, keys) {
        parser.push('MGET');
        parser.pushKeys(keys);
    },
    transformReply: undefined
};
//# sourceMappingURL=MGET.js.map