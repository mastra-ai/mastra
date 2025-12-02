"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Constructs the SETNX command
     *
     * @param parser - The command parser
     * @param key - The key to set if it doesn't exist
     * @param value - The value to set
     * @see https://redis.io/commands/setnx/
     */
    parseCommand(parser, key, value) {
        parser.push('SETNX');
        parser.pushKey(key);
        parser.push(value);
    },
    transformReply: undefined
};
//# sourceMappingURL=SETNX.js.map