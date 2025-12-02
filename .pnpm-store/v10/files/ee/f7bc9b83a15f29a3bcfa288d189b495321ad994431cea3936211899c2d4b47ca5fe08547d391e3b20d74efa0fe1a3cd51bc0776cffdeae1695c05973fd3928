"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Command for removing messages from a stream
 */
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Constructs the XDEL command to remove one or more messages from a stream
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param id - One or more message IDs to delete
     * @returns The number of messages actually deleted
     * @see https://redis.io/commands/xdel/
     */
    parseCommand(parser, key, id) {
        parser.push('XDEL');
        parser.pushKey(key);
        parser.pushVariadic(id);
    },
    transformReply: undefined
};
//# sourceMappingURL=XDEL.js.map