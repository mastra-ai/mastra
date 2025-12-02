"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Adds one or more items to a Top-K filter and returns items dropped from the top-K list
     * @param parser - The command parser
     * @param key - The name of the Top-K filter
     * @param items - One or more items to add to the filter
     */
    parseCommand(parser, key, items) {
        parser.push('TOPK.ADD');
        parser.pushKey(key);
        parser.pushVariadic(items);
    },
    transformReply: undefined
};
//# sourceMappingURL=ADD.js.map