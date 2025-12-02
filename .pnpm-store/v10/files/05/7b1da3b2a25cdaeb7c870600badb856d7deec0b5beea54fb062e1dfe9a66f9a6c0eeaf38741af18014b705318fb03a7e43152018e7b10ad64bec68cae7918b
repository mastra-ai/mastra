"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Checks if an item exists in a Bloom Filter
     * @param parser - The command parser
     * @param key - The name of the Bloom filter
     * @param item - The item to check for existence
     */
    parseCommand(parser, key, item) {
        parser.push('BF.EXISTS');
        parser.pushKey(key);
        parser.push(item);
    },
    transformReply: generic_transformers_1.transformBooleanReply
};
//# sourceMappingURL=EXISTS.js.map