"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Removes and returns up to count members with the lowest scores in the sorted set.
     * @param parser - The Redis command parser.
     * @param key - Key of the sorted set.
     * @param count - Number of members to pop.
     */
    parseCommand(parser, key, count) {
        parser.push('ZPOPMIN');
        parser.pushKey(key);
        parser.push(count.toString());
    },
    transformReply: generic_transformers_1.transformSortedSetReply
};
//# sourceMappingURL=ZPOPMIN_COUNT.js.map