"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Returns the rank of a member in the sorted set, with scores ordered from high to low.
     * @param parser - The Redis command parser.
     * @param key - Key of the sorted set.
     * @param member - Member to get the rank for.
     */
    parseCommand(parser, key, member) {
        parser.push('ZREVRANK');
        parser.pushKey(key);
        parser.push(member);
    },
    transformReply: undefined
};
//# sourceMappingURL=ZREVRANK.js.map