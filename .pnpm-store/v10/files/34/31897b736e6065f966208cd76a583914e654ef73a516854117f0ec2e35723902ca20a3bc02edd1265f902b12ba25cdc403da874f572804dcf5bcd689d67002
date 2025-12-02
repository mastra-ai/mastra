"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the PTTL command
     *
     * @param parser - The command parser
     * @param key - The key to get the time to live in milliseconds
     * @see https://redis.io/commands/pttl/
     */
    parseCommand(parser, key) {
        parser.push('PTTL');
        parser.pushKey(key);
    },
    transformReply: undefined
};
//# sourceMappingURL=PTTL.js.map