"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseZInterArguments = void 0;
const generic_transformers_1 = require("./generic-transformers");
function parseZInterArguments(parser, keys, options) {
    (0, generic_transformers_1.parseZKeysArguments)(parser, keys);
    if (options?.AGGREGATE) {
        parser.push('AGGREGATE', options.AGGREGATE);
    }
}
exports.parseZInterArguments = parseZInterArguments;
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Intersects multiple sorted sets and returns the result as a new sorted set.
     * @param parser - The Redis command parser.
     * @param keys - Keys of the sorted sets to intersect.
     * @param options - Optional parameters for the intersection operation.
     */
    parseCommand(parser, keys, options) {
        parser.push('ZINTER');
        parseZInterArguments(parser, keys, options);
    },
    transformReply: undefined
};
//# sourceMappingURL=ZINTER.js.map