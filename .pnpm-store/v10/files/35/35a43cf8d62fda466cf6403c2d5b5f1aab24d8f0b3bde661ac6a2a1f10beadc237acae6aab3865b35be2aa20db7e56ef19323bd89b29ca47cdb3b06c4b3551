"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the LLEN command
     *
     * @param parser - The command parser
     * @param key - The key of the list to get the length of
     * @see https://redis.io/commands/llen/
     */
    parseCommand(parser, key) {
        parser.push('LLEN');
        parser.pushKey(key);
    },
    transformReply: undefined
};
//# sourceMappingURL=LLEN.js.map