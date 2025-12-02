"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Command for getting the number of members in a sorted set
 */
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the ZCARD command to get the cardinality (number of members) of a sorted set
     *
     * @param parser - The command parser
     * @param key - The sorted set key
     * @returns Number of members in the sorted set
     * @see https://redis.io/commands/zcard/
     */
    parseCommand(parser, key) {
        parser.push('ZCARD');
        parser.pushKey(key);
    },
    transformReply: undefined
};
//# sourceMappingURL=ZCARD.js.map