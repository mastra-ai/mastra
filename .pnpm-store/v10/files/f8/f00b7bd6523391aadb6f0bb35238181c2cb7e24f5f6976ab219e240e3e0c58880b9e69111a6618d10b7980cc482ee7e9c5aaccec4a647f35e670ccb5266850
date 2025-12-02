"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the SMISMEMBER command
     *
     * @param parser - The command parser
     * @param key - The set key to check membership in
     * @param members - The members to check for existence
     * @see https://redis.io/commands/smismember/
     */
    parseCommand(parser, key, members) {
        parser.push('SMISMEMBER');
        parser.pushKey(key);
        parser.pushVariadic(members);
    },
    transformReply: undefined
};
//# sourceMappingURL=SMISMEMBER.js.map