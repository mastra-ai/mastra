"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the SCRIPT FLUSH command
     *
     * @param parser - The command parser
     * @param mode - Optional flush mode: ASYNC or SYNC
     * @see https://redis.io/commands/script-flush/
     */
    parseCommand(parser, mode) {
        parser.push('SCRIPT', 'FLUSH');
        if (mode) {
            parser.push(mode);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=SCRIPT_FLUSH.js.map