"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the RENAMENX command
     *
     * @param parser - The command parser
     * @param key - The key to rename
     * @param newKey - The new key name, if it doesn't exist
     * @see https://redis.io/commands/renamenx/
     */
    parseCommand(parser, key, newKey) {
        parser.push('RENAMENX');
        parser.pushKeys([key, newKey]);
    },
    transformReply: undefined
};
//# sourceMappingURL=RENAMENX.js.map