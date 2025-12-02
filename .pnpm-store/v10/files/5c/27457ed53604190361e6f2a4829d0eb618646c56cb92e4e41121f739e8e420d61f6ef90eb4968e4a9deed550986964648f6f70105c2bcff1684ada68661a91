"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the TYPE command to determine the data type stored at key
     *
     * @param parser - The command parser
     * @param key - Key to check
     * @returns String reply: "none", "string", "list", "set", "zset", "hash", "stream"
     * @see https://redis.io/commands/type/
     */
    parseCommand(parser, key) {
        parser.push('TYPE');
        parser.pushKey(key);
    },
    transformReply: undefined
};
//# sourceMappingURL=TYPE.js.map