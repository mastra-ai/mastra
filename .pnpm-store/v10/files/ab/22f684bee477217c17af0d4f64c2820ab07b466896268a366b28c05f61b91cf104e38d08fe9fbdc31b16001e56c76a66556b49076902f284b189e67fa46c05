"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: false,
    /**
     * Removes all keys from the current database
     * @param parser - The Redis command parser
     * @param mode - Optional flush mode (ASYNC or SYNC)
     */
    parseCommand(parser, mode) {
        parser.push('FLUSHDB');
        if (mode) {
            parser.push(mode);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=FLUSHDB.js.map