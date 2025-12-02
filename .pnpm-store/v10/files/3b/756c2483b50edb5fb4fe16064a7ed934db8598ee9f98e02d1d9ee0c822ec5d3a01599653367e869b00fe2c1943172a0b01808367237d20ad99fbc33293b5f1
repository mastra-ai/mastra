"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the SMEMBERS command
     *
     * @param parser - The command parser
     * @param key - The set key to get all members from
     * @see https://redis.io/commands/smembers/
     */
    parseCommand(parser, key) {
        parser.push('SMEMBERS');
        parser.pushKey(key);
    },
    transformReply: {
        2: undefined,
        3: undefined
    }
};
//# sourceMappingURL=SMEMBERS.js.map