"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Gets the value of a key
     * @param parser - The Redis command parser
     * @param key - Key to get the value of
     */
    parseCommand(parser, key) {
        parser.push('GET');
        parser.pushKey(key);
    },
    transformReply: undefined
};
//# sourceMappingURL=GET.js.map