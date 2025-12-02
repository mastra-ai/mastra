"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Determines if the specified keys exist
     * @param parser - The Redis command parser
     * @param keys - One or more keys to check
     */
    parseCommand(parser, keys) {
        parser.push('EXISTS');
        parser.pushKeys(keys);
    },
    transformReply: undefined
};
//# sourceMappingURL=EXISTS.js.map