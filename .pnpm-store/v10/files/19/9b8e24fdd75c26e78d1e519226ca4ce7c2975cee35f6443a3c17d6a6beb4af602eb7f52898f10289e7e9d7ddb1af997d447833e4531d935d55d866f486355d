"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Returns the count of occurrences for one or more items in a Top-K filter
     * @param parser - The command parser
     * @param key - The name of the Top-K filter
     * @param items - One or more items to get counts for
     */
    parseCommand(parser, key, items) {
        parser.push('TOPK.COUNT');
        parser.pushKey(key);
        parser.pushVariadic(items);
    },
    transformReply: undefined
};
//# sourceMappingURL=COUNT.js.map