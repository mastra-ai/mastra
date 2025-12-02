"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the SISMEMBER command
     *
     * @param parser - The command parser
     * @param key - The set key to check membership in
     * @param member - The member to check for existence
     * @see https://redis.io/commands/sismember/
     */
    parseCommand(parser, key, member) {
        parser.push('SISMEMBER');
        parser.pushKey(key);
        parser.push(member);
    },
    transformReply: undefined
};
//# sourceMappingURL=SISMEMBER.js.map