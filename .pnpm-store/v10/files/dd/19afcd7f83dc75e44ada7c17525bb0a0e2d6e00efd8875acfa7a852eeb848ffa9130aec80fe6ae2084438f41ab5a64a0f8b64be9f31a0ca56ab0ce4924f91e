"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Constructs the SINTERSTORE command
     *
     * @param parser - The command parser
     * @param destination - The destination key to store the result
     * @param keys - One or more set keys to compute the intersection from
     * @see https://redis.io/commands/sinterstore/
     */
    parseCommand(parser, destination, keys) {
        parser.push('SINTERSTORE');
        parser.pushKey(destination);
        parser.pushKeys(keys);
    },
    transformReply: undefined
};
//# sourceMappingURL=SINTERSTORE.js.map