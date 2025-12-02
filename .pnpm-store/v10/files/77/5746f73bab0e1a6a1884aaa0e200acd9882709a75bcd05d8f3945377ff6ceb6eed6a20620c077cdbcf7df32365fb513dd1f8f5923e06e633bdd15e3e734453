"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Constructs the RPUSHX command
     *
     * @param parser - The command parser
     * @param key - The list key to push to (only if it exists)
     * @param element - One or more elements to push
     * @see https://redis.io/commands/rpushx/
     */
    parseCommand(parser, key, element) {
        parser.push('RPUSHX');
        parser.pushKey(key);
        parser.pushVariadic(element);
    },
    transformReply: undefined
};
//# sourceMappingURL=RPUSHX.js.map