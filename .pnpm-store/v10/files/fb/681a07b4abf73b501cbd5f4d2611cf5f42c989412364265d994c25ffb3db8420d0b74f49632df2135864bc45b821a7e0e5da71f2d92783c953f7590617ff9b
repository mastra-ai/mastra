"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ZINTER_1 = require("./ZINTER");
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Stores the result of intersection of multiple sorted sets in a new sorted set.
     * @param parser - The Redis command parser.
     * @param destination - Destination key where the result will be stored.
     * @param keys - Keys of the sorted sets to intersect.
     * @param options - Optional parameters for the intersection operation.
     */
    parseCommand(parser, destination, keys, options) {
        parser.push('ZINTERSTORE');
        parser.pushKey(destination);
        (0, ZINTER_1.parseZInterArguments)(parser, keys, options);
    },
    transformReply: undefined
};
//# sourceMappingURL=ZINTERSTORE.js.map