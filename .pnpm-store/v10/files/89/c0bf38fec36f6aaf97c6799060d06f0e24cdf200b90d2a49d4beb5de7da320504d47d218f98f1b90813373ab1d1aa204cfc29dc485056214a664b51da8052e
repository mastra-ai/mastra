"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the PING command
     *
     * @param parser - The command parser
     * @param message - Optional message to be returned instead of PONG
     * @see https://redis.io/commands/ping/
     */
    parseCommand(parser, message) {
        parser.push('PING');
        if (message) {
            parser.push(message);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=PING.js.map