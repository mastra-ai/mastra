"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the LREM command
     *
     * @param parser - The command parser
     * @param key - The key of the list
     * @param count - The count of elements to remove (negative: from tail to head, 0: all occurrences, positive: from head to tail)
     * @param element - The element to remove
     * @see https://redis.io/commands/lrem/
     */
    parseCommand(parser, key, count, element) {
        parser.push('LREM');
        parser.pushKey(key);
        parser.push(count.toString());
        parser.push(element);
    },
    transformReply: undefined
};
//# sourceMappingURL=LREM.js.map