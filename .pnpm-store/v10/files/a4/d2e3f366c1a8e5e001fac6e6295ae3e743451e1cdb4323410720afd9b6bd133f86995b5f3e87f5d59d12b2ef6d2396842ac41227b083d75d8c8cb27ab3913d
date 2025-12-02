"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Constructs the PSETEX command
     *
     * @param parser - The command parser
     * @param key - The key to set
     * @param ms - The expiration time in milliseconds
     * @param value - The value to set
     * @see https://redis.io/commands/psetex/
     */
    parseCommand(parser, key, ms, value) {
        parser.push('PSETEX');
        parser.pushKey(key);
        parser.push(ms.toString(), value);
    },
    transformReply: undefined
};
//# sourceMappingURL=PSETEX.js.map