"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Gets all values in a hash.
     * @param parser - The Redis command parser.
     * @param key - Key of the hash.
     */
    parseCommand(parser, key) {
        parser.push('HVALS');
        parser.pushKey(key);
    },
    transformReply: undefined
};
//# sourceMappingURL=HVALS.js.map