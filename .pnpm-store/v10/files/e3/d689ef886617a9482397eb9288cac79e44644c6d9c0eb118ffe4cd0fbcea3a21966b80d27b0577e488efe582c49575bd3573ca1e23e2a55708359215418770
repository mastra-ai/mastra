"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the STRLEN command to get the length of a string value
     *
     * @param parser - The command parser
     * @param key - The key holding the string value
     * @returns The length of the string value, or 0 when key does not exist
     * @see https://redis.io/commands/strlen/
     */
    parseCommand(parser, key) {
        parser.push('STRLEN');
        parser.pushKey(key);
    },
    transformReply: undefined
};
//# sourceMappingURL=STRLEN.js.map