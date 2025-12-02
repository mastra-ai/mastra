"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Constructs the INCRBY command
     *
     * @param parser - The command parser
     * @param key - The key to increment
     * @param increment - The amount to increment by
     * @see https://redis.io/commands/incrby/
     */
    parseCommand(parser, key, increment) {
        parser.push('INCRBY');
        parser.pushKey(key);
        parser.push(increment.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=INCRBY.js.map