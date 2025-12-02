"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Decrements the integer value of a key by the given number
     * @param parser - The Redis command parser
     * @param key - Key to decrement
     * @param decrement - Decrement amount
     */
    parseCommand(parser, key, decrement) {
        parser.push('DECRBY');
        parser.pushKey(key);
        parser.push(decrement.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=DECRBY.js.map