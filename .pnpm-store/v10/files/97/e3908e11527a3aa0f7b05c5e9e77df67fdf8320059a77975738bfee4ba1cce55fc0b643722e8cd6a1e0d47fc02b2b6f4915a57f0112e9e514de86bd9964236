"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Stores the result of a range operation on a sorted set into a new sorted set.
     * @param parser - The Redis command parser.
     * @param destination - Destination key where the result will be stored.
     * @param source - Key of the source sorted set.
     * @param min - Minimum index, score or lexicographical value.
     * @param max - Maximum index, score or lexicographical value.
     * @param options - Optional parameters for the range operation (BY, REV, LIMIT).
     */
    parseCommand(parser, destination, source, min, max, options) {
        parser.push('ZRANGESTORE');
        parser.pushKey(destination);
        parser.pushKey(source);
        parser.push((0, generic_transformers_1.transformStringDoubleArgument)(min), (0, generic_transformers_1.transformStringDoubleArgument)(max));
        switch (options?.BY) {
            case 'SCORE':
                parser.push('BYSCORE');
                break;
            case 'LEX':
                parser.push('BYLEX');
                break;
        }
        if (options?.REV) {
            parser.push('REV');
        }
        if (options?.LIMIT) {
            parser.push('LIMIT', options.LIMIT.offset.toString(), options.LIMIT.count.toString());
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=ZRANGESTORE.js.map