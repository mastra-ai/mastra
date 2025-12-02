"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Gets the value of a field in a hash
     * @param parser - The Redis command parser
     * @param key - Key of the hash
     * @param field - Field to get the value of
     */
    parseCommand(parser, key, field) {
        parser.push('HGET');
        parser.pushKey(key);
        parser.push(field);
    },
    transformReply: undefined
};
//# sourceMappingURL=HGET.js.map