"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Gets the number of fields in a hash.
     * @param parser - The Redis command parser.
     * @param key - Key of the hash.
     */
    parseCommand(parser, key) {
        parser.push('HLEN');
        parser.pushKey(key);
    },
    transformReply: undefined
};
//# sourceMappingURL=HLEN.js.map