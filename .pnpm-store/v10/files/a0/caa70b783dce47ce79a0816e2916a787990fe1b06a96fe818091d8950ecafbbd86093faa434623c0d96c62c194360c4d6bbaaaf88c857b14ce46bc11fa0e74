"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the HPEXPIRETIME command
     *
     * @param parser - The command parser
     * @param key - The key to retrieve expiration time for
     * @param fields - The fields to retrieve expiration time for
     * @see https://redis.io/commands/hpexpiretime/
     */
    parseCommand(parser, key, fields) {
        parser.push('HPEXPIRETIME');
        parser.pushKey(key);
        parser.push('FIELDS');
        parser.pushVariadicWithLength(fields);
    },
    transformReply: undefined
};
//# sourceMappingURL=HPEXPIRETIME.js.map