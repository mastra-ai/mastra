"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: false,
    /**
     * Constructs the SHUTDOWN command
     *
     * @param parser - The command parser
     * @param options - Options for the shutdown process
     * @see https://redis.io/commands/shutdown/
     */
    parseCommand(parser, options) {
        parser.push('SHUTDOWN');
        if (options?.mode) {
            parser.push(options.mode);
        }
        if (options?.NOW) {
            parser.push('NOW');
        }
        if (options?.FORCE) {
            parser.push('FORCE');
        }
        if (options?.ABORT) {
            parser.push('ABORT');
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=SHUTDOWN.js.map