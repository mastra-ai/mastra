"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Creates a new Top-K filter with specified parameters
     * @param parser - The command parser
     * @param key - The name of the Top-K filter
     * @param topK - Number of top occurring items to keep
     * @param options - Optional parameters for filter configuration
     * @param options.width - Number of counters in each array
     * @param options.depth - Number of counter-arrays
     * @param options.decay - Counter decay factor
     */
    parseCommand(parser, key, topK, options) {
        parser.push('TOPK.RESERVE');
        parser.pushKey(key);
        parser.push(topK.toString());
        if (options) {
            parser.push(options.width.toString(), options.depth.toString(), options.decay.toString());
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=RESERVE.js.map