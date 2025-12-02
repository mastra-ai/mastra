"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Constructs the SDIFFSTORE command
     *
     * @param parser - The command parser
     * @param destination - The destination key to store the result
     * @param keys - One or more set keys to compute the difference from
     * @see https://redis.io/commands/sdiffstore/
     */
    parseCommand(parser, destination, keys) {
        parser.push('SDIFFSTORE');
        parser.pushKey(destination);
        parser.pushKeys(keys);
    },
    transformReply: undefined
};
//# sourceMappingURL=SDIFFSTORE.js.map