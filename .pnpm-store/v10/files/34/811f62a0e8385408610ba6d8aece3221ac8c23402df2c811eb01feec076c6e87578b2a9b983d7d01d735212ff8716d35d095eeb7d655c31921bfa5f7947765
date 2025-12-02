"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Determines whether a field exists in a hash
     * @param parser - The Redis command parser
     * @param key - Key of the hash
     * @param field - Field to check
     */
    parseCommand(parser, key, field) {
        parser.push('HEXISTS');
        parser.pushKey(key);
        parser.push(field);
    },
    transformReply: undefined
};
//# sourceMappingURL=HEXISTS.js.map