"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Returns the cardinality (number of items) in a Bloom Filter
     * @param parser - The command parser
     * @param key - The name of the Bloom filter to query
     */
    parseCommand(parser, key) {
        parser.push('BF.CARD');
        parser.pushKey(key);
    },
    transformReply: undefined
};
//# sourceMappingURL=CARD.js.map