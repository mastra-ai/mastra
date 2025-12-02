"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the RENAME command
     *
     * @param parser - The command parser
     * @param key - The key to rename
     * @param newKey - The new key name
     * @see https://redis.io/commands/rename/
     */
    parseCommand(parser, key, newKey) {
        parser.push('RENAME');
        parser.pushKeys([key, newKey]);
    },
    transformReply: undefined
};
//# sourceMappingURL=RENAME.js.map