"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the LINDEX command
     *
     * @param parser - The command parser
     * @param key - The key of the list
     * @param index - The index of the element to retrieve
     * @see https://redis.io/commands/lindex/
     */
    parseCommand(parser, key, index) {
        parser.push('LINDEX');
        parser.pushKey(key);
        parser.push(index.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=LINDEX.js.map