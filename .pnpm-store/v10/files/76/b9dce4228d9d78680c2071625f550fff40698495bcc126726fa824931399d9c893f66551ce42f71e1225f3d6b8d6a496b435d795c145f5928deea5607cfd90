"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Constructs the SREM command to remove one or more members from a set
     *
     * @param parser - The command parser
     * @param key - The key of the set to remove members from
     * @param members - One or more members to remove from the set
     * @returns The number of members that were removed from the set
     * @see https://redis.io/commands/srem/
     */
    parseCommand(parser, key, members) {
        parser.push('SREM');
        parser.pushKey(key);
        parser.pushVariadic(members);
    },
    transformReply: undefined
};
//# sourceMappingURL=SREM.js.map