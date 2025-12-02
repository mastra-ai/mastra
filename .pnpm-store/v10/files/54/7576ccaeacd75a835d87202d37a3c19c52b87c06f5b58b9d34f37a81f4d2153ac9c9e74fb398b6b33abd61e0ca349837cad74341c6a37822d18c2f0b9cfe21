"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Returns a random member from a sorted set.
     * @param parser - The Redis command parser.
     * @param key - Key of the sorted set.
     */
    parseCommand(parser, key) {
        parser.push('ZRANDMEMBER');
        parser.pushKey(key);
    },
    transformReply: undefined
};
//# sourceMappingURL=ZRANDMEMBER.js.map