"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Constructs the RPUSH command
     *
     * @param parser - The command parser
     * @param key - The list key to push to
     * @param element - One or more elements to push
     * @see https://redis.io/commands/rpush/
     */
    parseCommand(parser, key, element) {
        parser.push('RPUSH');
        parser.pushKey(key);
        parser.pushVariadic(element);
    },
    transformReply: undefined
};
//# sourceMappingURL=RPUSH.js.map