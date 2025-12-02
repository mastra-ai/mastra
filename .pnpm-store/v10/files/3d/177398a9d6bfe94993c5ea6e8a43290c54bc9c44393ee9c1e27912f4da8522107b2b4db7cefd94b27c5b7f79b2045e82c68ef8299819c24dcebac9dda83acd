"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Stores the union of multiple sorted sets in a new sorted set.
     * @param parser - The Redis command parser.
     * @param destination - Destination key where the result will be stored.
     * @param keys - Keys of the sorted sets to combine.
     * @param options - Optional parameters for the union operation.
     */
    parseCommand(parser, destination, keys, options) {
        parser.push('ZUNIONSTORE');
        parser.pushKey(destination);
        (0, generic_transformers_1.parseZKeysArguments)(parser, keys);
        if (options?.AGGREGATE) {
            parser.push('AGGREGATE', options.AGGREGATE);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=ZUNIONSTORE.js.map