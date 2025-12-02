"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Returns the absolute Unix timestamp (since January 1, 1970) at which the given key will expire
     * @param parser - The Redis command parser
     * @param key - Key to check expiration time
     */
    parseCommand(parser, key) {
        parser.push('EXPIRETIME');
        parser.pushKey(key);
    },
    transformReply: undefined
};
//# sourceMappingURL=EXPIRETIME.js.map