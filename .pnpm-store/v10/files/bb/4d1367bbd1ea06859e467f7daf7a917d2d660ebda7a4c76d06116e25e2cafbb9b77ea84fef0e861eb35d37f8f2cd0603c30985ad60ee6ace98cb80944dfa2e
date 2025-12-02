"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Constructs the SETEX command
     *
     * @param parser - The command parser
     * @param key - The key to set
     * @param seconds - The expiration time in seconds
     * @param value - The value to set
     * @see https://redis.io/commands/setex/
     */
    parseCommand(parser, key, seconds, value) {
        parser.push('SETEX');
        parser.pushKey(key);
        parser.push(seconds.toString(), value);
    },
    transformReply: undefined
};
//# sourceMappingURL=SETEX.js.map