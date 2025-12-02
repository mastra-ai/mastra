"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: false,
    /**
     * Deletes all the libraries and functions from a Redis server
     * @param parser - The Redis command parser
     * @param mode - Optional flush mode (ASYNC or SYNC)
     */
    parseCommand(parser, mode) {
        parser.push('FUNCTION', 'FLUSH');
        if (mode) {
            parser.push(mode);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=FUNCTION_FLUSH.js.map