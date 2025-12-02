"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Increases the count of one or more items in a Count-Min Sketch
     * @param parser - The command parser
     * @param key - The name of the sketch
     * @param items - A single item or array of items to increment, each with an item and increment value
     */
    parseCommand(parser, key, items) {
        parser.push('CMS.INCRBY');
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
function pushIncrByItem(parser, { item, incrementBy }) {
    parser.push(item, incrementBy.toString());
}
//# sourceMappingURL=INCRBY.js.map