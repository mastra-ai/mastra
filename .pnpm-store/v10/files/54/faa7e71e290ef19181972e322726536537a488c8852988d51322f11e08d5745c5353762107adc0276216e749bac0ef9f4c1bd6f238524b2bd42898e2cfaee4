"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the HPTTL command
     *
     * @param parser - The command parser
     * @param key - The key to check time-to-live for
     * @param fields - The fields to check time-to-live for
     * @see https://redis.io/commands/hpttl/
     */
    parseCommand(parser, key, fields) {
        parser.push('HPTTL');
        parser.pushKey(key);
        parser.push('FIELDS');
        parser.pushVariadicWithLength(fields);
    },
    transformReply: undefined
};
//# sourceMappingURL=HPTTL.js.map