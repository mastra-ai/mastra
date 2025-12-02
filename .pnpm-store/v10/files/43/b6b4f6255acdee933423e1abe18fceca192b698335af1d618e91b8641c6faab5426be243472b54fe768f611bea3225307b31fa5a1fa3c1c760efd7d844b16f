"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Gets all field names in a hash
     * @param parser - The Redis command parser
     * @param key - Key of the hash
     */
    parseCommand(parser, key) {
        parser.push('HKEYS');
        parser.pushKey(key);
    },
    transformReply: undefined
};
//# sourceMappingURL=HKEYS.js.map