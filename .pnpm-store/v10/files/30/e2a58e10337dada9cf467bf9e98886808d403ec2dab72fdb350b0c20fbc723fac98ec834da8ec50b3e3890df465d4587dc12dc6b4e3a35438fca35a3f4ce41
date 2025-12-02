"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Returns a serialized version of the value stored at the key
     * @param parser - The Redis command parser
     * @param key - Key to dump
     */
    parseCommand(parser, key) {
        parser.push('DUMP');
        parser.pushKey(key);
    },
    transformReply: undefined
};
//# sourceMappingURL=DUMP.js.map