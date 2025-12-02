"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Removes one or more fields from a hash
     * @param parser - The Redis command parser
     * @param key - Key of the hash
     * @param field - Field(s) to remove
     */
    parseCommand(parser, key, field) {
        parser.push('HDEL');
        parser.pushKey(key);
        parser.pushVariadic(field);
    },
    transformReply: undefined
};
//# sourceMappingURL=HDEL.js.map