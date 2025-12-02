"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function pushIncrByItem(parser, { item, incrementBy }) {
    parser.push(item, incrementBy.toString());
}
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Increases the score of one or more items in a Top-K filter by specified increments
     * @param parser - The command parser
     * @param key - The name of the Top-K filter
     * @param items - A single item or array of items to increment, each with an item name and increment value
     */
    parseCommand(parser, key, items) {
        parser.push('TOPK.INCRBY');
        parser.pushKey(key);
        if (Array.isArray(items)) {
            for (const item of items) {
                pushIncrByItem(parser, item);
            }
        }
        else {
            pushIncrByItem(parser, items);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=INCRBY.js.map