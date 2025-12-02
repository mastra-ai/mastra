"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the PEXPIRE command
     *
     * @param parser - The command parser
     * @param key - The key to set the expiration for
     * @param ms - The expiration time in milliseconds
     * @param mode - Optional mode for the command ('NX', 'XX', 'GT', 'LT')
     * @see https://redis.io/commands/pexpire/
     */
    parseCommand(parser, key, ms, mode) {
        parser.push('PEXPIRE');
        parser.pushKey(key);
        parser.push(ms.toString());
        if (mode) {
            parser.push(mode);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=PEXPIRE.js.map