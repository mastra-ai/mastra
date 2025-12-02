"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Constructs the SUNIONSTORE command to store the union of multiple sets into a destination set
     *
     * @param parser - The command parser
     * @param destination - The destination key to store the resulting set
     * @param keys - One or more source set keys to compute the union from
     * @returns The number of elements in the resulting set
     * @see https://redis.io/commands/sunionstore/
     */
    parseCommand(parser, destination, keys) {
        parser.push('SUNIONSTORE');
        parser.pushKey(destination);
        parser.pushKeys(keys);
    },
    transformReply: undefined
};
//# sourceMappingURL=SUNIONSTORE.js.map