"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Checks if one or more items are in the Top-K list
     * @param parser - The command parser
     * @param key - The name of the Top-K filter
     * @param items - One or more items to check in the filter
     */
    parseCommand(parser, key, items) {
        parser.push('TOPK.QUERY');
        parser.pushKey(key);
        parser.pushVariadic(items);
    },
    transformReply: generic_transformers_1.transformBooleanArrayReply
};
//# sourceMappingURL=QUERY.js.map