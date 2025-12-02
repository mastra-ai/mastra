"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Constructs the LPUSH command
     *
     * @param parser - The command parser
     * @param key - The key of the list
     * @param elements - One or more elements to push to the list
     * @see https://redis.io/commands/lpush/
     */
    parseCommand(parser, key, elements) {
        parser.push('LPUSH');
        parser.pushKey(key);
        parser.pushVariadic(elements);
    },
    transformReply: undefined
};
//# sourceMappingURL=LPUSH.js.map