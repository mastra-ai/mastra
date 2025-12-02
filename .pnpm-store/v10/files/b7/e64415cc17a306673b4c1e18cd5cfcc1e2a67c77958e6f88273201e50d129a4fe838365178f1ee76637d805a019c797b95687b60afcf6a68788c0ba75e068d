"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the LINSERT command
     *
     * @param parser - The command parser
     * @param key - The key of the list
     * @param position - The position where to insert (BEFORE or AFTER)
     * @param pivot - The element to find in the list
     * @param element - The element to insert
     * @see https://redis.io/commands/linsert/
     */
    parseCommand(parser, key, position, pivot, element) {
        parser.push('LINSERT');
        parser.pushKey(key);
        parser.push(position, pivot, element);
    },
    transformReply: undefined
};
//# sourceMappingURL=LINSERT.js.map