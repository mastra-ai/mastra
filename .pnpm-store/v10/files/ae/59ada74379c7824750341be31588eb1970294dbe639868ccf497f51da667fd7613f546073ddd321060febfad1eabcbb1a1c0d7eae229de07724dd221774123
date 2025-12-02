"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: false,
    /**
     * Loads a library to Redis
     * @param parser - The Redis command parser
     * @param code - Library code to load
     * @param options - Function load options
     */
    parseCommand(parser, code, options) {
        parser.push('FUNCTION', 'LOAD');
        if (options?.REPLACE) {
            parser.push('REPLACE');
        }
        parser.push(code);
    },
    transformReply: undefined
};
//# sourceMappingURL=FUNCTION_LOAD.js.map