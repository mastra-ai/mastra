"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMMAND_LIST_FILTER_BY = void 0;
exports.COMMAND_LIST_FILTER_BY = {
    MODULE: 'MODULE',
    ACLCAT: 'ACLCAT',
    PATTERN: 'PATTERN'
};
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Returns a list of all commands supported by the Redis server
     * @param parser - The Redis command parser
     * @param options - Options for filtering the command list
     */
    parseCommand(parser, options) {
        parser.push('COMMAND', 'LIST');
        if (options?.FILTERBY) {
            parser.push('FILTERBY', options.FILTERBY.type, options.FILTERBY.value);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=COMMAND_LIST.js.map