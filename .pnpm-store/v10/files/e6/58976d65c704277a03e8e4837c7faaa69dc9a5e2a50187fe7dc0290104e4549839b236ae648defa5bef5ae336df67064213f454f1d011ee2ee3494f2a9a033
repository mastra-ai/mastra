"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Constructs the SPOP command to remove and return a random member from a set
     *
     * @param parser - The command parser
     * @param key - The key of the set to pop from
     * @see https://redis.io/commands/spop/
     */
    parseCommand(parser, key) {
        parser.push('SPOP');
        parser.pushKey(key);
    },
    transformReply: undefined
};
//# sourceMappingURL=SPOP.js.map