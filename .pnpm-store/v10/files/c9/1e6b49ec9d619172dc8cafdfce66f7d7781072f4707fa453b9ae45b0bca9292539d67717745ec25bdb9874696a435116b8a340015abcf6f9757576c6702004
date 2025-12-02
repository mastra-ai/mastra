"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Constructs the INCRBYFLOAT command
     *
     * @param parser - The command parser
     * @param key - The key to increment
     * @param increment - The floating-point value to increment by
     * @see https://redis.io/commands/incrbyfloat/
     */
    parseCommand(parser, key, increment) {
        parser.push('INCRBYFLOAT');
        parser.pushKey(key);
        parser.push(increment.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=INCRBYFLOAT.js.map