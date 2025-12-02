"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Constructs the SETBIT command
     *
     * @param parser - The command parser
     * @param key - The key to set the bit on
     * @param offset - The bit offset (zero-based)
     * @param value - The bit value (0 or 1)
     * @see https://redis.io/commands/setbit/
     */
    parseCommand(parser, key, offset, value) {
        parser.push('SETBIT');
        parser.pushKey(key);
        parser.push(offset.toString(), value.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=SETBIT.js.map