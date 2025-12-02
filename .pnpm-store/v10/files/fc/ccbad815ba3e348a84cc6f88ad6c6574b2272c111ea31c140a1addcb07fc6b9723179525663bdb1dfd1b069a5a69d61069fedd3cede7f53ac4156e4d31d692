"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Gets the value of a key and deletes the key
     * @param parser - The Redis command parser
     * @param key - Key to get and delete
     */
    parseCommand(parser, key) {
        parser.push('GETDEL');
        parser.pushKey(key);
    },
    transformReply: undefined
};
//# sourceMappingURL=GETDEL.js.map