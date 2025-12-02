"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the PEXPIRETIME command
     *
     * @param parser - The command parser
     * @param key - The key to get the expiration time for in milliseconds
     * @see https://redis.io/commands/pexpiretime/
     */
    parseCommand(parser, key) {
        parser.push('PEXPIRETIME');
        parser.pushKey(key);
    },
    transformReply: undefined
};
//# sourceMappingURL=PEXPIRETIME.js.map