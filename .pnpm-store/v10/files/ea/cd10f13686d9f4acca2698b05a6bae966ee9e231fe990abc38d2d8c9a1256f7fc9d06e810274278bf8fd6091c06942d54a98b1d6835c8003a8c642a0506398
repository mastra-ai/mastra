"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    /**
     * Increments the score of a member in a sorted set by the specified increment.
     * @param parser - The Redis command parser.
     * @param key - Key of the sorted set.
     * @param increment - Value to increment the score by.
     * @param member - Member whose score should be incremented.
     */
    parseCommand(parser, key, increment, member) {
        parser.push('ZINCRBY');
        parser.pushKey(key);
        parser.push((0, generic_transformers_1.transformDoubleArgument)(increment), member);
    },
    transformReply: generic_transformers_1.transformDoubleReply
};
//# sourceMappingURL=ZINCRBY.js.map