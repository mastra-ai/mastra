"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the PUBSUB SHARDCHANNELS command
     *
     * @param parser - The command parser
     * @param pattern - Optional pattern to filter shard channels
     * @see https://redis.io/commands/pubsub-shardchannels/
     */
    parseCommand(parser, pattern) {
        parser.push('PUBSUB', 'SHARDCHANNELS');
        if (pattern) {
            parser.push(pattern);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=PUBSUB_SHARDCHANNELS.js.map