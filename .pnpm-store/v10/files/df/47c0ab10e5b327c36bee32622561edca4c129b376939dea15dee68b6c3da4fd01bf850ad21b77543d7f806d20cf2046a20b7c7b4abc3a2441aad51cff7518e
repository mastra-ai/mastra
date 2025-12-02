"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Constructs the LPUSHX command
     *
     * @param parser - The command parser
     * @param key - The key of the list
     * @param elements - One or more elements to push to the list if it exists
     * @see https://redis.io/commands/lpushx/
     */
    parseCommand(parser, key, elements) {
        parser.push('LPUSHX');
        parser.pushKey(key);
        parser.pushVariadic(elements);
    },
    transformReply: undefined
};
//# sourceMappingURL=LPUSHX.js.map