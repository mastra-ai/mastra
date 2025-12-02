"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Returns the cardinality of the intersection of multiple sorted sets.
     * @param parser - The Redis command parser.
     * @param keys - Keys of the sorted sets to intersect.
     * @param options - Limit option or options object with limit.
     */
    parseCommand(parser, keys, options) {
        parser.push('ZINTERCARD');
        parser.pushKeysLength(keys);
        // backwards compatibility
        if (typeof options === 'number') {
            parser.push('LIMIT', options.toString());
        }
        else if (options?.LIMIT) {
            parser.push('LIMIT', options.LIMIT.toString());
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=ZINTERCARD.js.map