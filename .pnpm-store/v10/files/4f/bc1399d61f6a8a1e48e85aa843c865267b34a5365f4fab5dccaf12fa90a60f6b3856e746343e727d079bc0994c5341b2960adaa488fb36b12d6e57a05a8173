"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Checks if multiple items exist in a Bloom Filter in a single call
     * @param parser - The command parser
     * @param key - The name of the Bloom filter
     * @param items - One or more items to check for existence
     */
    parseCommand(parser, key, items) {
        parser.push('BF.MEXISTS');
        parser.pushKey(key);
        parser.pushVariadic(items);
    },
    transformReply: generic_transformers_1.transformBooleanArrayReply
};
//# sourceMappingURL=MEXISTS.js.map