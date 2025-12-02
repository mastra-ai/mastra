"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Returns the number of times an item appears in a Cuckoo Filter
     * @param parser - The command parser
     * @param key - The name of the Cuckoo filter
     * @param item - The item to count occurrences of
     */
    parseCommand(parser, key, item) {
        parser.push('CF.COUNT');
        parser.pushKey(key);
        parser.push(item);
    },
    transformReply: undefined
};
//# sourceMappingURL=COUNT.js.map