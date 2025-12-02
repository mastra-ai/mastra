"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the LCS command (Longest Common Substring)
     *
     * @param parser - The command parser
     * @param key1 - First key containing the first string
     * @param key2 - Second key containing the second string
     * @see https://redis.io/commands/lcs/
     */
    parseCommand(parser, key1, key2) {
        parser.push('LCS');
        parser.pushKeys([key1, key2]);
    },
    transformReply: undefined
};
//# sourceMappingURL=LCS.js.map