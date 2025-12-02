"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Constructs the SETRANGE command
     *
     * @param parser - The command parser
     * @param key - The key to modify
     * @param offset - The offset at which to start writing
     * @param value - The value to write at the offset
     * @see https://redis.io/commands/setrange/
     */
    parseCommand(parser, key, offset, value) {
        parser.push('SETRANGE');
        parser.pushKey(key);
        parser.push(offset.toString(), value);
    },
    transformReply: undefined
};
//# sourceMappingURL=SETRANGE.js.map