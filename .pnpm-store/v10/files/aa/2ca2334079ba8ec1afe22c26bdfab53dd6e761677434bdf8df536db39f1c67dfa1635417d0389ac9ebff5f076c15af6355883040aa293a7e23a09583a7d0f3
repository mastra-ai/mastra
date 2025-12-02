"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Gets the values of all the specified fields in a hash.
     * @param parser - The Redis command parser.
     * @param key - Key of the hash.
     * @param fields - Fields to get from the hash.
     */
    parseCommand(parser, key, fields) {
        parser.push('HMGET');
        parser.pushKey(key);
        parser.pushVariadic(fields);
    },
    transformReply: undefined
};
//# sourceMappingURL=HMGET.js.map