"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Removes the specified members from the sorted set.
     * @param parser - The Redis command parser.
     * @param key - Key of the sorted set.
     * @param member - One or more members to remove.
     */
    parseCommand(parser, key, member) {
        parser.push('ZREM');
        parser.pushKey(key);
        parser.pushVariadic(member);
    },
    transformReply: undefined
};
//# sourceMappingURL=ZREM.js.map