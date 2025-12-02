"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the SINTERCARD command
     *
     * @param parser - The command parser
     * @param keys - One or more set keys to compute the intersection cardinality from
     * @param options - Options for the SINTERCARD command or a number for LIMIT (backwards compatibility)
     * @see https://redis.io/commands/sintercard/
     */
    parseCommand(parser, keys, options) {
        parser.push('SINTERCARD');
        parser.pushKeysLength(keys);
        if (typeof options === 'number') { // backwards compatibility
            parser.push('LIMIT', options.toString());
        }
        else if (options?.LIMIT !== undefined) {
            parser.push('LIMIT', options.LIMIT.toString());
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=SINTERCARD.js.map