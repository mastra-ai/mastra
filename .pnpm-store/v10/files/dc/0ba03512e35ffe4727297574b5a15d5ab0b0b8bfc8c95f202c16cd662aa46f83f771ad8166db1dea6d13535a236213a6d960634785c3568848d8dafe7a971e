"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the SUNION command to return the members of the set resulting from the union of all the given sets
     *
     * @param parser - The command parser
     * @param keys - One or more set keys to compute the union from
     * @returns Array of all elements that are members of at least one of the given sets
     * @see https://redis.io/commands/sunion/
     */
    parseCommand(parser, keys) {
        parser.push('SUNION');
        parser.pushKeys(keys);
    },
    transformReply: undefined
};
//# sourceMappingURL=SUNION.js.map