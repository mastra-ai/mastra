"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Constructs the RPOP command with count parameter
     *
     * @param parser - The command parser
     * @param key - The list key to pop from
     * @param count - The number of elements to pop
     * @see https://redis.io/commands/rpop/
     */
    parseCommand(parser, key, count) {
        parser.push('RPOP');
        parser.pushKey(key);
        parser.push(count.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=RPOP_COUNT.js.map