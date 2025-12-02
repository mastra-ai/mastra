"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Returns a substring of the string stored at a key
     * @param parser - The Redis command parser
     * @param key - Key to get substring from
     * @param start - Start position of the substring
     * @param end - End position of the substring
     */
    parseCommand(parser, key, start, end) {
        parser.push('GETRANGE');
        parser.pushKey(key);
        parser.push(start.toString(), end.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=GETRANGE.js.map