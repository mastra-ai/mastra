"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the HSETNX command
     *
     * @param parser - The command parser
     * @param key - The key of the hash
     * @param field - The field to set if it does not exist
     * @param value - The value to set
     * @see https://redis.io/commands/hsetnx/
     */
    parseCommand(parser, key, field, value) {
        parser.push('HSETNX');
        parser.pushKey(key);
        parser.push(field, value);
    },
    transformReply: undefined
};
//# sourceMappingURL=HSETNX.js.map