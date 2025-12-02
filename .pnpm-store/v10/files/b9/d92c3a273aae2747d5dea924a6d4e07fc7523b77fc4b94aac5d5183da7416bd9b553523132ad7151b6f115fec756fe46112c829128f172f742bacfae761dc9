"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Returns the remaining time to live of field(s) in a hash.
     * @param parser - The Redis command parser.
     * @param key - Key of the hash.
     * @param fields - Fields to check time to live.
     */
    parseCommand(parser, key, fields) {
        parser.push('HTTL');
        parser.pushKey(key);
        parser.push('FIELDS');
        parser.pushVariadicWithLength(fields);
    },
    transformReply: undefined
};
//# sourceMappingURL=HTTL.js.map