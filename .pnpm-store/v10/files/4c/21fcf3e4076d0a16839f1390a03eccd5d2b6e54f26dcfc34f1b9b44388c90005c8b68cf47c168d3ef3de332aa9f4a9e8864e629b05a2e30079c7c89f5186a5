"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Gets and deletes the specified fields from a hash
     * @param parser - The Redis command parser
     * @param key - Key of the hash
     * @param fields - Fields to get and delete
     */
    parseCommand(parser, key, fields) {
        parser.push('HGETDEL');
        parser.pushKey(key);
        parser.push('FIELDS');
        parser.pushVariadicWithLength(fields);
    },
    transformReply: undefined
};
//# sourceMappingURL=HGETDEL.js.map