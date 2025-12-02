"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Increments the float value of a field in a hash by the given amount
     * @param parser - The Redis command parser
     * @param key - Key of the hash
     * @param field - Field to increment
     * @param increment - Increment amount (float)
     */
    parseCommand(parser, key, field, increment) {
        parser.push('HINCRBYFLOAT');
        parser.pushKey(key);
        parser.push(field, increment.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=HINCRBYFLOAT.js.map