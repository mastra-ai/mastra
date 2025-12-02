"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the PUBSUB CHANNELS command
     *
     * @param parser - The command parser
     * @param pattern - Optional pattern to filter channels
     * @see https://redis.io/commands/pubsub-channels/
     */
    parseCommand(parser, pattern) {
        parser.push('PUBSUB', 'CHANNELS');
        if (pattern) {
            parser.push(pattern);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=PUBSUB_CHANNELS.js.map