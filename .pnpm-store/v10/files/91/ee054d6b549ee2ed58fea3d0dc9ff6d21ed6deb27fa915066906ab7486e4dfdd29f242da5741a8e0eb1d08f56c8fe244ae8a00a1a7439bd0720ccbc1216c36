"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Increments the integer value of a field in a hash by the given number
     * @param parser - The Redis command parser
     * @param key - Key of the hash
     * @param field - Field to increment
     * @param increment - Increment amount
     */
    parseCommand(parser, key, field, increment) {
        parser.push('HINCRBY');
        parser.pushKey(key);
        parser.push(field, increment.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=HINCRBY.js.map