"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the LRANGE command
     *
     * @param parser - The command parser
     * @param key - The key of the list
     * @param start - The starting index
     * @param stop - The ending index
     * @see https://redis.io/commands/lrange/
     */
    parseCommand(parser, key, start, stop) {
        parser.push('LRANGE');
        parser.pushKey(key);
        parser.push(start.toString(), stop.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=LRANGE.js.map