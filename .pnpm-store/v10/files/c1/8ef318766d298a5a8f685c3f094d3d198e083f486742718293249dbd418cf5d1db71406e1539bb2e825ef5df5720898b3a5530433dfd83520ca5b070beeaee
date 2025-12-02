"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the SINTER command
     *
     * @param parser - The command parser
     * @param keys - One or more set keys to compute the intersection from
     * @see https://redis.io/commands/sinter/
     */
    parseCommand(parser, keys) {
        parser.push('SINTER');
        parser.pushKeys(keys);
    },
    transformReply: undefined
};
//# sourceMappingURL=SINTER.js.map