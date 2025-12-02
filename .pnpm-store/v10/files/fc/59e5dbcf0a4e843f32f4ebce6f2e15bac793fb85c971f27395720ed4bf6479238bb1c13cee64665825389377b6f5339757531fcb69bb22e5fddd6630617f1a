"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the HSTRLEN command
     *
     * @param parser - The command parser
     * @param key - The key of the hash
     * @param field - The field to get the string length of
     * @see https://redis.io/commands/hstrlen/
     */
    parseCommand(parser, key, field) {
        parser.push('HSTRLEN');
        parser.pushKey(key);
        parser.push(field);
    },
    transformReply: undefined
};
//# sourceMappingURL=HSTRLEN.js.map