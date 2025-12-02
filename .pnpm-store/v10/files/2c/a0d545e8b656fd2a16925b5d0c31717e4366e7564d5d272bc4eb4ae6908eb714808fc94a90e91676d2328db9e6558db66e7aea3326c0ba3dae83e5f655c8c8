"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the TTL command to get the remaining time to live of a key
     *
     * @param parser - The command parser
     * @param key - Key to check
     * @returns Time to live in seconds, -2 if key does not exist, -1 if has no timeout
     * @see https://redis.io/commands/ttl/
     */
    parseCommand(parser, key) {
        parser.push('TTL');
        parser.pushKey(key);
    },
    transformReply: undefined
};
//# sourceMappingURL=TTL.js.map