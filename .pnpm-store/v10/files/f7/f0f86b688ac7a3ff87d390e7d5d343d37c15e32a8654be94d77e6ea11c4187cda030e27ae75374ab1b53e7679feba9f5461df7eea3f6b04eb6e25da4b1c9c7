"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Retrieve random elements of a vector set
     *
     * @param parser - The command parser
     * @param key - The key of the vector set
     * @param count - Optional number of elements to return
     * @see https://redis.io/commands/vrandmember/
     */
    parseCommand(parser, key, count) {
        parser.push('VRANDMEMBER');
        parser.pushKey(key);
        if (count !== undefined) {
            parser.push(count.toString());
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=VRANDMEMBER.js.map