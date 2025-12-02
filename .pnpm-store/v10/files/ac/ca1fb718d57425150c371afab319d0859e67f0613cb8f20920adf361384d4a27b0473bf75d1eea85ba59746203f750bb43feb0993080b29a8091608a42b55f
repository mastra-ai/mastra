"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Removes the expiration from the specified fields in a hash.
     * @param parser - The Redis command parser.
     * @param key - Key of the hash.
     * @param fields - Fields to remove expiration from.
     */
    parseCommand(parser, key, fields) {
        parser.push('HPERSIST');
        parser.pushKey(key);
        parser.push('FIELDS');
        parser.pushVariadicWithLength(fields);
    },
    transformReply: undefined
};
//# sourceMappingURL=HPERSIST.js.map