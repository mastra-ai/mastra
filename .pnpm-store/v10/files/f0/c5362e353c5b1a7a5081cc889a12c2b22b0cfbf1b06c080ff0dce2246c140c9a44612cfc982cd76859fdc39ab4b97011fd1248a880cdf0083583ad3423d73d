"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the OBJECT ENCODING command
     *
     * @param parser - The command parser
     * @param key - The key to get the internal encoding for
     * @see https://redis.io/commands/object-encoding/
     */
    parseCommand(parser, key) {
        parser.push('OBJECT', 'ENCODING');
        parser.pushKey(key);
    },
    transformReply: undefined
};
//# sourceMappingURL=OBJECT_ENCODING.js.map