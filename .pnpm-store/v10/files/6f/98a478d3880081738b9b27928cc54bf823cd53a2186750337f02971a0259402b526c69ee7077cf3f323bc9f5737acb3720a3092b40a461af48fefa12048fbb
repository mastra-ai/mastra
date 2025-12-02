"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Removes all elements in the sorted set with rank between start and stop.
     * @param parser - The Redis command parser.
     * @param key - Key of the sorted set.
     * @param start - Minimum rank (starting from 0).
     * @param stop - Maximum rank.
     */
    parseCommand(parser, key, start, stop) {
        parser.push('ZREMRANGEBYRANK');
        parser.pushKey(key);
        parser.push(start.toString(), stop.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=ZREMRANGEBYRANK.js.map