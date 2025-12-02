"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the SRANDMEMBER command to get a random member from a set
     *
     * @param parser - The command parser
     * @param key - The key of the set to get random member from
     * @see https://redis.io/commands/srandmember/
     */
    parseCommand(parser, key) {
        parser.push('SRANDMEMBER');
        parser.pushKey(key);
    },
    transformReply: undefined
};
//# sourceMappingURL=SRANDMEMBER.js.map