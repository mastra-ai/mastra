"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Removes and returns the first element in a list, or blocks until one is available
     * @param parser - The Redis command parser
     * @param key - Key of the list to pop from, or array of keys to try sequentially
     * @param timeout - Maximum seconds to block, 0 to block indefinitely
     */
    parseCommand(parser, key, timeout) {
        parser.push('BLPOP');
        parser.pushKeys(key);
        parser.push(timeout.toString());
    },
    transformReply(reply) {
        if (reply === null)
            return null;
        return {
            key: reply[0],
            element: reply[1]
        };
    }
};
//# sourceMappingURL=BLPOP.js.map