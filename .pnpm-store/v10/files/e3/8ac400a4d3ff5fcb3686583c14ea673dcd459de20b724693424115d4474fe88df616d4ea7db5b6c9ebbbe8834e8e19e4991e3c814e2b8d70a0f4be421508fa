"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Returns the count for one or more items in a Count-Min Sketch
     * @param parser - The command parser
     * @param key - The name of the sketch
     * @param items - One or more items to get counts for
     */
    parseCommand(parser, key, items) {
        parser.push('CMS.QUERY');
        parser.pushKey(key);
        parser.pushVariadic(items);
    },
    transformReply: undefined
};
//# sourceMappingURL=QUERY.js.map