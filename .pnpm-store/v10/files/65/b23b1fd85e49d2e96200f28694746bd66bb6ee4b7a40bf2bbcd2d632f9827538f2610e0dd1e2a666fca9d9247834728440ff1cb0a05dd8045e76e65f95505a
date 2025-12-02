"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the HRANDFIELD command
     *
     * @param parser - The command parser
     * @param key - The key of the hash to get a random field from
     * @see https://redis.io/commands/hrandfield/
     */
    parseCommand(parser, key) {
        parser.push('HRANDFIELD');
        parser.pushKey(key);
    },
    transformReply: undefined
};
//# sourceMappingURL=HRANDFIELD.js.map