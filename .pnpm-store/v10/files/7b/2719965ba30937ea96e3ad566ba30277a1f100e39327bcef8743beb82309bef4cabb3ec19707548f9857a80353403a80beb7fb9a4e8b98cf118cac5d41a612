"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the OBJECT FREQ command
     *
     * @param parser - The command parser
     * @param key - The key to get the access frequency for
     * @see https://redis.io/commands/object-freq/
     */
    parseCommand(parser, key) {
        parser.push('OBJECT', 'FREQ');
        parser.pushKey(key);
    },
    transformReply: undefined
};
//# sourceMappingURL=OBJECT_FREQ.js.map