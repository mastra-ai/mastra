"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    IS_FORWARD_COMMAND: true,
    /**
     * Constructs the PUBLISH command
     *
     * @param parser - The command parser
     * @param channel - The channel to publish to
     * @param message - The message to publish
     * @see https://redis.io/commands/publish/
     */
    parseCommand(parser, channel, message) {
        parser.push('PUBLISH', channel, message);
    },
    transformReply: undefined
};
//# sourceMappingURL=PUBLISH.js.map