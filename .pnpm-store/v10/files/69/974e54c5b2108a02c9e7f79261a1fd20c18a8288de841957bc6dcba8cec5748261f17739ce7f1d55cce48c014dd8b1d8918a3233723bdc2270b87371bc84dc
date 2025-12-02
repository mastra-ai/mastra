"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the SDIFF command
     *
     * @param parser - The command parser
     * @param keys - One or more set keys to compute the difference from
     * @see https://redis.io/commands/sdiff/
     */
    parseCommand(parser, keys) {
        parser.push('SDIFF');
        parser.pushKeys(keys);
    },
    transformReply: undefined
};
//# sourceMappingURL=SDIFF.js.map