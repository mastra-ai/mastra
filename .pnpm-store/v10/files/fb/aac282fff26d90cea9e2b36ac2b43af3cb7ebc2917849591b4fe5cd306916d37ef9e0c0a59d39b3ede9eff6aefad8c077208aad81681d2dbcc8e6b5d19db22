"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Creates an empty Cuckoo Filter with specified capacity and parameters
     * @param parser - The command parser
     * @param key - The name of the Cuckoo filter to create
     * @param capacity - The number of entries intended to be added to the filter
     * @param options - Optional parameters to tune the filter
     * @param options.BUCKETSIZE - Number of items in each bucket
     * @param options.MAXITERATIONS - Maximum number of iterations before declaring filter full
     * @param options.EXPANSION - Number of additional buckets per expansion
     */
    parseCommand(parser, key, capacity, options) {
        parser.push('CF.RESERVE');
        parser.pushKey(key);
        parser.push(capacity.toString());
        if (options?.BUCKETSIZE !== undefined) {
            parser.push('BUCKETSIZE', options.BUCKETSIZE.toString());
        }
        if (options?.MAXITERATIONS !== undefined) {
            parser.push('MAXITERATIONS', options.MAXITERATIONS.toString());
        }
        if (options?.EXPANSION !== undefined) {
            parser.push('EXPANSION', options.EXPANSION.toString());
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=RESERVE.js.map