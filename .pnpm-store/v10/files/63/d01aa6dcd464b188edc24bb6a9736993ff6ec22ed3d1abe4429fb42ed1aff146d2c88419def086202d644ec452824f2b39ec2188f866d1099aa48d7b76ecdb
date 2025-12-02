"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Creates an empty Bloom Filter with a given desired error ratio and initial capacity
     * @param parser - The command parser
     * @param key - The name of the Bloom filter to create
     * @param errorRate - The desired probability for false positives (between 0 and 1)
     * @param capacity - The number of entries intended to be added to the filter
     * @param options - Optional parameters to tune the filter
     * @param options.EXPANSION - Expansion rate for the filter
     * @param options.NONSCALING - Prevents the filter from creating additional sub-filters
     */
    parseCommand(parser, key, errorRate, capacity, options) {
        parser.push('BF.RESERVE');
        parser.pushKey(key);
        parser.push(errorRate.toString(), capacity.toString());
        if (options?.EXPANSION) {
            parser.push('EXPANSION', options.EXPANSION.toString());
        }
        if (options?.NONSCALING) {
            parser.push('NONSCALING');
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=RESERVE.js.map