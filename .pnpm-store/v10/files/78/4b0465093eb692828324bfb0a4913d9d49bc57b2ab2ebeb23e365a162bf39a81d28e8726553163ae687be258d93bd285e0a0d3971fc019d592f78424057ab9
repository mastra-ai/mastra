"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Sets a key to a new value and returns its old value
     * @param parser - The Redis command parser
     * @param key - Key to set
     * @param value - Value to set
     */
    parseCommand(parser, key, value) {
        parser.push('GETSET');
        parser.pushKey(key);
        parser.push(value);
    },
    transformReply: undefined
};
//# sourceMappingURL=GETSET.js.map