"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Extracts the key names from a Redis command
     * @param parser - The Redis command parser
     * @param args - Command arguments to analyze
     */
    parseCommand(parser, args) {
        parser.push('COMMAND', 'GETKEYS');
        parser.push(...args);
    },
    transformReply: undefined
};
//# sourceMappingURL=COMMAND_GETKEYS.js.map