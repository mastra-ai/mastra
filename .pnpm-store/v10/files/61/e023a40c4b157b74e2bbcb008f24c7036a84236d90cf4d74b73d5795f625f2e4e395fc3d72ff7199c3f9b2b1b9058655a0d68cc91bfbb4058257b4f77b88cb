"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the SPUBLISH command to post a message to a Sharded Pub/Sub channel
     *
     * @param parser - The command parser
     * @param channel - The channel to publish to
     * @param message - The message to publish
     * @see https://redis.io/commands/spublish/
     */
    parseCommand(parser, channel, message) {
        parser.push('SPUBLISH');
        parser.pushKey(channel);
        parser.push(message);
    },
    transformReply: undefined
};
//# sourceMappingURL=SPUBLISH.js.map