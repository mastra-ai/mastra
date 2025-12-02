"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Constructs the LTRIM command
     *
     * @param parser - The command parser
     * @param key - The key of the list
     * @param start - The starting index
     * @param stop - The ending index
     * @see https://redis.io/commands/ltrim/
     */
    parseCommand(parser, key, start, stop) {
        parser.push('LTRIM');
        parser.pushKey(key);
        parser.push(start.toString(), stop.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=LTRIM.js.map